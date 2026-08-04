/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'playwright', 'playwright-core', '@sparticuz/chromium', 'jsdom'];
    }
    return config;
  },
};

export default nextConfig;
