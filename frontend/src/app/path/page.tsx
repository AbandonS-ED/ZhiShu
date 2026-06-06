export default function PathPage() {
  return (
    <>
<div className="path-layout" style={{ marginTop:'14px' }}>
        
        <div className="path-left">
          <div className="card graph-card">
            <div className="card-hd">
              <h3>路径图谱</h3>
              <div className="legend">
                <div className="legend-item"><div className="legend-dot" style={{ background:'var(--success)' }}></div>已完成</div>
                <div className="legend-item"><div className="legend-dot" style={{ background:'var(--warm)' }}></div>进行中</div>
                <div className="legend-item"><div className="legend-dot" style={{ background:'var(--danger)' }}></div>薄弱</div>
                <div className="legend-item"><div className="legend-dot" style={{ background:'var(--bg-subtle)', border:'1px solid var(--line)' }}></div>待学习</div>
              </div>
            </div>
            <div className="card-bd" id="graphArea">
              <div className="graph-container" id="graphContainer">
                <svg className="graph-edges" id="graphEdges"></svg>
              </div>
            </div>
          </div>
        </div>

        
        <div className="path-right">
          
          <div id="detailArea">
            <div className="detail-panel">
              <div className="detail-placeholder">
                <div className="dp-icon">👆</div>
                <p>点击路径图中的节点<br/>查看知识点详情</p>
              </div>
            </div>
          </div>

          
          <div className="card">
            <div className="card-hd">
              <h3>每日计划</h3>
              <span className="tag tag-warm">本周</span>
            </div>
            <div className="card-bd" id="dailyPlan"></div>
          </div>
        </div>
      </div>
    </>
  )
}
