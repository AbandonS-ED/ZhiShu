export default function TikuLoading() {
  return (
    <div style={{ padding: '16px 20px' }}>
      {/* 头部骨架 */}
      <div className="skeleton-card" style={{ marginBottom: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton skeleton-line w40" style={{ height: '24px' }} />
            <div className="skeleton skeleton-line w60" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '8px' }} />
          </div>
        </div>
      </div>

      {/* 筛选栏骨架 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton" style={{ width: '80px', height: '32px', borderRadius: '6px' }} />
        ))}
      </div>

      {/* 题目列表骨架 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '6px' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line w100" style={{ height: '16px' }} />
                <div className="skeleton skeleton-line w80" />
                <div className="skeleton skeleton-line w60" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
