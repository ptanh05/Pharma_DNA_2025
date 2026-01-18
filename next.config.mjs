/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Vercel optimizations
  compress: true,
  // Handle serverless environment - moved from experimental in Next.js 16
  serverExternalPackages: ['pg', 'pg-native'],
  // Turbopack config (Next.js 16 uses Turbopack by default)
  turbopack: {},
  // Webpack config for serverless (fallback if not using Turbopack)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize packages that shouldn't be bundled
      config.externals = config.externals || [];
      config.externals.push({
        'pg-native': 'commonjs pg-native',
      });
    }
    // Tree shaking is handled automatically by Next.js
    return config;
  },
}

export default nextConfig