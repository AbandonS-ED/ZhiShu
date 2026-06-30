export default function ProfileLoading() {
  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '8px 0 40px' }}>
      {/* 头部骨架 */}
      <div className="skeleton-card" style={{ marginBottom: '20px', padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="skeleton" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-line w60" style={{ height: '24px' }} />
            <div className="skeleton skeleton-line w40" />
          </div>
        </div>
      </div>

      {/* 雷达图骨架 */}
      <div className="skeleton-card" style={{ marginBottom: '20px', padding: '24px' }}>
        <div className="skeleton skeleton-line w40" style={{ height: '20px', marginBottom: '16px' }} />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="skeleton" style={{ width: '320px', height: '320px', borderRadius: '50%' }} />
        </div>
      </div>

      {/* 维度卡片骨架 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card" style={{ padding: '18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line w60" style={{ height: '16px' }} />
                <div className="skeleton skeleton-line w40" />
              </div>
            </div>
            <div className="skeleton skeleton-line w100" />
            <div className="skeleton skeleton-line w80" />
          </div>
        ))}
      </div>

      {/* 分析报告骨架 */}
      <div className="skeleton-card" style={{ padding: '24px' }}>
        <div className="skeleton skeleton-line w40" style={{ height: '20px', marginBottom: '16px' }} />
        <div className="skeleton skeleton-line w100" />
        <div className="skeleton skeleton-line w80" />
        <div className="skeleton skeleton-line w60" />
      </div>
    </div>
  )
}
