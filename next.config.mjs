/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  compress: true,
  // Next.js 16: serverExternalPackages ở top level
  serverExternalPackages: ['pg', 'pg-native'],
  // Turbopack config - để trống để dùng default
  turbopack: {},
}

export default nextConfig