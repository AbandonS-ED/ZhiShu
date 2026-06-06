'use client'

import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppStore } from '@/stores/appStore'

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  completed: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700' },
  in_progress: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700' },
  available: { bg: 'bg-white', border: 'border-gray-300', text: 'text-gray-700' },
  locked: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-400' },
}

const statusLabels: Record<string, string> = {
  completed: '✅ 已完成',
  in_progress: '🔵 学习中',
  available: '📖 可学习',
  locked: '🔒 未解锁',
}

// 模拟学习路径数据
const mockNodes: Node[] = [
  { id: '1', position: { x: 250, y: 0 }, data: { label: 'AI 概述', status: 'completed', kp: 'AI概述与发展历史' }, type: 'knowledge' },
  { id: '2', position: { x: 50, y: 150 }, data: { label: '搜索算法', status: 'completed', kp: 'BFS/DFS/A*/MinMax' }, type: 'knowledge' },
  { id: '3', position: { x: 450, y: 150 }, data: { label: 'Python基础', status: 'completed', kp: 'Python/NumPy/Pandas' }, type: 'knowledge' },
  { id: '4', position: { x: 50, y: 300 }, data: { label: '知识表示', status: 'in_progress', kp: '谓词逻辑/语义网络' }, type: 'knowledge' },
  { id: '5', position: { x: 250, y: 300 }, data: { label: '监督学习', status: 'available', kp: '回归/分类/SVM' }, type: 'knowledge' },
  { id: '6', position: { x: 450, y: 300 }, data: { label: '数据预处理', status: 'available', kp: '清洗/特征工程' }, type: 'knowledge' },
  { id: '7', position: { x: 150, y: 450 }, data: { label: '无监督学习', status: 'locked', kp: '聚类/降维' }, type: 'knowledge' },
  { id: '8', position: { x: 350, y: 450 }, data: { label: '深度学习', status: 'locked', kp: 'CNN/RNN/Transformer' }, type: 'knowledge' },
  { id: '9', position: { x: 50, y: 600 }, data: { label: 'NLP', status: 'locked', kp: '文本处理/语言模型' }, type: 'knowledge' },
  { id: '10', position: { x: 250, y: 600 }, data: { label: '计算机视觉', status: 'locked', kp: '图像分类/目标检测' }, type: 'knowledge' },
  { id: '11', position: { x: 450, y: 600 }, data: { label: '强化学习', status: 'locked', kp: 'MDP/Q-Learning' }, type: 'knowledge' },
  { id: '12', position: { x: 250, y: 750 }, data: { label: '模型评估', status: 'locked', kp: '交叉验证/评估指标' }, type: 'knowledge' },
]

const mockEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: false },
  { id: 'e1-3', source: '1', target: '3', type: 'smoothstep', animated: false },
  { id: 'e2-4', source: '2', target: '4', type: 'smoothstep', animated: false },
  { id: 'e2-5', source: '2', target: '5', type: 'smoothstep', animated: false },
  { id: 'e3-6', source: '3', target: '6', type: 'smoothstep', animated: false },
  { id: 'e5-7', source: '5', target: '7', type: 'smoothstep', animated: false },
  { id: 'e5-8', source: '5', target: '8', type: 'smoothstep', animated: false },
  { id: 'e7-9', source: '7', target: '9', type: 'smoothstep', animated: false },
  { id: 'e8-10', source: '8', target: '10', type: 'smoothstep', animated: false },
  { id: 'e8-11', source: '8', target: '11', type: 'smoothstep', animated: false },
  { id: 'e5-12', source: '5', target: '12', type: 'smoothstep', animated: false },
  { id: 'e6-12', source: '6', target: '12', type: 'smoothstep', animated: false },
]

function KnowledgeNode({ data }: { data: { label: string; status: string; kp: string } }) {
  const colors = statusColors[data.status] || statusColors.locked

  return (
    <div className={`px-4 py-3 rounded-xl border-2 ${colors.bg} ${colors.border} shadow-sm min-w-[140px]`}>
      <div className={`text-sm font-semibold ${colors.text}`}>{data.label}</div>
      <div className="text-xs text-gray-500 mt-1">{data.kp}</div>
      <div className="text-xs mt-2">{statusLabels[data.status]}</div>
    </div>
  )
}

const nodeTypes = { knowledge: KnowledgeNode }

export default function LearningPathPage() {
  const { setSelectedKP } = useAppStore()
  const [nodes, setNodes, onNodesChange] = useNodesState(mockNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(mockEdges)

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedKP(node.id)
  }, [setSelectedKP])

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { strokeWidth: 2, stroke: '#94a3b8' },
  }), [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🗺️ 学习路径</h1>
        <div className="flex items-center space-x-4 text-sm">
          <span className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-emerald-400 rounded-full" />
            <span>已完成</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-blue-400 rounded-full" />
            <span>学习中</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-3 h-3 bg-gray-300 rounded-full" />
            <span>未解锁</span>
          </span>
        </div>
      </div>

      {/* 进度概览 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">总体进度</span>
          <span className="text-sm font-bold text-primary-600">3/12 已完成</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className="bg-primary-500 h-2.5 rounded-full" style={{ width: '25%' }} />
        </div>
      </div>

      {/* ReactFlow 图 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          attributionPosition="bottom-left"
        >
          <Background gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      {/* 节点详情 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📖 知识点详情</h2>
        <p className="text-sm text-gray-500">点击上方节点查看详情和学习资源</p>
      </div>
    </div>
  )
}
