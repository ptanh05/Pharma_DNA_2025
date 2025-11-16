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
    serverComponentsExternalPackages: ['pg', '@cityofzion/neon-core'],
  },
  // Webpack config for serverless
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize packages that shouldn't be bundled
      config.externals = config.externals || [];
      config.externals.push({
        'pg-native': 'commonjs pg-native',
      });
    }
    return config;
  },
}

export default nextConfig