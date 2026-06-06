import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

// 使用项目自带的本地 Geist 字体（国内 Google Fonts 不可达）
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
  title: '智学 ZhiShu',
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
        <div
          style={{
            display: 'flex',
            height: '100vh',
            overflow: 'hidden',
          }}
        >
          <Sidebar />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            <Header />
            <main
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '28px 32px 40px',
              }}
            >
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
