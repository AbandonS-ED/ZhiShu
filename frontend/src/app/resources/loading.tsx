export default function ResourcesLoading() {
  return (
    <div style={{ padding: '16px 20px' }}>
      {/* 头部骨架 */}
      <div className="skeleton-card" style={{ marginBottom: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton skeleton-line w40" style={{ height: '24px' }} />
            <div className="skeleton skeleton-line w60" />
          </div>
          <div className="skeleton" style={{ width: '120px', height: '36px', borderRadius: '8px' }} />
        </div>
      </div>

      {/* 筛选栏骨架 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton" style={{ width: '80px', height: '32px', borderRadius: '6px' }} />
        ))}
      </div>

      {/* 资源卡片网格骨架 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton-card" style={{ padding: '20px' }}>
            <div className="skeleton skeleton-line w80" style={{ height: '18px' }} />
            <div className="skeleton skeleton-line w100" />
            <div className="skeleton skeleton-line w60" />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '12px' }} />
              <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '12px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
