/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverComponentsExternalPackages: ['nodemailer'],
  },
  images: { unoptimized: true },
  webpack: (config, { dev }) => {
    config.module = config.module || {};
    config.module.exprContextCritical = false;
    // Disable persistent/memory webpack cache in dev on Windows/OneDrive to prevent stale module factory crashes
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;

