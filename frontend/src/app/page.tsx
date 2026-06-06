export default function Home() {
  return (
    <>
      {/* ═══ DASHBOARD ═══ */}
      <div className="page active" id="pg-dashboard">
        <div className="stats">
          <div className="stat">
            <div className="num">12</div>
            <div className="label">已学知识点</div>
            <div className="trend">+3 本周</div>
          </div>
          <div className="stat">
            <div className="num">28.5h</div>
            <div className="label">累计学习时长</div>
            <div className="trend">+4.2h 本周</div>
          </div>
          <div className="stat">
            <div className="num">78%</div>
            <div className="label">练习正确率</div>
            <div className="trend">+5% 较上周</div>
          </div>
          <div className="stat">
            <div className="num">42%</div>
            <div className="label">路径总进度</div>
            <div className="trend">5 / 12 节点</div>
          </div>
        </div>

        <div className="dash-grid">
          <div className="card">
            <div className="card-hd">
              <h3>最近活动</h3>
              <span className="tag tag-dark">Today</span>
            </div>
            <div className="card-bd">
              <div className="act-item">
                <div className="act-dot" style={{ background: 'var(--success)' }}></div>
                <div className="act-body">
                  <p>
                    完成了 <strong>A* 算法</strong> 的学习
                  </p>
                  <div className="time">2 小时前</div>
                </div>
              </div>
              <div className="act-item">
                <div className="act-dot" style={{ background: 'var(--accent)' }}></div>
                <div className="act-body">
                  <p>
                    生成了 <strong>Transformer</strong> 思维导图
                  </p>
                  <div className="time">3 小时前</div>
                </div>
              </div>
              <div className="act-item">
                <div className="act-dot" style={{ background: 'var(--info)' }}></div>
                <div className="act-body">
                  <p>
                    完成 <strong>机器学习</strong> 练习 8/10
                  </p>
                  <div className="time">昨天</div>
                </div>
              </div>
              <div className="act-item">
                <div className="act-dot" style={{ background: 'var(--ink-3)' }}></div>
                <div className="act-body">
                  <p>
                    更新学习画像，新增 <strong>深度学习</strong> 标签
                  </p>
                  <div className="time">昨天</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <h3>快速开始</h3>
              <span className="tag tag-warm">Quick</span>
            </div>
            <div className="card-bd">
              <div className="qa-grid">
                <a className="qa" href="/duihua">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  开始对话
                </a>
                <a className="qa" href="/profile">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M20 21a8 8 0 1 0-16 0" />
                  </svg>
                  更新画像
                </a>
                <a className="qa" href="/resources">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  查看资源
                </a>
                <a className="qa" href="/tiku">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  开始练习
                </a>
              </div>
            </div>
          </div>

          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-hd">
              <h3>课程进度</h3>
              <span className="tag tag-green">进行中</span>
            </div>
            <div className="card-bd">
              <div className="prog-item">
                <div className="prog-top">
                  <span>人工智能概述</span>
                  <span>100%</span>
                </div>
                <div className="prog-track">
                  <div
                    className="prog-fill"
                    style={{ width: '100%', background: 'var(--success)' }}
                  ></div>
                </div>
              </div>
              <div className="prog-item">
                <div className="prog-top">
                  <span>搜索算法</span>
                  <span>85%</span>
                </div>
                <div className="prog-track">
                  <div
                    className="prog-fill"
                    style={{ width: '85%', background: 'var(--ink)' }}
                  ></div>
                </div>
              </div>
              <div className="prog-item">
                <div className="prog-top">
                  <span>机器学习基础</span>
                  <span>60%</span>
                </div>
                <div className="prog-track">
                  <div
                    className="prog-fill"
                    style={{ width: '60%', background: 'var(--warm)' }}
                  ></div>
                </div>
              </div>
              <div className="prog-item">
                <div className="prog-top">
                  <span>深度学习与神经网络</span>
                  <span>30%</span>
                </div>
                <div className="prog-track">
                  <div
                    className="prog-fill"
                    style={{ width: '30%', background: 'var(--warm)' }}
                  ></div>
                </div>
              </div>
              <div className="prog-item">
                <div className="prog-top">
                  <span>自然语言处理</span>
                  <span>10%</span>
                </div>
                <div className="prog-track">
                  <div
                    className="prog-fill"
                    style={{ width: '10%', background: 'var(--ink-3)' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
