'use client'

interface Agent {
  n: string
  r: string
  c: number
  e: number
  cpu: number
  mem: number
  s: 0 | 1
}

const AG: Agent[] = [
  { n: 'MasterAgent', r: '调度中心', c: 342, e: 0.3, cpu: 12, mem: 180, s: 0 },
  { n: 'ProfileAgent', r: '画像构建', c: 89, e: 0.1, cpu: 8, mem: 120, s: 0 },
  { n: 'TeachingAgent', r: '知识讲解', c: 456, e: 0.5, cpu: 22, mem: 240, s: 0 },
  { n: 'MindMapAgent', r: '思维导图', c: 127, e: 0.2, cpu: 15, mem: 160, s: 0 },
  { n: 'QuizAgent', r: '练习生成', c: 203, e: 0.8, cpu: 18, mem: 190, s: 1 },
  { n: 'CodingAgent', r: '代码生成', c: 98, e: 1.2, cpu: 28, mem: 310, s: 0 },
  { n: 'PathAgent', r: '路径规划', c: 67, e: 0.0, cpu: 6, mem: 95, s: 0 },
]

const COLORS = [
  { b: 'var(--accent-soft)', c: 'var(--ink-2)' },
  { b: 'var(--info-soft)', c: 'var(--info)' },
  { b: 'var(--warm-soft)', c: 'var(--warm)' },
  { b: 'var(--purple-soft)', c: 'var(--purple)' },
  { b: 'var(--success-soft)', c: 'var(--success)' },
  { b: 'var(--danger-soft)', c: 'var(--danger)' },
  { b: 'var(--info-soft)', c: 'var(--info)' },
]

export default function AgentsPage() {
  const mx = Math.max(...AG.map((a) => a.c))
  const online = AG.filter((a) => a.s === 0).length

  return (
    <div className="admin-pnl vis">
      <div className="admin-cd" style={{ marginBottom: 12 }}>
        <div className="admin-cd-h">
          <h3>Agent 集群状态</h3>
          <span className="admin-tag admin-tag-green">全部在线 · {online}/{AG.length}</span>
        </div>
        <div className="admin-cd-b">
          <div className="admin-ag-g">
            {AG.map((a, i) => {
              const cl = COLORS[i % COLORS.length]
              const badge = a.s ? (
                <span
                  className="admin-ag-bg"
                  style={{ background: 'var(--warm-soft)', color: 'var(--warm)' }}
                >
                  执行中
                </span>
              ) : (
                <span
                  className="admin-ag-bg"
                  style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
                >
                  就绪
                </span>
              )
              const bc = a.s ? 'var(--warm)' : 'var(--success)'
              return (
                <div key={a.n} className="admin-ag-c">
                  <div className="admin-ag-t">
                    <div
                      className="admin-ag-ic"
                      style={{ background: cl.b, color: cl.c }}
                    >
                      {a.n[0]}
                    </div>
                    <div>
                      <div className="admin-ag-nm">{a.n}</div>
                      <div className="admin-ag-rl">{a.r}</div>
                    </div>
                    {badge}
                  </div>
                  <div className="admin-ag-bar">
                    <div
                      className="admin-ag-fill"
                      style={{
                        width: `${Math.min(a.cpu * 3, 100)}%`,
                        background: bc,
                      }}
                    ></div>
                  </div>
                  <div className="admin-ag-mt">
                    <span>CPU {a.cpu}%</span>
                    <span>MEM {a.mem}MB</span>
                    <span>{a.c} 调用</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="admin-g2">
        <div className="admin-cd">
          <div className="admin-cd-h">
            <h3>调用统计（今日）</h3>
          </div>
          <div className="admin-cd-b">
            {AG.map((a) => (
              <div
                key={a.n}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--line-2)',
                }}
              >
                <span style={{ width: 100, fontSize: 11.5, color: 'var(--ink-2)' }}>
                  {a.n}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 4,
                    background: 'var(--bg-subtle)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.round((a.c / mx) * 100)}%`,
                      background: 'var(--info)',
                      borderRadius: 2,
                    }}
                  ></div>
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    minWidth: 36,
                    textAlign: 'right',
                  }}
                >
                  {a.c}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-cd">
          <div className="admin-cd-h">
            <h3>错误率</h3>
          </div>
          <div className="admin-cd-b">
            {AG.map((a) => {
              const ec = a.e >= 1 ? 'var(--danger)' : a.e >= 0.5 ? 'var(--warm)' : 'var(--success)'
              return (
                <div
                  key={a.n}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--line-2)',
                  }}
                >
                  <span style={{ width: 100, fontSize: 11.5, color: 'var(--ink-2)' }}>
                    {a.n}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      background: 'var(--bg-subtle)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(a.e * 40, 100)}%`,
                        background: ec,
                        borderRadius: 2,
                      }}
                    ></div>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      minWidth: 36,
                      textAlign: 'right',
                      color: ec,
                    }}
                  >
                    {a.e}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
