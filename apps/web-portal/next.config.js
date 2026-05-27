const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trace files from monorepo root so shared packages are included in the standalone bundle.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  reactStrictMode: true,
  output: 'standalone',
};

module.exports = nextConfig;
