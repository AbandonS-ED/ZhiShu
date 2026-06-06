export default function TikuPage() {
  return (
    <>
<div className="ex-layout" style={{ marginTop:'16px' }}>
        
        <div className="ex-main">
          
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <div className="ex-tabs" id="exTabs">
              <button className="ex-tab active">全部</button>
              <button className="ex-tab">选择题</button>
              <button className="ex-tab">判断题</button>
              <button className="ex-tab">简答题</button>
              <button className="ex-tab">编程题</button>
            </div>
            <button className="btn btn-sm" style={{ marginLeft:'auto' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              重新答题
            </button>
          </div>

          
          <div id="exList"></div>
        </div>

        
        <div className="ex-side">
          
          <div className="card">
            <div className="card-hd"><h3>答题进度</h3></div>
            <div className="card-bd">
              <div className="progress-ring-wrap">
                <div className="progress-ring">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke="var(--bg-subtle)" strokeWidth="8"/>
                    <circle id="ringFill" cx="70" cy="70" r="58" fill="none" stroke="var(--warm)" strokeWidth="8"
                      strokeDasharray="364.4" strokeDashoffset="364.4" strokeLinecap="round"/>
                  </svg>
                  <div className="pr-val"><span className="pr-num" id="ringNum">0%</span><span className="pr-label">已作答</span></div>
                </div>
              </div>
              <div className="side-stats" id="sideStats"></div>
            </div>
          </div>

          
          <div className="card">
            <div className="card-hd"><h3>知识点掌握</h3></div>
            <div className="card-bd" id="topicBreak"></div>
          </div>

          
          <div className="card">
            <div className="card-hd"><h3>最近答题</h3></div>
            <div className="card-bd" id="recentList"></div>
          </div>
        </div>
      </div>
    </>
  )
}
