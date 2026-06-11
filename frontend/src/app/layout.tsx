'use client'

import { usePathname } from 'next/navigation'
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

// 不需要 AppShell（Sidebar + Header）的路由
const NO_SHELL_ROUTES = ['/login', '/admin']

function isNoShell(pathname: string | null): boolean {
  if (!pathname) return false
  return NO_SHELL_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const noShell = isNoShell(pathname)

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className={`font-sans${noShell ? ' auth-mode' : ''}`}>
        {noShell ? (
          children
        ) : (
          <div className="app">
            <Sidebar />
            <div className="main">
              <Header />
              <div className="content">{children}</div>
            </div>
          </div>
        )}
      </body>
    </html>
  )
}
