import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '智枢 SmartHub — 登录',
  description: '多智能体个性化学习资源生成系统',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
