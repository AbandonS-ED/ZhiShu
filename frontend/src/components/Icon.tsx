'use client'

const ICONS = {
  check: 'M20 6L9 17l-5-5',
  close: 'M18 6L6 18M6 6l12 12',
  book: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15zM8 7h8M8 11h6',
  edit: 'M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  lightbulb: 'M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14',
  brain: 'M12 2a7 7 0 00-4.5 12.5A4 4 0 007 18h10a4 4 0 00-.5-3.5A7 7 0 0012 2zM9 12h6M10 7h4',
  map: 'M3 7v14l6-3 6 3 6-3V3l-6 3-6-3-6 3zM9 4v13M15 7v13',
  play: 'M5 3l14 9-14 9V3z',
  refresh: 'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15',
  doc: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M12 18v-6M9 15h6',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  target: 'M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm0-14a6 6 0 106 6 6 6 0 00-6-6zm0 8a2 2 0 112-2 2 2 0 01-2 2z',
  clock: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm4-8h-4V7',
  clipboard: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M8 2h8v4H8V2zm0 10h8M8 14h8M8 16h8',
  trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
  chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  search: 'M14 14l4 4M10 18a8 8 0 100-16 8 8 0 000 16z',
  warning: 'M12 2L2 22h20L12 2zm0 14h0m0-8v6',
  inbox: 'M22 12h-6l-2 3H10l-2-3H2m0 0v6a2 2 0 002 2h16a2 2 0 002-2v-6M7 7l5-4 5 4M12 3v8',
  audio: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z',
  review: 'M21 12a9 9 0 01-15 6.5M3 12a9 9 0 0115-6.5M9 12l2 2 4-4M3 4v6h6M21 20v-6h-6',
  cold: 'M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  unchecked: 'M3 3h18v18H3V3zm0 0v18h18V3H3z',
  point: 'M7 21l4-12M17 21V9M12 3l-5 6h10l-5-6z',
  save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8',
  bookOpen: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z',
  idea: 'M12 2a6 6 0 00-6 6c0 2.5 1.5 4.5 3 5.5V16h6v-2.5c1.5-1 3-3 3-5.5a6 6 0 00-6-6zM10 20h4',
  robot: 'M9 3h6v2h4a2 2 0 012 2v4a2 2 0 01-2 2h-1v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6H5a2 2 0 01-2-2V7a2 2 0 012-2h4V3zM8 10a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zm-8 5c1.5 1.5 4.5 1.5 6 0',
  // 新增图标
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 15v-4m0-4h.01',
  trendingUp: 'M23 6l-9.5 9.5-5-5L1 18',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  award: 'M12 15l-3.5 2 .67-3.89L6 9.11l3.92-.57L12 5l2.08 3.54 3.92.57-2.83 2.76.67 3.89z',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  sparkles: 'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z',
  wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  checkCircle: 'M22 11.08V12a10 10 0 11-5.93-9.14',
  xCircle: 'M12 2a10 10 0 100 20 10 10 0 000-20zm4 8l-4 4-4-4',
  alertTriangle: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zm0 12h.01M12 9v4',
}

export type IconName = keyof typeof ICONS

interface IconProps {
  name: IconName | string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function Icon({ name, size = 18, className = '', style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d={ICONS[name as IconName] || ''} />
    </svg>
  )
}
