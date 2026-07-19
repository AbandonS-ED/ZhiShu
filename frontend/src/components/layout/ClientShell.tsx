'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import { Header } from './Header'

const NO_SHELL_ROUTES = ['/login', '/admin']

function isNoShell(pathname: string | null): boolean {
  if (!pathname) return false
  return NO_SHELL_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const noShell = isNoShell(pathname)

  return noShell ? (
    <>{children}</>
  ) : (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Header />
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
