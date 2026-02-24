/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  compress: true,
  experimental: {
    // Next.js 14: serverExternalPackages nằm trong experimental
    serverComponentsExternalPackages: ['pg', 'pg-native'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'pg-native': 'commonjs pg-native',
      });
    }
    return config;
  },
}

export default nextConfig