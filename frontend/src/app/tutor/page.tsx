'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, BookOpen, ExternalLink, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAppStore } from '@/stores/appStore'
import type { ChatMessage } from '@/types'

// 模拟对话历史
const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: '请解释一下A*搜索算法的工作原理',
    source_refs: [],
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    role: 'assistant',
    content: `A*搜索算法是一种启发式搜索算法，它结合了Dijkstra算法和贪心最佳优先搜索的优点。

## 核心公式

**f(n) = g(n) + h(n)**

- **g(n)**: 从起点到节点n的**实际代价**
- **h(n)**: 从节点n到目标的**估计代价**（启发函数）
- **f(n)**: 节点n的**总评估值**

## 算法步骤

1. 将起点加入开放列表（Open List）
2. 从开放列表中选择 **f(n)** 最小的节点
3. 如果该节点是目标，搜索结束
4. 否则，将其移入关闭列表（Closed List）
5. 对其所有邻居节点计算 f(n)
6. 如果邻居不在开放列表中，加入；如果已在，比较 g(n) 选择更优路径
7. 重复步骤 2-6

## 关键特性

- **完备性**: 如果存在解，一定能找到
- **最优性**: 当 h(n) 是可采纳的（admissible）时，保证找到最优解
- **效率**: 比 BFS 更快，因为它有方向性

## Python 实现示例

\`\`\`python
import heapq

def a_star(graph, start, goal, h):
    open_list = [(0, start)]
    came_from = {}
    g_score = {start: 0}
    
    while open_list:
        _, current = heapq.heappop(open_list)
        
        if current == goal:
            return reconstruct_path(came_from, current)
        
        for neighbor, cost in graph[current]:
            tentative_g = g_score[current] + cost
            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score = tentative_g + h(neighbor, goal)
                heapq.heappush(open_list, (f_score, neighbor))
    
    return None
\`\`\``,
    agent_name: 'tutor',
    source_refs: [
      { doc_id: '1', chunk_id: 'a1', page: 45, quote: 'A*搜索算法是一种启发式搜索算法...' },
    ],
    created_at: new Date().toISOString(),
  },
]

export default function TutorPage() {
  const { messages, addMessage } = useAppStore()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const allMessages = [...mockMessages, ...messages]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      source_refs: [],
      created_at: new Date().toISOString(),
    }

    addMessage(userMessage)
    setInput('')
    setIsLoading(true)

    // 模拟 AI 响应
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `这是对"${input.trim()}"的回答示例。\n\n在实际项目中，这里会调用后端 RAG API，基于知识库生成准确的回答，并附带来源引用。`,
        agent_name: 'tutor',
        source_refs: [],
        created_at: new Date().toISOString(),
      }
      addMessage(aiMessage)
      setIsLoading(false)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Bot size={20} className="text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">智能问答</h1>
              <p className="text-xs text-gray-500">基于 RAG 的课程问答助手</p>
            </div>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {allMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-3 max-w-[80%] ${
                  msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* 头像 */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                {/* 消息内容 */}
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}

                  {/* 来源引用 */}
                  {msg.source_refs && msg.source_refs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">📚 参考来源</p>
                      {msg.source_refs.map((ref, i) => (
                        <div
                          key={i}
                          className="flex items-center space-x-2 text-xs text-gray-600 hover:text-primary-600 cursor-pointer"
                        >
                          <BookOpen size={12} />
                          <span>《人工智能导论》第{ref.page}页</span>
                          <ExternalLink size={10} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 加载动画 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bot size={16} className="text-gray-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的问题... (Shift+Enter 换行)"
                rows={1}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            💡 提示：可以追问、要求代码示例、或让解释更详细
          </p>
        </div>
      </div>

      {/* 右侧边栏：相关话题 */}
      <div className="w-64 border-l border-gray-200 p-4 hidden lg:block">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📎 相关话题</h3>
        <div className="space-y-2">
          {['搜索算法', '启发式搜索', '图搜索', 'A*算法', 'BFS/DFS'].map((topic) => (
            <button
              key={topic}
              className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              {topic}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">💡 常见问题</h3>
          <div className="space-y-2">
            {[
              'A*和Dijkstra有什么区别？',
              '启发函数怎么设计？',
              '什么时候用BFS？',
            ].map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
