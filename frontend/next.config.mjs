/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
    // optimizeCss: true, // 暂关闭:experimental 功能,与当前 webpack 构建冲突,导致 layout.css 500
  },
  async rewrites() {
    return []
  },
}

export default nextConfig
