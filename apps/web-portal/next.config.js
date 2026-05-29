const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  reactStrictMode: true,

  // Proxy /api/* sang server khi dev local (tránh CORS)
  // Set API_BASE_URL=http://192.168.100.55 trong .env.local
  async rewrites() {
    const apiBase = process.env.API_BASE_URL;
    console.log('[next.config] API_BASE_URL =', apiBase ?? '(not set)');
    if (!apiBase) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;