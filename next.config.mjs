/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    // Bundle native deps (ioredis, @clickhouse/client) into the standalone server
    serverComponentsExternalPackages: ["ioredis", "@clickhouse/client"],
  },
};
export default nextConfig;
