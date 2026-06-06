import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

// 本地字体（国内 Google Fonts 不可达）
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '智枢 SmartHub',
  description: '多智能体学习资源生成系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="font-sans">
        <div className="app">
          <Sidebar />
          <div className="main">
            <Header />
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  )
}
