/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  // Leave heavy server-only packages unbundled so Next.js doesn't try to
  // pack them through webpack. jsdom + Readability are large and contain
  // dynamic requires that don't bundle cleanly.
  experimental: {
    serverComponentsExternalPackages: ['@mozilla/readability', 'jsdom'],
  },
};

module.exports = nextConfig;
