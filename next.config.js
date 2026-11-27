/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['nodemailer'],
  images: { unoptimized: true },
  webpack: (config) => {
    config.module = config.module || {};
    config.module.exprContextCritical = false;
    // Disable persistent/memory webpack cache on Windows/OneDrive to prevent stale module factory crashes
    config.cache = false;
    return config;
  },
};

module.exports = nextConfig;

