import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppress Recharts defaultProps warnings in React 19
  reactStrictMode: true,
  // Allow cross-origin for dev
  allowedDevOrigins: ["localhost"],
};

export default nextConfig;
