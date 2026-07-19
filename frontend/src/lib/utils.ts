import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(str))
  return div.innerHTML
}

/** 简易 toast 提示（替代 alert） */
export function showToast(msg: string, duration = 2500) {
  if (typeof document === 'undefined') return
  const el = document.createElement('div')
  el.textContent = msg
  Object.assign(el.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.78)', color: '#fff', padding: '8px 20px',
    borderRadius: '8px', fontSize: '13px', zIndex: '99999',
    transition: 'opacity 0.3s', opacity: '1',
  })
  document.body.appendChild(el)
  setTimeout(() => { el.style.opacity = '0' }, duration - 300)
  setTimeout(() => el.remove(), duration)
}

/**
 * 从 LLM 响应中提取纯文本内容
 * 处理：纯文本、JSON {answer: "..."}、带 thinking 标签的文本
 */
export function extractAnswer(data: any): { answer: string; suggestion: string } {
  // 已经是解析好的对象
  if (data && typeof data === 'object' && data.answer && typeof data.answer === 'string' && !data.answer.includes('"answer"')) {
    return { answer: data.answer, suggestion: data.suggestion || '' }
  }

  // data.answer 可能是 JSON 字符串
  const raw = typeof data?.answer === 'string' ? data.answer : JSON.stringify(data)
  // 去掉 thinking 标签
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  // 尝试解析 JSON
  try {
    const parsed = JSON.parse(cleaned)
    if (parsed.answer) return { answer: parsed.answer, suggestion: parsed.suggestion || '' }
  } catch {}

  // 花括号匹配提取
  if (cleaned.includes('{')) {
    const start = cleaned.indexOf('{')
    let depth = 0
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++
      else if (cleaned[i] === '}') {
        depth--
        if (depth === 0) {
          try {
            const parsed = JSON.parse(cleaned.substring(start, i + 1))
            if (parsed.answer) return { answer: parsed.answer, suggestion: parsed.suggestion || '' }
          } catch {}
          break
        }
      }
    }
  }

  return { answer: cleaned, suggestion: '' }
}
