/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@arkiv-network/sdk",
      "@anthropic-ai/sdk",
      "viem"
    ],
  },
}
export default nextConfig
