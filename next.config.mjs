/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Vercel optimizations
  swcMinify: true,
  compress: true,
  // Handle serverless environment
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
  // Webpack config for serverless
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize packages that shouldn't be bundled
      config.externals = config.externals || [];
      config.externals.push({
        'pg-native': 'commonjs pg-native',
      });
    } else {
      // Client-side optimizations
      // Tree shaking for better bundle size
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
      };
    }
    return config;
  },
  // Compress output
  compress: true,
  // Optimize images
  images: {
    unoptimized: true, // Keep for now, optimize later
  },
}

export default nextConfig