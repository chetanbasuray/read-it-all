/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'puppeteer', 'playwright'];
    }
    return config;
  },
};

export default nextConfig;
