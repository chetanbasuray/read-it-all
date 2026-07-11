/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'playwright', 'jsdom'];
    }
    return config;
  },
};

export default nextConfig;
