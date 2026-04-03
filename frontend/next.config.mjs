/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@arkiv-network/sdk", "viem"],
  },
  // Allow importing from the backend src/ folder outside the Next.js root
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
