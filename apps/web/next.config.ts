import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Next.js dev indicator (the 'N' logo in bottom-left)
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
};

export default nextConfig;

