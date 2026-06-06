export default function PingguPage() {
  return (
    <>
<div className="content">
      
      <div className="score-hero">
        <div className="sh-score">
          <div className="sh-ring">
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="66" fill="none" stroke="var(--bg-subtle)" strokeWidth="10"/>
              <circle id="scoreRing" cx="80" cy="80" r="66" fill="none" stroke="var(--warm)" strokeWidth="10"
                strokeDasharray="414.7" strokeDashoffset="414.7" strokeLinecap="round"/>
            </svg>
            <div className="sh-val">
              <div className="sh-num" id="scoreNum">0</div>
              <div className="sh-label">综合评分</div>
            </div>
          </div>
          <div className="sh-desc" id="scoreDesc"></div>
        </div>
        <div className="sh-dims" id="dimBars"></div>
      </div>

      
      <div className="stats-row" id="statsRow"></div>

      
      <div className="trend-section">
        <div className="card chart-card">
          <div className="card-hd">
            <h3>学习时长趋势</h3>
            <span className="tag tag-info">本周</span>
          </div>
          <div className="card-bd">
            <svg className="line-chart" id="trendChart" viewBox="0 0 520 220"></svg>
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-hd">
            <h3>练习正确率</h3>
            <span className="tag tag-green">按知识点</span>
          </div>
          <div className="card-bd">
            <svg className="bar-chart" id="barChart" viewBox="0 0 520 220"></svg>
          </div>
        </div>
      </div>

      
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
        
        <div className="card">
          <div className="card-hd">
            <h3>评估报告</h3>
            <span className="tag tag-dark">AI 生成</span>
          </div>
          <div className="card-bd">
            <div className="eval-report" id="evalReport"></div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-hd">
            <h3>知识点掌握度</h3>
            <button className="btn btn-sm">去练习</button>
          </div>
          <div className="card-bd" style={{ padding:'0 0 4px' }}>
            <table className="km-table" id="kmTable">
              <thead><tr><th>知识点</th><th>掌握度</th><th>进度</th><th>练习</th><th>正确率</th></tr></thead>
              <tbody id="kmBody"></tbody>
            </table>
          </div>
        </div>
      </div>

      
      <div className="card">
        <div className="card-hd">
          <h3>学习记录明细</h3>
          <span className="tag tag-dark" id="recordCount">24 条记录</span>
        </div>
        <div className="card-bd" id="recordsList"></div>
      </div>
    </div>
    </>
  )
}
