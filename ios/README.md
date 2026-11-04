# MyFTCSpace for iPhone

Open `MyFTCSpace.xcodeproj` in Xcode and select an iPhone simulator. The app loads the live site at `https://delaware-ftc-hq.vercel.app/` inside WebKit. For a real iPhone, select an Apple development team in Signing & Capabilities and connect the device.

`MyFTCSpace/WebsiteView.swift` contains the iPhone navigation and web view. `MyFTCSpace/iPhone.css` contains the phone layout applied only to the MyFTCSpace website inside this app. The website source is in the repository root (`../`); changing these iOS files requires rebuilding the app in Xcode.

The bottom tabs use the website's existing mobile workspace navigation when a team workspace is open, so switching between Home, Robot Lab, and Team keeps the current workspace session. The iPhone layout and navigation depend on the website's current markup; check them after website navigation changes.

Links tapped to other websites open in the system browser; downloads use the iOS share sheet. If a page fails to load or the web process stops, the app offers a retry. These features still depend on the website and the network being available.

For Debug runs, set the `MYFTC_BASE_URL` environment variable in Xcode's Run scheme to an HTTPS preview site or a local development address such as `http://192.168.1.42:3000`. The app applies its iPhone styles only to that selected origin. Local HTTP and local-network permissions are configured in `Info-Debug.plist` only; Release builds use the live HTTPS site and `Info.plist`. For a local test, run the website development server on a trusted network and use the Mac or Windows computer’s local IP address; `localhost` on a physical iPhone refers to the phone itself. HTTP is unencrypted, so use fictional test data.

The web app's account providers, email sign-in links, exports and other external flows still require verification in the app. Embedded web views may be rejected by identity providers, including Google; a production release may require a system-browser authentication flow and changes to the website.
