'use client'

import { useState, useEffect, useCallback } from 'react'
import { resourceApi } from '@/lib/api'
import { getStudentId } from '@/lib/student'

// ═══ DATA ═══
const resources: Resource[] = [
  {
    id: 1, type: 'explanation', title: 'A* 搜索算法详解',
    kp: '搜索算法', desc: '从 Dijkstra 到 A* 的演进，启发函数的设计原则，可采纳性与一致性证明，附带完整 Python 实现与复杂度分析。',
    diff: '中级', verified: true, time: '2 小时前', fav: true,
    content: `<h4>算法概述</h4><p>A*（A-Star）算法是一种在图中寻找从起始节点到目标节点最短路径的启发式搜索算法。它结合了 Dijkstra 算法的最优性保证和贪心最佳优先搜索的效率。</p><h4>核心公式</h4><p>A* 使用评估函数 <code>f(n) = g(n) + h(n)</code> 来决定节点的探索优先级：</p><ul><li><strong>g(n)</strong>：从起点到节点 n 的实际代价</li><li><strong>h(n)</strong>：从节点 n 到目标的启发式估计</li><li><strong>f(n)</strong>：节点 n 的综合评估值</li></ul><h4>与 Dijkstra 的关系</h4><p>Dijkstra 算法可以看作 A* 的特例，即 <code>h(n) = 0</code> 时的 A*。此时算法退化为均匀扩展的盲目搜索。通过引入启发函数，A* 能够优先探索更可能通向目标的路径，大幅减少搜索节点数。</p><h4>可采纳性条件</h4><p>当启发函数 h(n) 满足<strong>可采纳性</strong>（admissibility），即对所有节点 n，h(n) 不超过从 n 到目标的实际最短距离时，A* 保证找到最优解。</p><div class="md-cite">引用 — <em>[1]</em> 人工智能导论 · 教材 第3章 P.87-92 <em>[2]</em> Russell & Norvig, AIMA, Chapter 3 <em>[3]</em> 课件 第3讲 启发式搜索</div>`,
  },
  {
    id: 2, type: 'mindmap', title: 'Transformer 架构全景图',
    kp: 'NLP · 深度学习', desc: '完整的 Transformer 知识图谱，涵盖编码器/解码器结构、自注意力机制、多头注意力、位置编码等核心概念。',
    diff: '中级', verified: true, time: '3 小时前', fav: false,
    mindmap: `Transformer
├── 输入处理
│   ├── Token Embedding
│   ├── Positional Encoding (正弦/余弦)
│   └── Input Embedding + PE
├── 编码器 (Encoder) ×N
│   ├── Multi-Head Self-Attention
│   │   ├── Q = X·Wq
│   │   ├── K = X·Wk
│   │   ├── V = X·Wv
│   │   └── Attention = softmax(QK^T/√dk)·V
│   ├── Add & Layer Norm
│   ├── Feed-Forward Network
│   │   ├── Linear(512 → 2048)
│   │   ├── ReLU
│   │   └── Linear(2048 → 512)
│   └── Add & Layer Norm
├── 解码器 (Decoder) ×N
│   ├── Masked Multi-Head Attention
│   ├── Cross-Attention (Encoder-Decoder)
│   ├── FFN + Layer Norm
│   └── Linear + Softmax → 输出概率
└── 后续发展
    ├── BERT (Encoder-only)
    ├── GPT (Decoder-only)
    └── T5 (Encoder-Decoder)`,
  },
  {
    id: 3, type: 'exercise', title: '机器学习基础练习题',
    kp: '机器学习', desc: '涵盖监督学习、无监督学习、模型评估、特征工程等核心概念的综合练习，适合期中复习使用。',
    diff: '初级', verified: true, time: '昨天', fav: true,
    count: 8, exTypes: ['选择', '判断', '简答'],
    exercises: [
      { q: '以下哪种算法属于无监督学习？', opts: ['线性回归', 'K-Means 聚类', '支持向量机', '决策树'], ans: 1, expl: 'K-Means 是典型的无监督聚类算法，不需要标签数据。线性回归、SVM、决策树都需要标注数据进行训练。' },
      { q: '过拟合（Overfitting）的典型表现是什么？', opts: ['训练集和测试集表现都差', '训练集表现好但测试集表现差', '测试集表现好但训练集表现差', '训练集和测试集表现都好'], ans: 1, expl: '过拟合指模型过度学习了训练数据的噪声和细节，导致在新数据（测试集）上泛化能力下降。' },
      { q: '简述梯度下降法的基本原理及其常见变体。', opts: [], ans: -1, expl: '梯度下降法通过沿损失函数梯度的反方向迭代更新参数来最小化损失。常见变体包括：批量梯度下降（BGD）、随机梯度下降（SGD）、小批量梯度下降（Mini-batch GD），以及带动量的 SGD、Adam、RMSProp 等自适应学习率方法。' },
    ],
  },
  {
    id: 4, type: 'code', title: 'CNN 图像分类实战代码',
    kp: '深度学习 · CV', desc: '使用 PyTorch 实现完整的 CNN 图像分类流程，包含数据加载、模型定义、训练循环、评估与可视化。',
    diff: '中级', verified: true, time: '昨天', fav: false,
    code: `import torch
import torch.nn as nn
import torchvision
from torchvision import transforms

# 数据预处理
transform = transforms.Compose([
    transforms.Resize((32, 32)),
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,))
])

# 定义 CNN 模型
class SimpleCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 32, 3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(64 * 8 * 8, 256)
        self.fc2 = nn.Linear(256, 10)

    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))
        x = self.pool(F.relu(self.conv2(x)))
        x = x.view(-1, 64 * 8 * 8)
        x = F.relu(self.fc1(x))
        return self.fc2(x)`,
  },
  {
    id: 5, type: 'audio', title: '强化学习概念速听',
    kp: '强化学习', desc: '15 分钟音频讲解强化学习核心概念：马尔可夫决策过程、策略梯度、Q-Learning、Deep Q-Network。',
    diff: '初级', verified: false, time: '2 天前', fav: false,
    duration: '15:42',
  },
  {
    id: 6, type: 'explanation', title: '反向传播算法数学推导',
    kp: '深度学习', desc: '从链式法则出发，逐步推导前馈神经网络的反向传播过程，包含矩阵形式和逐元素形式两种推导路径。',
    diff: '高级', verified: true, time: '2 天前', fav: false,
    content: `<h4>链式法则回顾</h4><p>反向传播的数学基础是微积分的<strong>链式法则</strong>。对于复合函数 <code>f(g(x))</code>，其导数为 <code>f'(g(x)) · g'(x)</code>。</p><h4>前向传播</h4><p>对于第 l 层：<code>z^l = W^l · a^{l-1} + b^l</code>，<code>a^l = σ(z^l)</code>。逐层计算直到输出层得到预测值。</p><h4>反向传播</h4><p>定义损失函数对最后一层的误差 δ^L = ∂C/∂z^L，然后逐层反向传播：δ^l = ((W^{l+1})^T · δ^{l+1}) ⊙ σ'(z^l)。最终得到 ∂C/∂W^l = δ^l · (a^{l-1})^T。</p><div class="md-cite">引用 — <em>[1]</em> 教材 第7章 深度学习 P.215-228 <em>[2]</em> 课件 第7讲 反向传播</div>`,
  },
  {
    id: 7, type: 'mindmap', title: '知识表示方法总览',
    kp: '知识工程', desc: '系统梳理知识表示的各类方法：谓词逻辑、语义网络、框架、产生式规则、本体论等。',
    diff: '初级', verified: true, time: '3 天前', fav: true,
    mindmap: `知识表示
├── 逻辑表示
│   ├── 命题逻辑
│   ├── 一阶谓词逻辑
│   └── 描述逻辑
├── 结构化表示
│   ├── 语义网络
│   │   ├── 节点 = 概念/实例
│   │   └── 边 = 关系
│   ├── 框架 (Frame)
│   │   ├── 槽 (Slot)
│   │   └── 侧面 (Facet)
│   └── 脚本 (Script)
├── 规则表示
│   ├── 产生式规则
│   └── IF-THEN 结构
└── 现代方法
    ├── 知识图谱
    ├── 向量表示 (Embedding)
    └── 本体论 (Ontology)`,
  },
  {
    id: 8, type: 'exercise', title: '搜索算法专项练习',
    kp: '搜索算法', desc: '针对 BFS、DFS、A*、贪心搜索等搜索算法的专项练习，包含手动模拟搜索过程的题目。',
    diff: '中级', verified: true, time: '3 天前', fav: false,
    count: 5, exTypes: ['选择', '手动模拟'],
    exercises: [
      { q: 'A* 算法中，当启发函数 h(n)=0 时，算法等价于：', opts: ['贪心最佳优先搜索', 'Dijkstra 算法', 'BFS', 'DFS'], ans: 1, expl: 'h(n)=0 时 f(n)=g(n)，算法退化为按实际代价排序的 Dijkstra 算法。' },
    ],
  },
  {
    id: 9, type: 'code', title: '决策树分类 Python 实现',
    kp: '机器学习', desc: '从零实现 ID3 决策树算法，包含信息增益计算、递归建树、预测与可视化。使用 sklearn 进行对比验证。',
    diff: '中级', verified: true, time: '4 天前', fav: false,
    code: `import numpy as np
from collections import Counter

def entropy(y):
    """计算信息熵"""
    counts = np.bincount(y)
    probs = counts / len(y)
    return -np.sum(p * np.log2(p) for p in probs if p > 0)

def information_gain(X, y, feature_idx):
    """计算信息增益"""
    parent_entropy = entropy(y)
    values = np.unique(X[:, feature_idx])
    child_entropy = 0
    for val in values:
        mask = X[:, feature_idx] == val
        child_entropy += (mask.sum()/len(y)) * entropy(y[mask])
    return parent_entropy - child_entropy`,
  },
  {
    id: 10, type: 'explanation', title: 'RNN 与 LSTM 原理对比',
    kp: '深度学习', desc: '深入分析 RNN 的梯度消失问题，以及 LSTM 如何通过门控机制解决这一问题，包含 GRU 的对比分析。',
    diff: '中级', verified: true, time: '4 天前', fav: false,
    content: `<h4>RNN 基础</h4><p>循环神经网络通过隐状态 h_t = σ(W_hh · h_{t-1} + W_xh · x_t) 实现序列信息的传递。然而标准 RNN 存在严重的<strong>梯度消失</strong>问题。</p><h4>LSTM 解决方案</h4><p>LSTM 引入三个门控机制：<strong>遗忘门</strong>（决定丢弃什么信息）、<strong>输入门</strong>（决定存储什么新信息）、<strong>输出门</strong>（决定输出什么信息），以及一个<strong>细胞状态</strong>（长期记忆通道）。</p><div class="md-cite">引用 — <em>[1]</em> 教材 第7章 P.198-214 <em>[2]</em> Hochreiter & Schmidhuber (1997)</div>`,
  },
]

// ═══ TYPES ═══
type ResourceType = 'explanation' | 'mindmap' | 'exercise' | 'code' | 'audio'
type FilterType = 'all' | 'favorites' | ResourceType

interface Exercise {
  q: string
  opts: string[]
  ans: number
  expl: string
}

interface Resource {
  id: number
  type: ResourceType
  title: string
  kp: string
  desc: string
  diff: string
  verified: boolean
  time: string
  fav: boolean
  content?: string
  mindmap?: string
  code?: string
  duration?: string
  count?: number
  exTypes?: string[]
  exercises?: Exercise[]
}

// ═══ ICONS ═══
const typeIcons: Record<ResourceType, { icon: string; bg: string; color: string }> = {
  explanation: { icon: '📄', bg: 'var(--info-soft)', color: 'var(--info)' },
  mindmap: { icon: '🗺️', bg: 'var(--success-soft)', color: 'var(--success)' },
  exercise: { icon: '📝', bg: 'var(--warm-soft)', color: 'var(--warm)' },
  code: { icon: '💻', bg: 'var(--accent-soft)', color: 'var(--ink-2)' },
  audio: { icon: '🎧', bg: 'var(--danger-soft)', color: 'var(--danger)' },
}
const typeLabels: Record<ResourceType, string> = {
  explanation: '知识点讲解', mindmap: '思维导图', exercise: '练习题', code: '代码示例', audio: '音频',
}

// ═══ HELPER ═══
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ═══ MAIN PAGE ═══
export default function ResourcesPage() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [favorites, setFavorites] = useState<Set<number>>(new Set(resources.filter((r) => r.fav).map((r) => r.id)))
  const [selectedRes, setSelectedRes] = useState<Resource | null>(null)
  const [revealedAns, setRevealedAns] = useState<Set<string>>(new Set())
  const [audioBars, setAudioBars] = useState<number[]>([])
  const [detailAudioBars, setDetailAudioBars] = useState<number[]>([])
  useEffect(() => {
    setAudioBars(Array.from({ length: 24 }, () => Math.random() * 16 + 4))
    setDetailAudioBars(Array.from({ length: 40 }, () => Math.random() * 20 + 4))
  }, [])
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<string>('')
  const [genInput, setGenInput] = useState('')
  const [apiResources, setApiResources] = useState<Array<{ resource_id: string; title: string; knowledge_point: string; created_at: string }>>([])

  useEffect(() => {
    resourceApi.list(getStudentId()).then(setApiResources).catch(() => {})
  }, [])

  const generate = () => {
    if (!genInput.trim() || generating) return
    setGenerating(true)
    setGenResult('正在生成中...')

    let streamContent = ''
    resourceApi.generateStream(
      getStudentId(),
      genInput.trim(),
      (e) => {
        if (e.type === 'progress' && e.message) {
          setGenResult(e.message)
        }
        if (e.type === 'token' && e.content) {
          streamContent += e.content
          setGenResult(streamContent.slice(0, 500) + (streamContent.length > 500 ? '...' : ''))
        }
        if (e.type === 'result' && e.data) {
          const data = e.data
          const content = data.content || {}
          const knowledge = content.knowledge || ''
          setGenResult(`✅ 已生成「${data.knowledge_point || genInput.trim()}」资源\n\n${knowledge.slice(0, 500)}${knowledge.length > 500 ? '...' : ''}`)
          setApiResources((prev) => [{ resource_id: data.resource_id, title: data.knowledge_point || genInput.trim(), knowledge_point: data.knowledge_point || genInput.trim(), created_at: new Date().toISOString() }, ...prev])
        }
        if (e.type === 'error') {
          setGenResult(`❌ ${e.message || '调用失败'}`)
        }
        if (e.type === 'done' || e.type === 'error') {
          setGenerating(false)
        }
      }
    )
  }

  const toggleFav = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const filtered: Resource[] = resources.filter((r) => {
    if (filter === 'favorites') return favorites.has(r.id)
    if (filter !== 'all') return r.type === (filter as ResourceType)
    return true
  }).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.title.toLowerCase().includes(q) || r.kp.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
  })

  const getDiffClass = (diff: string) => diff === '初级' ? 'easy' : diff === '中级' ? 'med' : 'hard'

  return (
    <>
      {/* Toolbar */}
      <div className="res-toolbar">
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="按知识点或标题搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          {(['all', 'explanation', 'mindmap', 'exercise', 'code', 'audio', 'favorites'] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : f === 'favorites' ? '收藏夹' : typeLabels[f as ResourceType]}
            </button>
          ))}
        </div>
        <div className="view-btns">
          <button className={`view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="网格视图">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button className={`view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="列表视图">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI 生成面板 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', padding: 12, background: 'var(--brand-soft)', borderRadius: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>🤖 AI 生成：</span>
        <input
          value={genInput}
          onChange={e => setGenInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="输入知识点（如：线性回归、Transformer）"
          disabled={generating}
          style={{ flex: 1, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}
        />
        <button onClick={generate} disabled={generating || !genInput.trim()} style={{ padding: '6px 16px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {generating ? '生成中...' : '生成'}
        </button>
      </div>
      {genResult && (
        <div style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, fontSize: 13, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
          {genResult}
        </div>
      )}

      {/* Stats */}
      <div className="stats-bar">
        共 <span className="sb-count">{filtered.length + apiResources.length}</span> 项资源
        <span className="sb-sep">·</span>
        已收藏 <span className="sb-count">{favorites.size}</span> 项
        <span className="sb-sep">·</span>
        API <span className="sb-count">{apiResources.length}</span> 项来自服务器
      </div>

      {/* Grid */}
      <div className={`res-grid${view === 'list' ? ' list-view' : ''}`}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📭</div>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>没有找到匹配的资源</div>
            <div style={{ fontSize: '12.5px', marginTop: '4px' }}>尝试更换筛选条件或搜索关键词</div>
          </div>
        ) : (
          filtered.map((r, i) => {
            const ti = typeIcons[r.type as keyof typeof typeIcons]
            const isFav = favorites.has(r.id)
            const dc = getDiffClass(r.diff)

            return (
              <div key={r.id} className="res-card" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => setSelectedRes(r)}>
                <button
                  className={`rc-fav${isFav ? ' liked' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleFav(r.id) }}
                  title={isFav ? '取消收藏' : '收藏'}
                >
                  <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
                <div className="rc-header">
                  <div className="rc-type-icon" style={{ background: ti.bg, color: ti.color }}>{ti.icon}</div>
                  <div className="rc-header-text">
                    <h4>{r.title}</h4>
                    <div className="rc-kp"><span className="kp-dot" />{r.kp} · {typeLabels[r.type]}</div>
                  </div>
                </div>
                <div className="rc-body">
                  <div className="rc-desc">{r.desc}</div>
                  {r.type === 'mindmap' && r.mindmap && (
                    <div className="rc-mindmap-preview">{esc(r.mindmap)}</div>
                  )}
                  {r.type === 'code' && r.code && (
                    <div className="rc-code-preview">{esc(r.code)}</div>
                  )}
                  {r.type === 'exercise' && r.count && (
                    <div className="rc-exercise-count">
                      <div>
                        <div className="ec-num">{r.count}</div>
                        <div className="ec-label">道题目</div>
                      </div>
                      <div className="rc-exercise-types">
                        {r.exTypes?.map((t) => <span key={t}>{t}</span>)}
                      </div>
                    </div>
                  )}
                  {r.type === 'audio' && r.duration && (
                    <div className="rc-audio-preview">
                      <button className="rc-audio-btn" onClick={(e) => e.stopPropagation()}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      </button>
                      <div className="rc-audio-wave">
                        {audioBars.map((h, j) => <div key={j} className="wave-bar" style={{ height: `${h}px` }} />)}
                      </div>
                      <div className="rc-audio-dur">{r.duration}</div>
                    </div>
                  )}
                </div>
                <div className="rc-foot">
                  <span className={`rc-diff diff-${dc}`}>{r.diff}</span>
                  {r.verified && (
                    <span className="rc-verified">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      已验证
                    </span>
                  )}
                  <span className="rc-time">{r.time}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedRes && (
        <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && setSelectedRes(null)}>
          <div className="modal">
            <div className="modal-hd">
              <div className="mh-icon" style={{ background: typeIcons[selectedRes.type].bg, color: typeIcons[selectedRes.type].color }}>
                {typeIcons[selectedRes.type].icon}
              </div>
              <div className="mh-text">
                <h3>{selectedRes.title}</h3>
                <div className="mh-meta">
                  <span>{typeLabels[selectedRes.type]}</span>
                  <span>{selectedRes.kp}</span>
                  <span className={`rc-diff diff-${getDiffClass(selectedRes.diff)}`} style={{ padding: '2px 7px' }}>{selectedRes.diff}</span>
                </div>
              </div>
              <button
                className={`rc-fav${favorites.has(selectedRes.id) ? ' liked' : ''}`}
                style={{ position: 'static', boxShadow: 'none' }}
                onClick={() => toggleFav(selectedRes.id)}
              >
                <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              <button className="modal-close" onClick={() => setSelectedRes(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="modal-bd">
              {selectedRes.type === 'explanation' && selectedRes.content && (
                <div className="md-content" dangerouslySetInnerHTML={{ __html: selectedRes.content }} />
              )}
              {selectedRes.type === 'mindmap' && selectedRes.mindmap && (
                <div className="md-mindmap">{esc(selectedRes.mindmap)}</div>
              )}
              {selectedRes.type === 'exercise' && selectedRes.exercises && (
                selectedRes.exercises.map((ex, i) => (
                  <div key={i} className="md-exercise">
                    <div className="ex-q"><span className="ex-num">{i + 1}.</span>{ex.q}</div>
                    {ex.opts.length > 0 ? (
                      <div className="ex-opts">
                        {ex.opts.map((o, j) => (
                          <div
                            key={j}
                            className={`ex-opt${revealedAns.has(`${selectedRes.id}-${i}`) && j === ex.ans ? ' reveal-correct' : ''}`}
                            style={revealedAns.has(`${selectedRes.id}-${i}`) && j !== ex.ans ? { pointerEvents: 'none' } : {}}
                            onClick={() => {
                              setRevealedAns((prev) => new Set(prev).add(`${selectedRes.id}-${i}`))
                            }}
                          >
                            {String.fromCharCode(65 + j)}. {o}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className={`ex-ans${revealedAns.has(`${selectedRes.id}-${i}`) || ex.opts.length === 0 ? ' show' : ''}`}>
                      <strong>{ex.opts.length > 0 ? '解析' : '参考答案'}：</strong>{ex.expl}
                    </div>
                  </div>
                ))
              )}
              {selectedRes.type === 'code' && selectedRes.code && (
                <div className="md-content"><div className="md-codeblk">{esc(selectedRes.code)}</div></div>
              )}
              {selectedRes.type === 'audio' && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--ink-2)', marginBottom: '16px' }}>{selectedRes.desc}</div>
                  <div className="rc-audio-preview" style={{ maxWidth: '400px', margin: '0 auto', justifyContent: 'center' }}>
                    <button className="rc-audio-btn">
                      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    </button>
                    <div className="rc-audio-wave">
                      {detailAudioBars.map((h, j) => <div key={j} className="wave-bar" style={{ height: `${h}px` }} />)}
                    </div>
                    <div className="rc-audio-dur">{selectedRes.duration || '--:--'}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-ft">
              <span style={{ fontSize: '11.5px', color: 'var(--ink-4)' }}>
                {selectedRes.time}{selectedRes.verified ? ' · 已验证 AI 生成内容' : ''}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button className="btn" onClick={() => alert('已复制到剪贴板')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  复制
                </button>
                <button className="btn btn-solid" onClick={() => alert('跳转到智能对话页，基于该资源继续学习')}>继续学习</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
