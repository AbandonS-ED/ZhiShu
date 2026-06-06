'use client'

import { useEffect, useRef } from 'react'
import { ZoomIn, ZoomOut, Maximize, Download, RotateCcw } from 'lucide-react'
import type { MermaidConfig } from 'mermaid'

// Mermaid 配置
const mermaidConfig: MermaidConfig = {
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  mindmap: {
    useMaxWidth: true,
  },
}

const mockMermaidCode = `mindmap
  root((搜索算法))
    BFS 广度优先
      队列结构
      层序遍历
      最短路径
      完备性保证
    DFS 深度优先
      栈/递归实现
      回溯算法
      连通性检测
      内存效率高
    A* 算法
      启发函数 h(n)
      f(n)=g(n)+h(n)
      最优搜索
      admissible 启发
    博弈搜索
      MinMax 算法
      Alpha-Beta 剪枝
      博弈树
      评估函数
`

export default function MindMapPage() {
  const mermaidRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadMermaid = async () => {
      const mermaid = (await import('mermaid')).default
      mermaid.initialize(mermaidConfig)

      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = ''
        const { svg } = await mermaid.render('mindmap-svg', mockMermaidCode)
        mermaidRef.current.innerHTML = svg
      }
    }

    loadMermaid()
  }, [])

  const handleZoomIn = () => {
    const svg = mermaidRef.current?.querySelector('svg')
    if (svg) {
      const currentScale = parseFloat(svg.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1')
      svg.style.transform = `scale(${currentScale * 1.2})`
    }
  }

  const handleZoomOut = () => {
    const svg = mermaidRef.current?.querySelector('svg')
    if (svg) {
      const currentScale = parseFloat(svg.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1')
      svg.style.transform = `scale(${currentScale / 1.2})`
    }
  }

  const handleReset = () => {
    const svg = mermaidRef.current?.querySelector('svg')
    if (svg) {
      svg.style.transform = 'scale(1)'
    }
  }

  const handleDownload = () => {
    const svg = mermaidRef.current?.querySelector('svg')
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mindmap.svg'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🧠 思维导图</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            title="放大"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            title="缩小"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            title="重置"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            title="下载"
          >
            <Download size={18} />
          </button>
          <button
            onClick={() => {
              const el = mermaidRef.current?.closest('.mindmap-container')
              if (el) {
                if (document.fullscreenElement) {
                  document.exitFullscreen()
                } else {
                  el.requestFullscreen()
                }
              }
            }}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            title="全屏"
          >
            <Maximize size={18} />
          </button>
        </div>
      </div>

      {/* 知识点选择 */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {['搜索算法', '监督学习', '深度学习', 'NLP', '计算机视觉'].map((kp) => (
          <button
            key={kp}
            className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-primary-50 text-primary-600 border border-primary-200"
          >
            {kp}
          </button>
        ))}
      </div>

      {/* 思维导图容器 */}
      <div className="mindmap-container bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
        <div
          ref={mermaidRef}
          className="w-full h-full flex items-center justify-center p-8 overflow-auto"
        />
      </div>

      {/* 知识掌握度 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 知识掌握度</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'BFS', mastery: 85 },
            { name: 'DFS', mastery: 80 },
            { name: 'A*', mastery: 60 },
            { name: 'MinMax', mastery: 40 },
          ].map((item) => (
            <div key={item.name} className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                  <circle
                    cx="32" cy="32" r="28"
                    stroke="#3b82f6"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${(item.mastery / 100) * 176} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">
                  {item.mastery}%
                </span>
              </div>
              <p className="text-sm font-medium text-gray-700">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
