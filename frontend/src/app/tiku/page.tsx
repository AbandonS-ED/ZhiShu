'use client'

import { useState, useCallback } from 'react'

// ═══ TYPES ═══
interface Exercise {
  id: number
  type: 'choice' | 'judge' | 'short' | 'code'
  diff: string
  kp: string
  q: string
  opts?: string[]
  ans: number | boolean | string
  expl: string
  code?: string
}

interface Answer {
  selected: number | boolean | string | null
  correct: boolean | null
}

interface RecentItem {
  name: string
  correct: boolean | null
  type: string
  time: string
}

// ═══ DATA ═══
const exercises: Exercise[] = [
  {
    id: 1, type: 'choice', diff: '初级', kp: '机器学习',
    q: '以下哪种算法属于无监督学习？',
    opts: ['线性回归', 'K-Means 聚类', '支持向量机 (SVM)', '决策树'],
    ans: 1,
    expl: 'K-Means 是典型的无监督聚类算法，不需要标签数据即可发现数据中的分组结构。线性回归、SVM 和决策树都属于监督学习，需要标注的训练数据。',
  },
  {
    id: 2, type: 'judge', diff: '初级', kp: '机器学习',
    q: '过拟合（Overfitting）是指模型在训练集上表现好，但在测试集上表现差的现象。',
    ans: true,
    expl: '正确。过拟合指模型过度学习了训练数据中的噪声和细节，导致泛化能力下降。常见解决方法包括正则化、Dropout、增加数据量、早停等。',
  },
  {
    id: 3, type: 'choice', diff: '中级', kp: '搜索算法',
    q: 'A* 算法中，当启发函数 h(n) = 0 时，A* 算法等价于以下哪种算法？',
    opts: ['贪心最佳优先搜索', 'Dijkstra 算法', '广度优先搜索 (BFS)', '深度优先搜索 (DFS)'],
    ans: 1,
    expl: '当 h(n) = 0 时，f(n) = g(n)，A* 退化为按实际代价排序的 Dijkstra 算法。此时搜索没有方向引导，均匀向外扩展。',
  },
  {
    id: 4, type: 'short', diff: '中级', kp: '机器学习',
    q: '请简述梯度下降法的基本原理，并列举至少两种常见的变体。',
    ans: '梯度下降法通过计算损失函数关于参数的梯度（偏导数），沿梯度反方向迭代更新参数以最小化损失。更新公式：θ = θ - α·∇J(θ)。常见变体包括：(1) 随机梯度下降 SGD — 每次用单个样本更新，速度快但噪声大；(2) Mini-batch SGD — 小批量样本更新，兼顾速度和稳定性；(3) Adam — 结合动量和自适应学习率，收敛快且稳定。',
    expl: '梯度下降法是优化算法的核心。关键是理解"沿梯度反方向移动以减小损失"的思想。SGD、Momentum、RMSProp、Adam 是最重要的变体。',
  },
  {
    id: 5, type: 'choice', diff: '中级', kp: '深度学习',
    q: '在卷积神经网络 (CNN) 中，以下哪个操作负责降低特征图的空间维度？',
    opts: ['卷积层 (Convolution)', '池化层 (Pooling)', '激活函数 (ReLU)', '批归一化 (BatchNorm)'],
    ans: 1,
    expl: '池化层（如 Max Pooling、Average Pooling）通过对局部区域取最大值或平均值来降低特征图的空间尺寸，从而减少参数量和计算量，同时增强平移不变性。',
  },
  {
    id: 6, type: 'judge', diff: '中级', kp: 'NLP',
    q: 'Transformer 模型完全依赖自注意力机制（Self-Attention），不再使用 RNN 或 CNN 结构。',
    ans: true,
    expl: '正确。Transformer 的核心创新就是完全抛弃了循环和卷积结构，仅通过自注意力机制和前馈网络来建模序列依赖关系，实现了完全并行化训练。',
  },
  {
    id: 7, type: 'choice', diff: '高级', kp: '深度学习',
    q: '在反向传播中，梯度消失问题主要出现在以下哪种网络结构中？',
    opts: ['CNN 卷积神经网络', '深层 RNN / 标准 RNN', 'ResNet 残差网络', 'Transformer'],
    ans: 1,
    expl: '标准 RNN 在反向传播时需要沿时间步连乘权重矩阵，当权重小于 1 时梯度指数级衰减导致消失。LSTM/GRU 通过门控机制缓解此问题。ResNet 的跳跃连接也有助于缓解梯度消失，但该问题主要出现在深层 RNN 中。',
  },
  {
    id: 8, type: 'judge', diff: '初级', kp: '人工智能概述',
    q: '图灵测试的基本思想是：如果一台机器能在对话中表现得与人类无法区分，则认为该机器具有智能。',
    ans: true,
    expl: '正确。图灵测试由 Alan Turing 于 1950 年提出，通过"模仿游戏"来判断机器是否能展示与人类等价的智能行为。',
  },
  {
    id: 9, type: 'code', diff: '高级', kp: '机器学习',
    q: '请补全以下 K-Means 聚类算法的核心代码，完成"分配"和"更新"两个步骤：',
    code: `def kmeans(X, k, max_iter=100):
    # 随机初始化 k 个中心
    centers = X[np.random.choice(len(X), k, replace=False)]

    for _ in range(max_iter):
        # Step 1: 分配 — 将每个点分配到最近的中心
        # TODO: 计算距离并分配
        labels = _______________

        # Step 2: 更新 — 重新计算每个簇的中心
        # TODO: 计算各簇均值
        new_centers = _______________

        if np.allclose(centers, new_centers):
            break
        centers = new_centers

    return labels, centers`,
    ans: `# Step 1:
labels = np.array([np.argmin([np.linalg.norm(x - c) for c in centers]) for x in X])

# Step 2:
new_centers = np.array([X[labels == i].mean(axis=0) for i in range(k)])`,
    expl: 'K-Means 的核心是两步迭代：(1) 分配步——计算每个样本到各中心的距离，分配到最近的簇；(2) 更新步——对每个簇求均值作为新中心。使用 np.linalg.norm 计算欧氏距离，np.argmin 找到最近中心。',
  },
  {
    id: 10, type: 'choice', diff: '高级', kp: 'NLP',
    q: 'Transformer 中多头注意力（Multi-Head Attention）的主要优势是什么？',
    opts: ['减少计算量', '让模型同时关注不同位置和不同表示子空间的信息', '增加模型深度', '防止过拟合'],
    ans: 1,
    expl: '多头注意力将 Q、K、V 映射到多个不同的子空间并行计算注意力，使模型能够同时捕获不同层面的依赖关系（如语法关系、语义关系等）。最后拼接各头输出并线性变换。',
  },
]

// ═══ HELPERS ═══
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getTypeLabel(type: string) {
  return { choice: '选择题', judge: '判断题', short: '简答题', code: '编程题' }[type] || ''
}

function getTypeClass(type: string) {
  return { choice: 'type-choice', judge: 'type-judge', short: 'type-short', code: 'type-code' }[type] || ''
}

function getDiffClass(diff: string) {
  return diff === '初级' ? 'diff-easy' : diff === '中级' ? 'diff-med' : 'diff-hard'
}

// ═══ MAIN PAGE ═══
export default function TikuPage() {
  const [tab, setTab] = useState<string>('all')
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [recentLog, setRecentLog] = useState<RecentItem[]>([])
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  const filtered = tab === 'all' ? exercises : exercises.filter((e) => e.type === tab)

  // Stats
  const total = exercises.length
  const answeredCount = Object.keys(answers).length
  const correctCount = Object.values(answers).filter((a) => a.correct === true).length
  const pct = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0
  const answerPct = Math.round((answeredCount / total) * 100)

  // Topics
  const topics: Record<string, { total: number; correct: number; answered: number }> = {}
  exercises.forEach((ex) => {
    if (!topics[ex.kp]) topics[ex.kp] = { total: 0, correct: 0, answered: 0 }
    topics[ex.kp].total++
    if (answers[ex.id]) {
      topics[ex.kp].answered++
      if (answers[ex.id].correct === true) topics[ex.kp].correct++
    }
  })

  const addRecent = useCallback((ex: Exercise, correct: boolean | null) => {
    setRecentLog((prev) => {
      const next = [{ name: ex.q.slice(0, 20) + '...', correct, type: ex.type, time: '刚刚' }, ...prev]
      return next.slice(0, 8)
    })
  }, [])

  const answerChoice = useCallback((id: number, selected: number) => {
    if (answers[id]) return
    const ex = exercises.find((e) => e.id === id)!
    const correct = selected === ex.ans
    setAnswers((prev) => ({ ...prev, [id]: { selected, correct } }))
    addRecent(ex, correct)
  }, [answers, addRecent])

  const answerJudge = useCallback((id: number, selected: boolean) => {
    if (answers[id]) return
    const ex = exercises.find((e) => e.id === id)!
    const correct = selected === ex.ans
    setAnswers((prev) => ({ ...prev, [id]: { selected, correct } }))
    addRecent(ex, correct)
  }, [answers, addRecent])

  const answerShort = useCallback((id: number, value: string) => {
    if (!value.trim()) return
    setAnswers((prev) => ({ ...prev, [id]: { selected: value, correct: null } }))
    setRevealed((prev) => new Set(prev).add(id))
    addRecent(exercises.find((e) => e.id === id)!, null)
  }, [addRecent])

  const revealAnswer = useCallback((id: number) => {
    setAnswers((prev) => ({ ...prev, [id]: { selected: null, correct: null } }))
    setRevealed((prev) => new Set(prev).add(id))
    addRecent(exercises.find((e) => e.id === id)!, null)
  }, [addRecent])

  const resetOne = useCallback((id: number) => {
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setRevealed((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    if (!Object.keys(answers).length) return
    if (!confirm('确定要清除所有答题记录并重新开始？')) return
    setAnswers({})
    setRecentLog([])
    setRevealed(new Set())
  }, [answers])

  const showMistakes = useCallback(() => {
    const wrongs = Object.entries(answers).filter(([, a]) => a.correct === false)
    if (!wrongs.length) { alert('目前没有错题，继续加油！'); return }
    const names = wrongs.map(([id]) => exercises.find((e) => e.id === Number(id))?.q?.slice(0, 30)).join('\n• ')
    alert(`错题 ${wrongs.length} 道：\n• ${names}`)
  }, [answers])

  // Ring
  const circ = 364.4
  const ringColor = answerPct >= 80 ? 'var(--success)' : answerPct >= 40 ? 'var(--warm)' : 'var(--ink-3)'

  return (
    <>
      {/* Stats */}
      <div className="stats-strip">
        <div className="ss-item">
          <div className="ss-label">总题数</div>
          <div className="ss-val">{total}</div>
          <div className="ss-sub">覆盖 5 个知识点</div>
        </div>
        <div className="ss-item">
          <div className="ss-label">已作答</div>
          <div className="ss-val" style={{ color: 'var(--warm)' }}>{answeredCount}</div>
          <div className="ss-sub">{total - answeredCount} 题未答</div>
        </div>
        <div className="ss-item">
          <div className="ss-label">正确率</div>
          <div className="ss-val" style={{ color: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warm)' : 'var(--danger)' }}>{pct}%</div>
          <div className="ss-sub">{correctCount}/{answeredCount} 正确</div>
        </div>
        <div className="ss-item">
          <div className="ss-label">错题</div>
          <div className="ss-val" style={{ color: 'var(--danger)' }}>{answeredCount - correctCount}</div>
          <div className="ss-sub">可回顾重做</div>
        </div>
      </div>

      {/* Layout */}
      <div className="ex-layout" style={{ marginTop: '16px' }}>
        {/* Main */}
        <div className="ex-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="ex-tabs">
              {(['all', 'choice', 'judge', 'short', 'code'] as const).map((t) => (
                <button
                  key={t}
                  className={`ex-tab${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {t === 'all' ? '全部' : getTypeLabel(t)}
                </button>
              ))}
            </div>
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={resetAll}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              重新答题
            </button>
          </div>

          {/* Exercises */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📝</div>
              <div style={{ fontSize: '14px' }}>该分类下暂无题目</div>
            </div>
          ) : (
            filtered.map((ex, i) => {
              const a = answers[ex.id]
              const isAnswered = !!a
              const isRevealed = revealed.has(ex.id)
              const cardClass = isAnswered ? (a.correct === true ? 'answered' : a.correct === false ? 'answered-wrong' : '') : ''

              return (
                <div key={ex.id} className={`ex-card ${cardClass}`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="ex-hd">
                    <div className="qnum">{String(i + 1).padStart(2, '0')}</div>
                    <div className="qmeta">
                      <span className={`qtype ${getTypeClass(ex.type)}`}>{getTypeLabel(ex.type)}</span>
                      <span className={`qdiff ${getDiffClass(ex.diff)}`}>{ex.diff}</span>
                    </div>
                    <div className="qkp">{ex.kp}</div>
                  </div>
                  <div className="ex-q">{ex.q}</div>

                  {/* Choice options */}
                  {ex.type === 'choice' && ex.opts && (
                    <div className="ex-opts">
                      {ex.opts.map((o, j) => {
                        let cls = ''
                        if (isAnswered) {
                          cls = 'disabled'
                          if (j === ex.ans) cls += ' correct'
                          if (a.selected === j && j !== ex.ans) cls += ' wrong'
                        }
                        return (
                          <div key={j} className={`ex-opt ${cls}`} onClick={() => answerChoice(ex.id, j)}>
                            <div className="key">{String.fromCharCode(65 + j)}</div>
                            <div className="opt-text">{o}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Judge buttons */}
                  {ex.type === 'judge' && (
                    <div className="judge-btns">
                      <button
                        className={`judge-btn${isAnswered ? ` disabled${ex.ans === true ? ' correct-t' : ' wrong-t'}${a.selected === true ? (ex.ans === true ? ' correct-t' : ' wrong-t') : ''}` : ''}`}
                        onClick={() => answerJudge(ex.id, true)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12" /></svg> 正确
                      </button>
                      <button
                        className={`judge-btn${isAnswered ? ` disabled${ex.ans === false ? ' correct-f' : ' wrong-f'}${a.selected === false ? (ex.ans === false ? ' correct-f' : ' wrong-f') : ''}` : ''}`}
                        onClick={() => answerJudge(ex.id, false)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> 错误
                      </button>
                    </div>
                  )}

                  {/* Short answer / Code */}
                  {(ex.type === 'short' || ex.type === 'code') && (
                    <>
                      {ex.type === 'code' && ex.code && (
                        <div style={{ background: '#1c1c1c', color: '#d4d4d4', padding: '14px 16px', borderRadius: 'var(--r-xs)', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre', marginBottom: '12px' }}>
                          {esc(ex.code)}
                        </div>
                      )}
                      <textarea
                        className="short-area"
                        placeholder={ex.type === 'code' ? '在此编写你的代码补全...' : '输入你的答案...'}
                        style={ex.type === 'code' ? { fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' } : {}}
                        disabled={isAnswered}
                        id={`sa-${ex.id}`}
                      />
                      {!isAnswered && (
                        <div style={{ marginTop: '8px' }}>
                          <button className="btn btn-solid btn-sm" onClick={() => {
                            const ta = document.getElementById(`sa-${ex.id}`) as HTMLTextAreaElement
                            if (ta) answerShort(ex.id, ta.value)
                          }}>提交答案</button>
                          <button className="btn btn-sm" style={{ marginLeft: '8px' }} onClick={() => revealAnswer(ex.id)}>查看参考答案</button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Explanation */}
                  {(isAnswered || isRevealed) && (
                    <div className="ex-expl show">
                      <div className={`expl-hd ${a?.correct === true ? 'correct-hd' : 'wrong-hd'}`}>
                        {a?.correct === true ? '✓ 回答正确' : a?.correct === false ? '✗ 回答错误' : '参考答案与解析'} — 解析
                      </div>
                      {(ex.type === 'short' || ex.type === 'code') && typeof ex.ans === 'string' && (
                        <div style={{ padding: '10px', background: 'var(--surface)', borderRadius: 'var(--r-xs)', marginBottom: '8px', whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: 1.7 }}>
                          {esc(ex.ans)}
                        </div>
                      )}
                      {ex.expl}
                      {(ex.ans === true || ex.ans === false) && (
                        <div style={{ marginTop: '8px', fontWeight: 600, color: 'var(--ink)' }}>参考答案：{ex.ans ? '正确' : '错误'}</div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="ex-acts">
                    {isAnswered && (
                      <span className={`ex-status ${a.correct === true ? 'st-correct' : a.correct === false ? 'st-wrong' : ''}`}>
                        {a.correct === true ? '✓ 正确' : a.correct === false ? '✗ 错误' : ''}
                      </span>
                    )}
                    {isAnswered && (
                      <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => resetOne(ex.id)}>重做此题</button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Side */}
        <div className="ex-side">
          {/* Progress */}
          <div className="card">
            <div className="card-hd"><h3>答题进度</h3></div>
            <div className="card-bd">
              <div className="progress-ring-wrap">
                <div className="progress-ring">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke="var(--bg-subtle)" strokeWidth="8" />
                    <circle cx="70" cy="70" r="58" fill="none" stroke={ringColor} strokeWidth="8"
                      strokeDasharray={circ} strokeDashoffset={circ - (circ * answerPct / 100)} strokeLinecap="round" />
                  </svg>
                  <div className="pr-val"><span className="pr-num">{answerPct}%</span><span className="pr-label">已作答</span></div>
                </div>
              </div>
              <div className="side-stats">
                <div className="side-stat"><div className="sval" style={{ color: 'var(--success)' }}>{correctCount}</div><div className="slbl">正确</div></div>
                <div className="side-stat"><div className="sval" style={{ color: 'var(--danger)' }}>{answeredCount - correctCount}</div><div className="slbl">错误</div></div>
                <div className="side-stat"><div className="sval">{total - answeredCount}</div><div className="slbl">未答</div></div>
                <div className="side-stat"><div className="sval" style={{ color: 'var(--warm)' }}>{pct}%</div><div className="slbl">正确率</div></div>
              </div>
            </div>
          </div>

          {/* Topic breakdown */}
          <div className="card">
            <div className="card-hd"><h3>知识点掌握</h3></div>
            <div className="card-bd">
              {Object.entries(topics).map(([name, d]) => {
                const p = d.answered ? Math.round((d.correct / d.answered) * 100) : 0
                const col = p >= 70 ? 'var(--success)' : p >= 40 ? 'var(--warm)' : 'var(--ink-3)'
                return (
                  <div key={name} className="topic-item">
                    <span className="tk-name">{name}</span>
                    <div className="tk-bar"><div className="tk-bar-fill" style={{ width: `${d.answered ? Math.round((d.answered / d.total) * 100) : 0}%`, background: col }} /></div>
                    <span className="tk-pct" style={{ color: col }}>{d.answered ? `${p}%` : '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent */}
          <div className="card">
            <div className="card-hd"><h3>最近答题</h3></div>
            <div className="card-bd">
              {recentLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '12px', color: 'var(--ink-4)' }}>开始答题后显示记录</div>
              ) : (
                recentLog.map((r, i) => {
                  const icon = r.correct === true ? '✓' : r.correct === false ? '✗' : '—'
                  const bg = r.correct === true ? 'var(--success-soft)' : r.correct === false ? 'var(--danger-soft)' : 'var(--accent-soft)'
                  const color = r.correct === true ? 'var(--success)' : r.correct === false ? 'var(--danger)' : 'var(--ink-3)'
                  return (
                    <div key={i} className="recent-item">
                      <div className="ri-icon" style={{ background: bg, color, fontWeight: 700 }}>{icon}</div>
                      <span className="ri-text">{r.name}</span>
                      <span className="ri-time">{r.time}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
