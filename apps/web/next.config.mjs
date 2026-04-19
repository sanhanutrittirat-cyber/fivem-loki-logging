/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
    return [
      { source: "/api/logs",         destination: `${api}/api/logs` },
      { source: "/api/autocomplete", destination: `${api}/api/autocomplete` },
      { source: "/api/stats/:path*", destination: `${api}/api/stats/:path*` },
      { source: "/api/stream",       destination: `${api}/api/stream` },
    ];
  },
};
export default nextConfig;
