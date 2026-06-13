/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  // Don't bundle these packages — they include ESM-only files (e.g.
  // @exodus/bytes inside google-news-url-decoder) which crash at runtime
  // when require()'d by Next.js's default CommonJS bundling. Letting Node
  // resolve them itself at runtime keeps ESM/CJS interop correct.
  experimental: {
    serverComponentsExternalPackages: [
      'google-news-url-decoder',
      '@mozilla/readability',
      'jsdom',
      '@vercel/kv',
    ],
  },
};

module.exports = nextConfig;
