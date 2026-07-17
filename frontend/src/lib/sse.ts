// 共享 SSE 流式事件处理工具
// 统一 retry / timeout / abort 逻辑，减少 4 处重复实现

export interface ChatEvent {
  type: 'session' | 'progress' | 'result' | 'done' | 'error' | 'token' | 'thinking' | 'analysis' | 'similar'
  session_id?: string
  progress?: number
  message?: string
  content?: string
  data?: any
  step?: number
  text?: string
}

const MAX_RETRIES = 2
const INITIAL_DELAY = 1000

export async function fetchSSEStream(
  url: string,
  body: object,
  onEvent: (e: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zhishu_token') : null
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { onEvent(JSON.parse(line.slice(6))) } catch { /* ignore malformed */ }
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createEventStream(
  url: string,
  body: object,
  onEvent: (e: ChatEvent) => void,
  timeoutMs = 120_000,
): () => void {
  const controller = new AbortController()
  let stopped = false
  let retries = 0

  async function run() {
    while (!stopped) {
      const timeout = setTimeout(() => {
        if (!stopped) controller.abort()
      }, timeoutMs)
      try {
        await fetchSSEStream(url, body, onEvent, controller.signal)
        return // success
      } catch (err: any) {
        if (stopped || err?.name === 'AbortError') return
        retries++
        if (retries > MAX_RETRIES) {
          onEvent({ type: 'error', message: `连接失败（已重试 ${MAX_RETRIES} 次）` })
          return
        }
        await delay(INITIAL_DELAY * retries)
      } finally {
        clearTimeout(timeout)
      }
    }
  }

  run()
  return () => { stopped = true; controller.abort() }
}
