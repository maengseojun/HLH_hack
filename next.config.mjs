/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure Next.js treats the project root as this directory
  outputFileTracingRoot: process.cwd(),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_API_PROXY_TARGET || 'http://localhost:3001';
    return [
      { source: '/v1/:path*', destination: `${target}/v1/:path*` },
      { source: '/health', destination: `${target}/health` },
    ];
  },
  async redirects() {
    return [
      { source: '/index', destination: '/indexes', permanent: false },
    ];
  },
};

export default nextConfig;
