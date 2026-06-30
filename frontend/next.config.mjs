/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 SWC 压缩
  swcMinify: true,
  
  // 启用 React 严格模式
  reactStrictMode: true,
  
  // 压缩
  compress: true,
  
  // 生产环境移除 console.log
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // 图片优化
  images: {
    domains: ['localhost'],
    formats: ['image/webp'],
  },
  
  // 实验性功能
  experimental: {
    // 优化 CSS
    optimizeCss: true,
  },
  
  async rewrites() {
    return []
  },
}

export default nextConfig
