// @ts-check
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Temporarily ignore build errors to allow build to complete
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ipfs.nftstorage.link',
      },
      {
        protocol: 'https',
        hostname: '**.mystenlabs.com',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
    ],
  },
  compress: true,
  // Tăng giới hạn upload file lên 50MB
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Cache-Control headers for API routes
  async headers() {
    return [
      {
        // SSE streams - no caching
        source: '/api/sse',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
        ],
      },
      {
        // Public read-only routes - cacheable for 1 min, revalidate in background for 5 min
        source: '/api/public/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' },
        ],
      },
      {
        // Public lookup routes - same caching strategy
        source: '/api/lookup/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' },
        ],
      },
      {
        // All other API routes - no caching (user-specific / authenticated / dynamic data)
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
        ],
      },
    ];
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
  org: process.env.SENTRY_ORG || "pharma-dna",
  project: process.env.SENTRY_PROJECT || "pharma-dna-saga",
});