export default function RobotIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
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
    >
      {/* 天线 */}
      <line x1="12" y1="1" x2="12" y2="4" />
      <circle cx="12" cy="1" r="0.8" fill="currentColor" stroke="none" />

      {/* 脑袋 — 扁圆角矩形 */}
      <rect x="4" y="5" width="16" height="12" rx="4" />

      {/* 左眼 */}
      <circle cx="9" cy="11" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="10.5" r="0.5" fill="white" stroke="none" />

      {/* 右眼 */}
      <circle cx="15" cy="11" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="0.5" fill="white" stroke="none" />

      {/* 嘴巴 — 微笑弧线 */}
      <path d="M9 14.5 Q12 16 15 14.5" />
    </svg>
  )
}
