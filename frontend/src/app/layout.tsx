import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

// 使用项目自带的本地 Geist 字体（无需网络，避免 Google Fonts SSL 失败）
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '智学 - 多智能体学习资源生成系统',
  description: '基于多智能体协作的自适应学习资源生成平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className={geistSans.variable}>
      <body className="font-sans">
        <div className="min-h-screen bg-gray-50">
          <Sidebar />
          <Header />
          <main className="ml-64 pt-16">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
