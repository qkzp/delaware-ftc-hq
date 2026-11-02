import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'" },
      ],
    },{source:"/static-cache-sw.js",headers:[{key:"Cache-Control",value:"no-cache, must-revalidate"},{key:"Service-Worker-Allowed",value:"/"}]},{source:"/fonts/:path*",headers:[{key:"Cache-Control",value:"public, max-age=86400"}]},{source:"/favicon.svg",headers:[{key:"Cache-Control",value:"public, max-age=86400"}]}];
  },
};

export default nextConfig;
