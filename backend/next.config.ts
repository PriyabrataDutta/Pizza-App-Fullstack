import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a second origin (127.0.0.1) hold its own session cookie, for testing two roles side by side.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
