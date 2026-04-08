/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverExternalPackages: [
      "@arkiv-network/sdk",
      "@anthropic-ai/sdk",
      "viem",
      "dotenv"
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push(
          "@arkiv-network/sdk",
          "@anthropic-ai/sdk",
          "viem",
          "dotenv"
        )
      }
    }
    return config
  },
}

export default nextConfig
