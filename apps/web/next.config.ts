import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Next.js dev indicator (the 'N' logo in bottom-left)
  devIndicators: {
    position: 'bottom-right',
  },

  // !! WARN !!
  // Dangerously allow production builds to successfully complete even if
  // your project has type errors.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Warning: This allows production builds to successfully complete even if
  // your project has ESLint errors.
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config) => {
    // Suppress the "Serializing big strings" warning
    config.infrastructureLogging = {
      level: 'error',
    };
    return config;
  },
};

export default nextConfig;

