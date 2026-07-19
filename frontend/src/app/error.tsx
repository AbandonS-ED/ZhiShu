'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '400px',
      gap: '16px',
      padding: '20px'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'var(--danger-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '8px'
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" width="32" height="32">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>出错了</h2>
      <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '14px', textAlign: 'center' }}>
        {error.message || '页面加载失败，请稍后重试'}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: '8px',
          padding: '10px 24px',
          background: 'var(--ink)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'opacity 0.2s'
        }}
      >
        重试
      </button>
    </div>
  )
}
