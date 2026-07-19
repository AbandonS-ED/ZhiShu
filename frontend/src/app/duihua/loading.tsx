export default function DuihuaLoading() {
  return (
    <div style={{ padding: '16px 20px', height: 'calc(100vh - var(--header-h))' }}>
      <div style={{ display: 'flex', gap: '16px', height: '100%' }}>
        {/* 左侧聊天区域骨架 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="skeleton-card" style={{ marginBottom: '12px' }}>
            <div className="skeleton skeleton-line w60" style={{ height: '20px' }} />
            <div className="skeleton skeleton-line w40" />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-line w80" />
                <div className="skeleton skeleton-line w60" />
                <div className="skeleton skeleton-line w40" />
              </div>
            ))}
          </div>
          <div className="skeleton-card" style={{ marginTop: '12px' }}>
            <div className="skeleton skeleton-line w100" style={{ height: '40px' }} />
          </div>
        </div>
        {/* 右侧面板骨架 */}
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="skeleton-card">
            <div className="skeleton skeleton-line w60" style={{ height: '18px' }} />
            <div className="skeleton skeleton-line w100" />
            <div className="skeleton skeleton-line w80" />
          </div>
          <div className="skeleton-card">
            <div className="skeleton skeleton-line w40" style={{ height: '18px' }} />
            <div className="skeleton skeleton-line w100" />
            <div className="skeleton skeleton-line w60" />
          </div>
        </div>
      </div>
    </div>
  )
}
