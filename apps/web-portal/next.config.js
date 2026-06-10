const path = require('path');

/** @type {import('next').NextConfig} */
const isDockerBuild = process.env['DOCKER_BUILD'] === 'true';

const nextConfig = {
  // standalone chỉ bật khi build trong Docker (tránh lỗi EPERM symlink trên Windows)
  output: isDockerBuild ? 'standalone' : undefined,
  experimental: isDockerBuild ? {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  } : {},
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
