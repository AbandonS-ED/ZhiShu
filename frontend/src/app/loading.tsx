export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '400px',
      gap: '16px'
    }}>
      <div className="loading-spinner" style={{ width: 32, height: 32 }} />
      <span style={{ color: 'var(--ink-3)', fontSize: '14px' }}>加载中...</span>
    </div>
  )
}
