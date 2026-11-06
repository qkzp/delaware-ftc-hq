import AuthenticationServices
import CryptoKit
import Security
import SwiftUI
import UIKit
import WebKit

private struct WebsiteConfiguration {
    let url: URL
    let error: String?
}

private let websiteConfiguration: WebsiteConfiguration = {
    let production = URL(string: "https://delaware-ftc-hq.vercel.app/")!
    #if DEBUG
    guard let rawValue = ProcessInfo.processInfo.environment["MYFTC_BASE_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines), !rawValue.isEmpty else {
        return WebsiteConfiguration(url: production, error: nil)
    }
    guard var components = URLComponents(string: rawValue),
          let scheme = components.scheme?.lowercased(), let host = components.host?.lowercased(),
          !host.isEmpty, components.user == nil, components.password == nil,
          components.query == nil, components.fragment == nil,
          components.path.isEmpty || components.path == "/",
          components.port.map({ (1...65535).contains($0) }) ?? true,
          scheme == "https" || (scheme == "http" && isLocalDevelopmentHost(host)) else {
        return WebsiteConfiguration(url: production, error: "Use an HTTPS site address or an HTTP address on your local network in MYFTC_BASE_URL.")
    }
    components.scheme = scheme
    components.host = host
    components.path = "/"
    if (scheme == "http" && components.port == 80) || (scheme == "https" && components.port == 443) {
        components.port = nil
    }
    guard let url = components.url else {
        return WebsiteConfiguration(url: production, error: "The test website address is invalid. Check MYFTC_BASE_URL in the Xcode run scheme.")
    }
    return WebsiteConfiguration(url: url, error: nil)
    #else
    return WebsiteConfiguration(url: production, error: nil)
    #endif
}()

private let websiteURL = websiteConfiguration.url

private func isLocalDevelopmentHost(_ host: String) -> Bool {
    if host == "localhost" || host.hasSuffix(".local") { return true }
    let parts = host.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 4 else { return false }
    let numbers = parts.compactMap { Int($0) }
    guard numbers.count == 4, numbers.allSatisfy({ (0...255).contains($0) }) else { return false }
    return numbers[0] == 10 || numbers[0] == 127 ||
        (numbers[0] == 192 && numbers[1] == 168) ||
        (numbers[0] == 172 && (16...31).contains(numbers[1]))
}

private func isWebsiteOrigin(_ url: URL) -> Bool {
    guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased(),
          scheme == websiteURL.scheme?.lowercased(), host == websiteURL.host?.lowercased() else { return false }
    let defaultPort = scheme == "https" ? 443 : 80
    return (url.port ?? defaultPort) == (websiteURL.port ?? defaultPort)
}

private let nativeAuthScheme = "com.myftcspace.ios.auth"

private func randomAuthValue() -> String? {
    var bytes = [UInt8](repeating: 0, count: 32)
    let status = bytes.withUnsafeMutableBytes { buffer in
        SecRandomCopyBytes(kSecRandomDefault, buffer.count, buffer.baseAddress!)
    }
    guard status == errSecSuccess else { return nil }
    return base64URL(Data(bytes))
}

private func base64URL(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

private func isAuthValue(_ value: String) -> Bool {
    value.utf8.count == 43 && value.unicodeScalars.allSatisfy {
        CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_").contains($0)
    }
}

private func isAuthSnapshot(_ value: String) -> Bool {
    value.utf8.count == 101 && value.range(
        of: "^[0-9]{13}\\.[A-Za-z0-9_-]{43}\\.[A-Za-z0-9_-]{43}$",
        options: .regularExpression
    ) != nil
}

private func isSafeReturnPath(_ path: String) -> Bool {
    guard path.hasPrefix("/"), !path.hasPrefix("//"), !path.contains("\\"),
          path.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) }),
          let components = URLComponents(string: path), components.scheme == nil, components.host == nil,
          components.path != "/api", !components.path.hasPrefix("/api/"),
          let target = URL(string: path, relativeTo: websiteURL)?.absoluteURL else { return false }
    return isWebsiteOrigin(target)
}

@MainActor
private final class WorkspaceNavigationHandler: NSObject, WKScriptMessageHandler {
    weak var model: WebsiteModel?

    init(model: WebsiteModel) { self.model = model }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
              isWebsiteOrigin(url), let page = message.body as? String else { return }
        model?.workspacePage = page.isEmpty ? nil : page
    }
}

@MainActor
private final class NativeAuthHandler: NSObject, WKScriptMessageHandler {
    weak var model: WebsiteModel?

    init(model: WebsiteModel) { self.model = model }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let model, message.webView === model.webView, message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, isWebsiteOrigin(url), url.path == "/signin",
              let current = model.webView.url, isWebsiteOrigin(current), current.path == "/signin",
              let payload = message.body as? [String: Any],
              Set(payload.keys) == Set(["provider", "callbackUrl"]),
              let provider = payload["provider"] as? String,
              let callback = payload["callbackUrl"] as? String else { return }
        model.beginNativeSignIn(provider: provider, callback: callback, source: current)
    }
}

private struct NativeAuthFlow {
    let state: String
    let verifier: String
    let snapshot: String
    let callback: String
    let source: URL
    let pageGeneration: UInt
}

@MainActor
final class WebsiteModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, ASWebAuthenticationPresentationContextProviding {
    let webView: WKWebView
    @Published var isLoading = true
    @Published var hasLoadedPage = false
    @Published var hasError = false
    @Published var errorTitle = "Can’t reach MyFTCSpace"
    @Published var errorDescription = "Check your connection, then try again."
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var currentURL: URL?
    @Published var workspacePage: String?
    @Published var confirmingPageExit = false
    let configurationError = websiteConfiguration.error
    private var pendingURL: URL?
    private var failedURL: URL?
    private var downloadLocations: [ObjectIdentifier: URL] = [:]
    private var nativeAuthBusy = false
    private var nativeAuthAttempt: UUID?
    private var nativeAuthSession: ASWebAuthenticationSession?
    private var nativeAuthAnchor: UIWindow?
    private var nativeAuthFlow: NativeAuthFlow?
    private var pageGeneration: UInt = 0

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        var originComponents = URLComponents(url: websiteURL, resolvingAgainstBaseURL: false)
        originComponents?.path = ""
        if let origin = originComponents?.string,
           let originData = try? JSONEncoder().encode(origin),
           let originString = String(data: originData, encoding: .utf8),
           let stylesheetURL = Bundle.main.url(forResource: "iPhone", withExtension: "css"),
           let stylesheet = try? String(contentsOf: stylesheetURL, encoding: .utf8),
           let encoded = try? JSONEncoder().encode(stylesheet),
           let javascriptString = String(data: encoded, encoding: .utf8) {
            let script = """
            (() => {
              if (window.location.origin !== \(originString)) return;
              document.documentElement.classList.add('myftc-ios');
              const style = document.createElement('style');
              style.id = 'myftc-ios-styles';
              style.textContent = \(javascriptString);
              document.head.appendChild(style);
              let lastPage;
              const reportWorkspacePage = () => {
                const navigation = document.querySelector('.app-shell select.mobile-navigation');
                const page = navigation ? navigation.value : '';
                if (page !== lastPage) {
                  lastPage = page;
                  window.webkit.messageHandlers.myftcWorkspacePage.postMessage(page);
                }
              };
              document.addEventListener('change', reportWorkspacePage, true);
              document.addEventListener('click', () => requestAnimationFrame(reportWorkspacePage), true);
              window.setTimeout(reportWorkspacePage, 500);
            })();
            """
            configuration.userContentController.addUserScript(
                WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
            )
        }
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.configuration.userContentController.add(WorkspaceNavigationHandler(model: self), name: "myftcWorkspacePage")
        webView.configuration.userContentController.add(NativeAuthHandler(model: self), name: "myftcNativeAuth")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
    }

    func beginNativeSignIn(provider: String, callback: String, source: URL) {
        guard !nativeAuthBusy else { notifyNativeSignInFinished(); return }
        guard provider == "google" else {
            finishNativeSignIn("This sign-in method is not available in the iPhone app yet. Open the MyFTCSpace website in your browser to use it.")
            return
        }
        guard websiteURL.scheme?.lowercased() == "https",
              isWebsiteOrigin(source), source.path == "/signin", webView.url == source,
              !webView.isLoading, isSafeReturnPath(callback) else {
            finishNativeSignIn("Sign-in requires the secure MyFTCSpace sign-in page. Open it and try again.")
            return
        }
        nativeAuthBusy = true
        let attempt = UUID()
        nativeAuthAttempt = attempt
        let generation = pageGeneration
        presentDialog("Continue with Google?", message: "A secure sign-in window will open.", ifUnavailable: { [weak self] in
            guard let self, self.nativeAuthAttempt == attempt else { return }
            self.finishNativeSignIn("The sign-in window could not be opened. Try again.")
        }) { [weak self] alert in
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { [weak self] _ in
                guard let self, self.nativeAuthAttempt == attempt else { return }
                self.finishNativeSignIn()
            })
            alert.addAction(UIAlertAction(title: "Continue", style: .default) { [weak self] _ in
                self?.startNativeAuthSession(provider: provider, callback: callback, source: source, generation: generation, attempt: attempt)
            })
        }
    }

    private func startNativeAuthSession(provider: String, callback: String, source: URL, generation: UInt, attempt: UUID) {
        guard nativeAuthAttempt == attempt else { return }
        guard nativeAuthBusy, pageGeneration == generation, webView.url == source else {
            finishNativeSignIn("Sign-in could not start. Return to the sign-in page and try again.")
            return
        }
        let script = """
        const response = await fetch('/ios/auth/snapshot', {credentials: 'same-origin', cache: 'no-store'});
        if (!response.ok) throw new Error('Could not prepare sign-in');
        const data = await response.json();
        return typeof data.snapshot === 'string' ? data.snapshot : null;
        """
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
            Task { @MainActor in
                guard let self, self.nativeAuthAttempt == attempt else { return }
                guard self.nativeAuthBusy, self.pageGeneration == generation, self.webView.url == source,
                      case let .success(value) = result, let snapshot = value as? String,
                      isAuthSnapshot(snapshot) else {
                    self.finishNativeSignIn("Could not prepare sign-in. Return to the sign-in page and try again.")
                    return
                }
                self.launchNativeAuthSession(provider: provider, callback: callback, source: source,
                                             generation: generation, attempt: attempt, snapshot: snapshot)
            }
        }
    }

    private func launchNativeAuthSession(provider: String, callback: String, source: URL, generation: UInt, attempt: UUID, snapshot: String) {
        guard nativeAuthAttempt == attempt else { return }
        guard nativeAuthBusy, pageGeneration == generation, webView.url == source,
              let anchor = webView.window, let state = randomAuthValue(), let verifier = randomAuthValue(),
              let start = URL(string: "/ios/auth/start", relativeTo: websiteURL)?.absoluteURL,
              isWebsiteOrigin(start), var components = URLComponents(url: start, resolvingAgainstBaseURL: false) else {
            finishNativeSignIn("Sign-in could not start. Return to the sign-in page and try again.")
            return
        }
        let challenge = base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        components.queryItems = [URLQueryItem(name: "provider", value: provider),
                                 URLQueryItem(name: "state", value: state),
                                 URLQueryItem(name: "challenge", value: challenge),
                                 URLQueryItem(name: "snapshot", value: snapshot),
                                 URLQueryItem(name: "callbackUrl", value: callback)]
        guard let startURL = components.url, isWebsiteOrigin(startURL) else {
            finishNativeSignIn("Sign-in could not start. Try again.")
            return
        }
        nativeAuthAnchor = anchor
        nativeAuthFlow = NativeAuthFlow(state: state, verifier: verifier, snapshot: snapshot, callback: callback, source: source, pageGeneration: generation)
        let session = ASWebAuthenticationSession(url: startURL, callbackURLScheme: nativeAuthScheme) { [weak self] url, error in
            Task { @MainActor in self?.completeNativeAuthSession(url: url, error: error, expectedState: state) }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = true
        nativeAuthSession = session
        guard session.start() else { finishNativeSignIn("The sign-in window could not be opened. Try again."); return }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        nativeAuthAnchor ?? ASPresentationAnchor()
    }

    private func completeNativeAuthSession(url: URL?, error: Error?, expectedState: String) {
        guard let flow = nativeAuthFlow, flow.state == expectedState else { return }
        nativeAuthSession = nil
        nativeAuthAnchor = nil
        if let error {
            let reported = error as NSError
            let cancelled = reported.domain == ASWebAuthenticationSessionErrorDomain &&
                reported.code == ASWebAuthenticationSessionError.Code.canceledLogin.rawValue
            finishNativeSignIn(cancelled ? nil : "Sign-in could not be completed. Try again.")
            return
        }
        guard let url, let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme == nativeAuthScheme, components.host == "complete", components.path == "/",
              components.user == nil, components.password == nil, components.port == nil, components.fragment == nil,
              let items = components.queryItems, items.count == 2,
              Set(items.map(\.name)) == Set(["state", "ticket"]),
              let state = items.first(where: { $0.name == "state" })?.value, state == flow.state,
              let ticket = items.first(where: { $0.name == "ticket" })?.value, isAuthValue(ticket),
              pageGeneration == flow.pageGeneration, webView.url == flow.source else {
            finishNativeSignIn("Sign-in could not be verified. Return to the sign-in page and try again.")
            return
        }
        redeemNativeTicket(ticket, flow: flow)
    }

    private func redeemNativeTicket(_ ticket: String, flow: NativeAuthFlow) {
        let script = """
        const response = await fetch('/api/auth/csrf', {credentials: 'same-origin', cache: 'no-store'});
        if (!response.ok) throw new Error('Could not prepare sign-in');
        const data = await response.json();
        return typeof data.csrfToken === 'string' ? data.csrfToken : null;
        """
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
            Task { @MainActor in
                guard let self, self.nativeAuthFlow?.state == flow.state else { return }
                guard self.pageGeneration == flow.pageGeneration, self.webView.url == flow.source,
                      case let .success(value) = result, let csrf = value as? String,
                      !csrf.isEmpty, csrf.count <= 512,
                      let url = URL(string: "/api/auth/callback/native-handoff", relativeTo: websiteURL)?.absoluteURL,
                      isWebsiteOrigin(url), let body = self.nativeAuthBody(csrf: csrf, ticket: ticket, flow: flow) else {
                    self.finishNativeSignIn("Could not finish sign-in. Return to the sign-in page and try again.")
                    return
                }
                var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
                request.httpMethod = "POST"
                request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
                request.httpBody = body
                guard self.webView.load(request) != nil else {
                    self.finishNativeSignIn("Could not finish sign-in. Please try again.")
                    return
                }
                self.finishNativeSignIn()
            }
        }
    }

    private func nativeAuthBody(csrf: String, ticket: String, flow: NativeAuthFlow) -> Data? {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        let fields = [("csrfToken", csrf), ("ticket", ticket), ("verifier", flow.verifier), ("snapshot", flow.snapshot), ("callbackUrl", flow.callback)]
        let encoded = fields.compactMap { pair -> String? in
            let (name, value) = pair
            guard let part = value.addingPercentEncoding(withAllowedCharacters: allowed) else { return nil }
            return "\(name)=\(part)"
        }
        guard encoded.count == fields.count else { return nil }
        return encoded.joined(separator: "&").data(using: .utf8)
    }

    private func notifyNativeSignInFinished() {
        guard let current = webView.url, isWebsiteOrigin(current) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new Event('myftc:native-auth-finished'))", completionHandler: nil)
    }

    private func finishNativeSignIn(_ message: String? = nil) {
        let pendingSession = nativeAuthSession
        nativeAuthFlow = nil
        nativeAuthSession = nil
        nativeAuthAnchor = nil
        nativeAuthBusy = false
        nativeAuthAttempt = nil
        pendingSession?.cancel()
        notifyNativeSignInFinished()
        if let message {
            presentDialog("Sign-in", message: message, ifUnavailable: {}) { alert in
                alert.addAction(UIAlertAction(title: "OK", style: .default))
            }
        }
    }

    func start() {
        if configurationError == nil && webView.url == nil && !webView.isLoading {
            webView.load(URLRequest(url: websiteURL))
        }
    }

    func retry() {
        guard configurationError == nil else { return }
        hasError = false
        if let failedURL { webView.load(URLRequest(url: failedURL)) }
        else if webView.url == nil { webView.load(URLRequest(url: websiteURL)) }
        else { webView.reload() }
    }

    func open(_ path: String) {
        guard configurationError == nil,
              let url = URL(string: path, relativeTo: websiteURL)?.absoluteURL,
              isWebsiteOrigin(url) else { return }
        if let currentURL = webView.url, isWebsiteOrigin(currentURL), currentURL.path == url.path, url.fragment == nil {
            webView.scrollView.setContentOffset(.zero, animated: true)
            return
        }
        guard let source = webView.url, isWebsiteOrigin(source) else {
            webView.load(URLRequest(url: url))
            return
        }
        webView.evaluateJavaScript("Boolean(document.querySelector('.app-shell, .standalone-lab'))") { [weak self] result, error in
            Task { @MainActor in
                guard let self, self.webView.url == source else { return }
                if error != nil || (result as? Bool) == true {
                    self.pendingURL = url
                    self.confirmingPageExit = true
                } else {
                    self.webView.load(URLRequest(url: url))
                }
            }
        }
    }

    func openSection(_ page: String, fallback: String) {
        guard ["home", "robotlab", "team"].contains(page),
              let source = webView.url, isWebsiteOrigin(source) else {
            open(fallback)
            return
        }
        let script = """
        (() => {
          const nav = document.querySelector('.app-shell select.mobile-navigation');
          if (!nav || !Array.from(nav.options).some(option => option.value === '\(page)')) return false;
          if (nav.value === '\(page)') {
            window.scrollTo({top: 0, behavior: 'smooth'});
          } else {
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
            if (!setter) return false;
            setter.call(nav, '\(page)');
            nav.dispatchEvent(new Event('change', {bubbles: true}));
          }
          return true;
        })();
        """
        webView.evaluateJavaScript(script) { [weak self] result, _ in
            Task { @MainActor in
                guard let self, self.webView.url == source else { return }
                if (result as? Bool) == true {
                    self.workspacePage = page
                } else {
                    self.open(fallback)
                }
            }
        }
    }

    func leavePage() {
        guard let url = pendingURL else { return }
        pendingURL = nil
        webView.load(URLRequest(url: url))
    }

    func stayOnPage() {
        pendingURL = nil
    }

    private func updateNavigation() {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        currentURL = webView.url
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        pageGeneration &+= 1
        if nativeAuthBusy { finishNativeSignIn() }
        isLoading = true
        hasError = false
        workspacePage = nil
        updateNavigation()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        hasLoadedPage = true
        hasError = false
        failedURL = nil
        updateNavigation()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failed(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failed(error)
    }

    private func failed(_ error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        isLoading = false
        failedURL = (error as NSError).userInfo[NSURLErrorFailingURLErrorKey] as? URL
        errorTitle = "Can’t reach MyFTCSpace"
        errorDescription = "Check your connection, then try again."
        hasError = true
        updateNavigation()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        isLoading = false
        failedURL = webView.url
        errorTitle = "Page stopped"
        errorDescription = "The page stopped unexpectedly. Try loading it again."
        hasError = true
        updateNavigation()
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, let scheme = url.scheme?.lowercased() else {
            decisionHandler(.cancel)
            return
        }
        if action.shouldPerformDownload {
            decisionHandler(.download)
        } else if action.navigationType == .linkActivated,
                  ["http", "https"].contains(scheme), !isWebsiteOrigin(url) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        } else if ["http", "https", "about", "blob", "data"].contains(scheme) {
            decisionHandler(.allow)
        } else {
            if ["mailto", "tel", "sms"].contains(scheme) {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(response.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let filename = URL(fileURLWithPath: suggestedFilename).lastPathComponent
            let destination = directory.appendingPathComponent(filename.isEmpty ? "Download" : filename)
            downloadLocations[ObjectIdentifier(download)] = destination
            completionHandler(destination)
        } catch {
            completionHandler(nil)
            showDownloadError("The file could not be saved. Please try again.")
        }
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloadLocations.removeValue(forKey: ObjectIdentifier(download)),
              let presenter = topPresenter() else { return }
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let popover = share.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        }
        presenter.present(share, animated: true)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloadLocations.removeValue(forKey: ObjectIdentifier(download))
        showDownloadError("The file could not be downloaded. \(error.localizedDescription)")
    }

    private func showDownloadError(_ message: String) {
        presentDialog("Download failed", message: message, ifUnavailable: {}) { alert in
            alert.addAction(UIAlertAction(title: "OK", style: .default))
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if action.targetFrame == nil { webView.load(action.request) }
        return nil
    }

    private func topPresenter() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
        var presenter = scene?.windows.first { $0.isKeyWindow }?.rootViewController
        while let next = presenter?.presentedViewController { presenter = next }
        return presenter
    }

    private func presentDialog(_ title: String?, message: String?, ifUnavailable: () -> Void,
                               configure: (UIAlertController) -> Void) {
        guard let presenter = topPresenter() else { ifUnavailable(); return }
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        configure(alert)
        presenter.present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        presentDialog(nil, message: message, ifUnavailable: completionHandler) { alert in
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        presentDialog(nil, message: message, ifUnavailable: { completionHandler(false) }) { alert in
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        }
    }
}

struct WebsiteView: View {
    @StateObject private var model = WebsiteModel()
    @State private var showingMore = false
    @State private var pendingMenuPath: String?
    @Environment(\.colorScheme) private var colorScheme

    private var selectedSection: String? {
        guard let url = model.currentURL, isWebsiteOrigin(url) else { return nil }
        if let page = model.workspacePage {
            if page == "home" { return "home" }
            if page == "robotlab" { return "lab" }
            if page == "team" { return "team" }
            return nil
        }
        switch model.currentURL?.path {
        case "/", "": return "home"
        case "/robot-lab": return "lab"
        case "/signin", "/enroll": return "team"
        default: return nil
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                WebsiteWebView(model: model)
                if model.isLoading && !model.hasLoadedPage && model.configurationError == nil {
                    VStack(spacing: 12) {
                        ProgressView().tint(.orange)
                        Text("Opening MyFTCSpace…").font(.subheadline).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(uiColor: .systemBackground))
                    .accessibilityElement(children: .combine)
                }
                if let error = model.configurationError {
                    ContentUnavailableView {
                        Label("Check the test address", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(uiColor: .systemBackground))
                } else if model.hasError {
                    ContentUnavailableView {
                        Label(model.errorTitle, systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(model.errorDescription)
                    } actions: {
                        Button("Try again") { model.retry() }.buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(uiColor: .systemBackground))
                }
            }
            .overlay(alignment: .top) {
                if model.isLoading {
                    ProgressView().tint(.orange).frame(maxWidth: .infinity)
                        .padding(.vertical, 3).background(.regularMaterial)
                }
            }
            Divider()
            HStack(spacing: 0) {
                navigationButton("Home", symbol: "house", section: "home") { model.openSection("home", fallback: "/") }
                navigationButton("Robot Lab", symbol: "gearshape.2", section: "lab") { model.openSection("robotlab", fallback: "/robot-lab") }
                navigationButton("Team", symbol: "person.2", section: "team") { model.openSection("team", fallback: "/signin") }
                navigationButton("More", symbol: "ellipsis", section: "more") { showingMore = true }
            }
            .padding(.top, 4)
            .background(.regularMaterial)
        }
        .sheet(isPresented: $showingMore, onDismiss: {
            if let path = pendingMenuPath {
                pendingMenuPath = nil
                model.open(path)
            }
        }) {
            NavigationStack {
                List {
                    Section("Explore") {
                        Button { openFromMenu("/review") } label: { Label("Try the demo", systemImage: "sparkles") }
                        Button { openFromMenu("/enroll") } label: { Label("Team setup", systemImage: "person.badge.plus") }
                        Button { openFromMenu("/#workspace-features") } label: { Label("About the workspace", systemImage: "info.circle") }
                        Button { openFromMenu("/privacy") } label: { Label("Privacy & data help", systemImage: "hand.raised") }
                        Button { openFromMenu("/maintenance") } label: { Label("Member help", systemImage: "questionmark.circle") }
                    }
                    Section("Navigation") {
                        Button { showingMore = false; model.webView.goBack() } label: { Label("Back", systemImage: "chevron.left") }
                            .disabled(!model.canGoBack)
                        Button { showingMore = false; model.webView.goForward() } label: { Label("Forward", systemImage: "chevron.right") }
                            .disabled(!model.canGoForward)
                        Button { showingMore = false; model.retry() } label: { Label("Reload page", systemImage: "arrow.clockwise") }
                    }
                }
                .navigationTitle("More")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showingMore = false } } }
            }
            .presentationDetents([.medium, .large])
        }
        .alert("Leave this page?", isPresented: $model.confirmingPageExit) {
            Button("Stay", role: .cancel) { model.stayOnPage() }
            Button("Leave page", role: .destructive) { model.leavePage() }
        } message: {
            Text("Unsaved work may be lost. Demo changes reset when you leave.")
        }
    }

    private func openFromMenu(_ path: String) {
        pendingMenuPath = path
        showingMore = false
    }

    private func navigationButton(_ title: String, symbol: String, section: String, action: @escaping () -> Void) -> some View {
        let selected = section == "more" ? showingMore : selectedSection == section
        return Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: selected && section == "home" ? "house.fill" : symbol)
                    .font(.system(size: 18, weight: selected ? .semibold : .regular))
                    .frame(width: 52, height: 27)
                    .background(selected ? (colorScheme == .dark ? Color.white.opacity(0.12) : Color(red: 0.96, green: 0.89, blue: 0.84)) : Color.clear, in: Capsule())
                Text(title).font(.caption2.weight(selected ? .semibold : .medium)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 54)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(selected ? (colorScheme == .dark ? Color(red: 1, green: 0.68, blue: 0.48) : Color(red: 0.72, green: 0.23, blue: 0.10)) : Color.secondary)
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct WebsiteWebView: UIViewRepresentable {
    @ObservedObject var model: WebsiteModel
    func makeUIView(context: Context) -> WKWebView {
        model.start()
        return model.webView
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
