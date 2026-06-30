# 前端性能优化方案

## 问题分析

页面切换卡顿的主要原因：
1. **布局是客户端组件**：`layout.tsx` 标记为 `'use client'`，导致每次路由变化都重新渲染整个布局
2. **页面组件体积过大**：多个页面超过 500 行代码，加载和解析耗时
3. **大型依赖未按需加载**：`chart.js`、`lucide-react` 等大型库静态导入
4. **缺少 loading 状态**：页面切换时无加载指示，用户体验差

## 优化方案

### 1. 将 layout.tsx 改为服务器组件（最高优先级）

**当前问题**：
- `layout.tsx` 使用 `'use client'`，导致整个应用在客户端渲染
- 每次路由变化时 Sidebar 和 Header 都会重新渲染

**优化方案**：
```tsx
// src/app/layout.tsx - 服务器组件
import ClientShell from '@/components/layout/ClientShell'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
```

```tsx
// src/components/layout/ClientShell.tsx - 新建客户端组件
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
```

**预期效果**：减少 30-50% 的客户端 JavaScript，加快初始加载

### 2. 大型依赖动态导入

**当前问题**：
- `chart.js` 和 `react-chartjs-2` 在 `profile/page.tsx` 中静态导入
- `mermaid` 已动态导入，但其他大型库未优化

**优化方案**：

#### 2.1 动态导入 chart.js 组件
```tsx
// src/app/profile/page.tsx
import dynamic from 'next/dynamic'

// 动态导入 Radar 图表
const RadarChart = dynamic(() => import('./components/RadarChart'), {
  loading: () => <div className="skeleton" style={{ width: 320, height: 320, borderRadius: '50%' }} />,
  ssr: false
})

// 原有的静态导入可以移除
// import { Chart as ChartJS, RadialLinearScale, ... } from 'chart.js'
// import { Radar } from 'react-chartjs-2'
```

#### 2.2 创建独立的图表组件
```tsx
// src/app/profile/components/RadarChart.tsx
'use client'

import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { Radar } from 'react-chartjs-2'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function RadarChart({ scores, size = 340 }: { scores: Record<string, number>; size?: number }) {
  // ... 原有 RadarChart 组件代码
}
```

**预期效果**：减少初始包大小 50%+，加快页面加载

### 3. 图标优化

**当前问题**：
- `lucide-react` 在 `profile/page.tsx` 中静态导入 13 个图标
- 项目已有自定义 `Icon` 组件，但未完全替代 lucide-react

**优化方案**：

#### 3.1 使用项目自有的 Icon 组件替代 lucide-react
```tsx
// 替换前
import { Brain, BookOpen, Wrench, Sparkles, Target, ArrowRight, Send, X, ChevronRight, ChevronDown, Award, RefreshCw, Info, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

// 替换后
import Icon from '@/components/Icon'
import RobotIcon from '@/components/RobotIcon'

// 使用方式
<Icon name="brain" size={18} />
<Icon name="book" size={18} />
<RobotIcon size={18} />
```

#### 3.2 扩展 Icon 组件支持更多图标
```tsx
// src/components/Icon.tsx - 添加缺失的图标
const ICONS = {
  // ... 现有图标
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  x: 'M18 6L6 18M6 6l12 12',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  award: 'M12 15l-3.5 2 .67-3.89L6 9.11l3.92-.57L12 5l2.08 3.54 3.92.57-2.83 2.76.67 3.89z',
  refreshCw: 'M23 4v6h-6M1 20v-6h6',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 15v-4m0-4h.01',
  trendingUp: 'M23 6l-9.5 9.5-5-5L1 18',
  alertTriangle: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zm0 12h.01M12 9v4',
  checkCircle: 'M22 11.08V12a10 10 0 11-5.93-9.14',
  xCircle: 'M12 2a10 10 0 100 20 10 10 0 000-20zm4 8l-4 4-4-4',
}
```

**预期效果**：减少 20-30% 的图标库大小，统一图标风格

### 4. 添加 loading.tsx 和 error.tsx

**当前问题**：
- 页面切换时无加载指示，用户感觉卡顿
- 缺少错误边界，页面崩溃无提示

**优化方案**：

#### 4.1 添加全局 loading 组件
```tsx
// src/app/loading.tsx
export default function Loading() {
  return (
    <div className="page-loading">
      <div className="loading-spinner" />
      <span>加载中...</span>
    </div>
  )
}
```

#### 4.2 为每个页面添加 loading.tsx
```tsx
// src/app/duihua/loading.tsx
export default function DuihuaLoading() {
  return (
    <div className="chat-page-loading">
      <div className="skeleton-card">
        <div className="skeleton skeleton-line w60" style={{ height: 20 }} />
        <div className="skeleton skeleton-line w100" />
        <div className="skeleton skeleton-line w80" />
      </div>
    </div>
  )
}
```

#### 4.3 添加 error.tsx
```tsx
// src/app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="error-page">
      <h2>出错了</h2>
      <p>{error.message || '页面加载失败'}</p>
      <button onClick={reset}>重试</button>
    </div>
  )
}
```

**预期效果**：改善用户体验，减少布局偏移

### 5. Next.js 配置优化

**当前问题**：
- 配置简单，缺少优化选项
- 未启用压缩和优化

**优化方案**：
```js
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 SWC 压缩
  swcMinify: true,
  
  // 启用 React 严格模式
  reactStrictMode: true,
  
  // 优化 CSS
  experimental: {
    optimizeCss: true,
  },
  
  // 图片优化
  images: {
    domains: ['localhost'],
    formats: ['image/webp'],
  },
  
  // 压缩
  compress: true,
  
  // 生产环境移除 console.log
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  async rewrites() {
    return []
  },
}

export default nextConfig
```

**预期效果**：减少 10-20% 的包大小，加快构建速度

## 实施顺序

### 第一阶段（立即实施）
1. ✅ 将 layout.tsx 改为服务器组件
2. ✅ 添加 loading.tsx 和 error.tsx
3. ✅ 优化 Next.js 配置

### 第二阶段（1-2天）
4. ✅ 动态导入 chart.js 组件
5. ✅ 优化图标导入

### 第三阶段（可选）
6. ✅ 页面组件拆分
7. ✅ 添加 React.memo 优化

## 预期效果总结

| 优化方案 | 预期改善 | 实施难度 |
|---------|---------|---------|
| layout 改为服务器组件 | 减少 30-50% 客户端 JS | 中等 |
| 动态导入大型依赖 | 减少 50%+ 初始包大小 | 简单 |
| 图标优化 | 减少 20-30% 图标库大小 | 简单 |
| 添加 loading 状态 | 改善用户体验 | 简单 |
| Next.js 配置优化 | 减少 10-20% 包大小 | 简单 |

## 验证方法

1. **构建分析**：运行 `npm run build` 查看构建输出
2. **性能测试**：使用 Lighthouse 测试页面性能
3. **用户体验**：手动测试页面切换流畅度
4. **包大小**：使用 `@next/bundle-analyzer` 分析包大小

## 6. 数据获取优化（额外优化）

**当前问题**：
- `duihua/page.tsx` 有 7 个 `useEffect`，其中 4 个并行发起 API 请求
- 每次请求完成都触发重渲染，导致多次渲染

**优化方案**：

#### 6.1 合并数据获取
```tsx
// 优化前：4 个独立的 useEffect
useEffect(() => { chatApi.getSessions(studentId).then(setSessions) }, [studentId])
useEffect(() => { profileApi.getMe().then(setProfile) }, [studentId])
useEffect(() => { resourceApi.list(studentId).then(setDbResources) }, [studentId])
useEffect(() => { chatApi.recommendQuestions(...).then(setSuggestions) }, [studentId])

// 优化后：合并为 1 个 useEffect
useEffect(() => {
  const loadData = async () => {
    try {
      const [sessions, profile, resources, suggestions] = await Promise.all([
        chatApi.getSessions(studentId),
        profileApi.getMe(),
        resourceApi.list(studentId),
        chatApi.recommendQuestions(sessionId ?? undefined, 4)
      ])
      setSessions(sessions)
      setProfile(profile)
      setDbResources(resources)
      setSuggestions(suggestions.questions)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }
  loadData()
}, [studentId])
```

**预期效果**：减少重渲染次数，加快数据加载

## 7. CSS 优化（额外优化）

**当前问题**：
- `globals.css` 有 1727 行，包含所有页面样式
- 首次加载时需要解析所有 CSS

**优化方案**：

#### 7.1 CSS 按页面拆分
```
src/app/
├── globals.css          # 基础样式（保留）
├── duihua/
│   └── styles.css       # 对话页样式
├── profile/
│   └── styles.css       # 画像页样式
└── resources/
    └── styles.css       # 资源页样式
```

#### 7.2 使用 CSS Modules
```tsx
// 替换全局 CSS
import styles from './styles.module.css'

// 使用
<div className={styles.chatPage}>
```

**预期效果**：减少初始 CSS 大小，加快首屏渲染

## 8. 预加载优化（额外优化）

**当前问题**：
- 用户点击链接后才开始加载页面
- 没有利用 Next.js 的预取功能

**优化方案**：

#### 8.1 启用 Next.js 自动预取
```tsx
// Next.js 默认会预取 Link 组件的页面
// 确保使用 next/link 而不是 <a> 标签
import Link from 'next/link'

<Link href="/duihua">智能对话</Link>
```

#### 8.2 手动预取关键页面
```tsx
// src/components/layout/Sidebar.tsx
import { useRouter } from 'next/navigation'

export default function Sidebar() {
  const router = useRouter()
  
  // 预取关键页面
  useEffect(() => {
    router.prefetch('/duihua')
    router.prefetch('/profile')
    router.prefetch('/resources')
  }, [router])
}
```

**预期效果**：页面切换更快，减少等待时间

## 9. 字体优化（额外优化）

**当前问题**：
- 使用本地字体文件，可能加载慢
- 字体加载可能阻塞渲染

**优化方案**：

#### 9.1 字体预加载
```tsx
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          href="/fonts/GeistVF.woff"
          as="font"
          type="font/woff"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

#### 9.2 字体显示策略
```tsx
// next/font/local 已经有 display: 'swap'
// 确保字体加载时使用备用字体
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  display: 'swap', // 已有，确保字体加载不阻塞
})
```

**预期效果**：字体加载更快，减少布局偏移

## 10. 内存优化（额外优化）

**当前问题**：
- 大型组件可能占用大量内存
- 可能存在内存泄漏

**优化方案**：

#### 10.1 使用 React.memo
```tsx
// 对纯展示组件使用 memo
import { memo } from 'react'

const MessageBubble = memo(({ message }) => {
  return <div className="bubble">{message.content}</div>
})
```

#### 10.2 清理副作用
```tsx
// 确保清理定时器、事件监听等
useEffect(() => {
  const timer = setInterval(() => { ... }, 1000)
  
  return () => {
    clearInterval(timer) // 清理
  }
}, [])
```

**预期效果**：减少内存占用，避免内存泄漏

## 11. API 请求缓存（额外优化）

**当前问题**：
- `getStudentId()` 被调用 42 次，每次都读取 localStorage 并解析 JSON
- 没有请求缓存机制，相同数据可能重复请求
- 项目已安装 `swr` 但未使用

**优化方案**：

#### 11.1 缓存 getStudentId
```tsx
// src/lib/student.ts
let cachedStudentId: string | null = null

export function getStudentId(): string {
  // 如果已缓存，直接返回
  if (cachedStudentId !== null) return cachedStudentId
  
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(LOGIN_KEY)
    if (raw) {
      const student = JSON.parse(raw)
      if (student?.id) {
        cachedStudentId = student.id
        return student.id
      }
    }
  } catch {}
  return ''
}

// 登录/登出时清除缓存
export function clearStudentIdCache() {
  cachedStudentId = null
}
```

#### 11.2 使用 SWR 缓存 API 请求
```tsx
// src/app/duihua/page.tsx
import useSWR from 'swr'
import { chatApi } from '@/lib/api'

export default function DuihuaPage() {
  const studentId = getStudentId()
  
  // 使用 SWR 缓存会话列表
  const { data: sessions } = useSWR(
    studentId ? ['sessions', studentId] : null,
    () => chatApi.getSessions(studentId)
  )
  
  // 使用 SWR 缓存画像
  const { data: profile } = useSWR(
    studentId ? ['profile', studentId] : null,
    () => profileApi.getMe()
  )
}
```

**预期效果**：减少重复请求，加快数据加载

## 12. Bundle 优化（额外优化）

**当前问题**：
- 不清楚哪些库占用了最多空间
- 可能有未使用的依赖

**优化方案**：

#### 12.1 安装 bundle 分析器
```bash
npm install -D @next/bundle-analyzer
```

#### 12.2 配置分析器
```js
// next.config.mjs
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  // ... 其他配置
}

module.exports = withBundleAnalyzer(nextConfig)
```

#### 12.3 运行分析
```bash
ANALYZE=true npm run build
```

#### 12.4 清理未使用的依赖
```bash
# 检查未使用的依赖
npx depcheck

# 移除未使用的依赖
npm uninstall <unused-package>
```

**预期效果**：减少包大小，加快加载

## 13. 预渲染优化（额外优化）

**当前问题**：
- 所有页面都是客户端渲染
- 首屏加载需要等待 JavaScript 下载和执行

**优化方案**：

#### 13.1 静态生成简单页面
```tsx
// src/app/page.tsx - 仪表盘可以静态生成
export const dynamic = 'force-static'

export default function Home() {
  // ...
}
```

#### 13.2 动态导入重型组件
```tsx
// 对于需要客户端渲染的页面，延迟加载重型组件
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false
})
```

**预期效果**：加快首屏加载，改善 SEO

## 14. Service Worker 缓存（额外优化）

**当前问题**：
- 没有离线缓存策略
- 重复访问需要重新下载资源

**优化方案**：

#### 14.1 添加 PWA 支持
```bash
npm install next-pwa
```

#### 14.2 配置 Service Worker
```js
// next.config.mjs
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})

module.exports = withPWA({
  // ... 其他配置
})
```

#### 14.3 创建 manifest.json
```json
// public/manifest.json
{
  "name": "智枢 SmartHub",
  "short_name": "智枢",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f5f5f4",
  "theme_color": "#1c1917"
}
```

**预期效果**：离线可用，重复访问更快

## 15. 性能监控（额外优化）

**当前问题**：
- 没有性能监控，无法量化优化效果
- 不知道哪些页面最慢

**优化方案**：

#### 15.1 添加 Web Vitals 监控
```tsx
// src/app/layout.tsx
import { reportWebVitals } from 'next/web-vitals'

export function reportWebVitals(metric) {
  console.log(metric)
  // 可以发送到分析服务
}
```

#### 15.2 使用 Lighthouse CI
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/duihua
            http://localhost:3000/profile
```

**预期效果**：量化性能，持续监控

## 16. 长列表虚拟化（额外优化）

**当前问题**：
- 多个页面使用 `.map()` 渲染长列表（消息列表、题库、资源列表等）
- 没有使用虚拟列表，列表很长时性能下降

**优化方案**：

#### 16.1 安装虚拟列表库
```bash
npm install react-window
npm install -D @types/react-window
```

#### 16.2 虚拟化长列表
```tsx
// src/app/duihua/page.tsx - 消息列表
import { FixedSizeList as List } from 'react-window'

const MessageList = ({ messages }) => (
  <List
    height={600}
    itemCount={messages.length}
    itemSize={80}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <MessageBubble message={messages[index]} />
      </div>
    )}
  </List>
)
```

#### 16.3 需要虚拟化的页面
- `duihua/page.tsx` - 消息列表
- `tiku/page.tsx` - 题库列表
- `resources/page.tsx` - 资源列表
- `admin/chats/page.tsx` - 对话记录

**预期效果**：长列表渲染性能提升 10x+

## 17. 防抖和节流（额外优化）

**当前问题**：
- 搜索输入没有防抖，每次输入都触发请求
- 滚动事件没有节流，频繁触发

**优化方案**：

#### 17.1 安装 lodash
```bash
npm install lodash
npm install -D @types/lodash
```

#### 17.2 搜索防抖
```tsx
// src/app/resources/page.tsx
import { debounce } from 'lodash'

const debouncedSearch = debounce((query: string) => {
  // 搜索逻辑
  filterResources(query)
}, 300)

const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
  const query = e.target.value
  setSearchQuery(query)  // 立即更新 UI
  debouncedSearch(query) // 防抖搜索
}
```

#### 17.3 滚动节流
```tsx
// src/app/duihua/page.tsx
import { throttle } from 'lodash'

const throttledScroll = throttle(() => {
  // 滚动处理逻辑
  checkScrollPosition()
}, 100)

useEffect(() => {
  const container = msgsRef.current
  if (container) {
    container.addEventListener('scroll', throttledScroll)
    return () => container.removeEventListener('scroll', throttledScroll)
  }
}, [])
```

**预期效果**：减少不必要的请求和计算

## 18. 动画性能优化（额外优化）

**当前问题**：
- 大量 CSS 动画（100+ 处使用 transition/animation）
- 某些动画可能触发重排（layout thrashing）

**优化方案**：

#### 18.1 使用 transform 和 opacity
```css
/* 避免触发重排 */
.bad {
  width: 100px;
  height: 100px;
  left: 0;
  top: 0;
  transition: left 0.3s, top 0.3s; /* 触发重排 */
}

.good {
  transform: translate(0, 0);
  transition: transform 0.3s; /* 只触发合成 */
}
```

#### 18.2 使用 will-change 提示浏览器
```css
.animated-element {
  will-change: transform, opacity;
}
```

#### 18.3 使用 GPU 加速
```css
.gpu-accelerated {
  transform: translateZ(0); /* 触发 GPU 加速 */
  backface-visibility: hidden;
}
```

#### 18.4 减少动画数量
```tsx
// 对于不需要动画的元素，移除 transition
const staticStyle = {
  transition: 'none' // 禁用动画
}
```

**预期效果**：动画更流畅，减少掉帧

## 19. 事件处理优化（额外优化）

**当前问题**：
- 某些事件处理函数在每次渲染时重新创建
- 可能存在不必要的事件监听

**优化方案**：

#### 19.1 使用 useCallback 缓存事件处理
```tsx
// 优化前
const handleClick = () => {
  // 处理逻辑
}

// 优化后
const handleClick = useCallback(() => {
  // 处理逻辑
}, [dependencies])
```

#### 19.2 使用 useMemo 缓存计算结果
```tsx
// 优化前
const filteredItems = items.filter(item => item.active)

// 优化后
const filteredItems = useMemo(() => 
  items.filter(item => item.active),
  [items]
)
```

#### 19.3 事件委托
```tsx
// 优化前：每个按钮都绑定事件
{items.map(item => (
  <button onClick={() => handleDelete(item.id)}>删除</button>
))}

// 优化后：使用事件委托
<div onClick={(e) => {
  const target = e.target as HTMLElement
  if (target.matches('[data-delete]')) {
    const id = target.dataset.delete
    handleDelete(id)
  }
}}>
  {items.map(item => (
    <button data-delete={item.id}>删除</button>
  ))}
</div>
```

**预期效果**：减少内存占用，提高事件处理效率

## 注意事项

1. **备份代码**：实施前备份当前代码
2. **逐步实施**：按优先级逐步实施，每步测试
3. **兼容性测试**：确保优化后功能正常
4. **性能监控**：实施后监控性能变化

## 相关文件

- `src/app/layout.tsx` - 主布局文件
- `src/components/layout/ClientShell.tsx` - 新建客户端外壳
- `src/components/Icon.tsx` - 图标组件
- `src/app/profile/components/RadarChart.tsx` - 新建图表组件
- `next.config.mjs` - Next.js 配置文件
- `src/app/loading.tsx` - 全局 loading
- `src/app/error.tsx` - 全局错误处理
