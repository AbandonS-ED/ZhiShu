/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  reactStrictMode: true,
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    domains: ['localhost'],
    formats: ['image/webp'],
  },
  experimental: {
    optimizeCss: true,
  },
  async rewrites() {
    return []
  },
}

export default nextConfig
