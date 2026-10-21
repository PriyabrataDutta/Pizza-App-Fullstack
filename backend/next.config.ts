import type { NextConfig } from "next";

// Sent with every response. The dashboard must never be shown inside another site's frame (clickjacking), browsers must not guess
// content types, and the address of a page must not leak to other sites. HSTS only matters over HTTPS, so it is production-only.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Dev only: lets a second origin (127.0.0.1) hold its own session cookie, for testing two roles side by side.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
