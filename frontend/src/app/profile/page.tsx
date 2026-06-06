export default function ProfilePage() {
  return (
    <>
<div className="prof-layout">

        
        <div className="radar-section">
          
          <div className="card radar-card">
            <div className="card-hd">
              <h3>画像雷达</h3>
              <span className="tag tag-dark">v3.2</span>
            </div>
            <div className="card-bd">
              <div className="radar-wrap">
                <svg id="radarSvg" width="300" height="300" viewBox="0 0 300 300"></svg>
              </div>
            </div>
          </div>

          
          <div className="radar-meta">
            <div className="rm-item">
              <div className="rm-label">置信度</div>
              <div className="rm-val">0.87</div>
            </div>
            <div className="rm-item">
              <div className="rm-label">版本</div>
              <div className="rm-val">v3.2</div>
            </div>
            <div className="rm-item">
              <div className="rm-label">日均学习</div>
              <div className="rm-val">2.4h</div>
            </div>
            <div className="rm-item">
              <div className="rm-label">专注时长</div>
              <div className="rm-val">38min</div>
            </div>
          </div>

          
          <div className="card comp-card">
            <div className="card-bd">
              <div className="comp-ring">
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-subtle)" strokeWidth="5"/>
                  <circle cx="36" cy="36" r="30" fill="none" stroke="var(--warm)" strokeWidth="5"
                    strokeDasharray="188.5" strokeDashoffset="47.1" strokeLinecap="round"/>
                </svg>
                <div className="comp-pct">75%<small>完整</small></div>
              </div>
              <div className="comp-info">
                <h4>画像完整度</h4>
                <p>建议通过对话补充<strong>学习节奏</strong>和<strong>易错点</strong>维度信息，以获得更精准的个性化推荐。</p>
              </div>
            </div>
          </div>

          
          <div className="card action-card">
            <div className="card-bd">
              <div className="action-row">
                <button className="btn btn-solid">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                  问卷更新画像
                </button>
                <button className="btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  对话式完善
                </button>
              </div>
            </div>
          </div>
        </div>

        
        <div className="prof-right">

          
          <div className="card">
            <div className="card-hd">
              <h3>知识点掌握度</h3>
              <div style={{ display:'flex', gap:'8px' }}>
                <span className="tag tag-green">高 &amp;gt;70%</span>
                <span className="tag tag-warm">中 30-70%</span>
                <span className="tag tag-danger">低 &amp;lt;30%</span>
              </div>
            </div>
            <div className="card-bd">
              <div className="kb-scroll" id="kbScroll">
                
              </div>
            </div>
          </div>

          
          <div className="card">
            <div className="card-hd">
              <h3>薄弱环节</h3>
              <span className="tag tag-danger">需要加强</span>
            </div>
            <div className="card-bd">
              <div className="weak-grid" id="weakGrid">
                
              </div>
            </div>
          </div>

          
          <div className="card dim-card">
            <div className="card-hd">
              <h3>六维详情</h3>
              <button className="btn btn-ghost">全部展开</button>
            </div>
            <div className="card-bd" id="dimSections">
              
            </div>
          </div>

          
          <div className="card" id="historyCard" style={{ display:'none' }}>
            <div className="card-hd">
              <h3>更新历史</h3>
              <span className="tag tag-dark">最近 5 条</span>
            </div>
            <div className="card-bd" id="histList">
              
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
