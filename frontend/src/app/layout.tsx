import localFont from 'next/font/local'
import './globals.css'
import ClientShell from '@/components/layout/ClientShell'

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
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
