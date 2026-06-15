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

export function markdownToHtml(md: string): string {
  if (!md) return ''

  // 先对 HTML 整体做安全转义（代码块内的除外）
  function esc(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // 提取代码块，保护其内容不被后续替换破坏
  const codeBlocks: string[] = []
  let html = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    codeBlocks.push(`<div class="codeblk"><div class="code-header"><span>${esc(lang || '代码')}</span></div><pre>${escaped}</pre></div>`)
    return `\x00CB${idx}\x00`
  })

  // 提取行内代码
  const inlineCodes: string[] = []
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length
    inlineCodes.push(`<code style="background:#f0f0f0;padding:1px 5px;border-radius:3px;font-size:12px">${esc(code)}</code>`)
    return `\x00IC${idx}\x00`
  })

  // 表格
  html = html.replace(/(?:^|\n)((?:\|[^\n]+\|\n)+)/g, (match, tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter((r: string) => r.trim())
    if (rows.length < 2) return match
    const dataRows = rows.filter((r: string) => !/^\|[\s-:|]+\|$/.test(r.trim()))
    if (dataRows.length === 0) return match
    const headerCells = dataRows[0].split('|').filter((c: string) => c.trim())
    let table = '<table style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px"><thead><tr>'
    headerCells.forEach((c: string) => { table += `<th style="border:1px solid #ddd;padding:6px 10px;background:#f8f8f8;text-align:left">${esc(c.trim())}</th>` })
    table += '</tr></thead><tbody>'
    dataRows.slice(1).forEach((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim())
      table += '<tr>'
      cells.forEach((c: string) => { table += `<td style="border:1px solid #ddd;padding:6px 10px">${esc(c.trim())}</td>` })
      table += '</tr>'
    })
    table += '</tbody></table>'
    return '\n' + table + '\n'
  })

  // 标题
  html = html.replace(/^#### (.+)$/gm, (_, t) => `<h4 style="margin:12px 0 6px;font-size:14px">${esc(t)}</h4>`)
  html = html.replace(/^### (.+)$/gm, (_, t) => `<h3 style="margin:14px 0 8px;font-size:15px">${esc(t)}</h3>`)
  html = html.replace(/^## (.+)$/gm, (_, t) => `<h2 style="margin:16px 0 8px;font-size:16px">${esc(t)}</h2>`)
  html = html.replace(/^# (.+)$/gm, (_, t) => `<h1 style="margin:18px 0 10px;font-size:18px">${esc(t)}</h1>`)

  // 加粗和斜体（内容已在后续段落中转义）
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // 无序列表
  html = html.replace(/^(?:- (.+)\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map((l: string) => `<li>${esc(l.replace(/^- /, ''))}</li>`).join('')
    return `<ul style="margin:6px 0;padding-left:20px">${items}</ul>`
  })

  // 有序列表
  html = html.replace(/^(?:\d+\. (.+)\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map((l: string) => `<li>${esc(l.replace(/^\d+\. /, ''))}</li>`).join('')
    return `<ol style="margin:6px 0;padding-left:20px">${items}</ol>`
  })

  // 链接（过滤 javascript:/data: 协议）
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    const safeHref = /^(https?:|\/|#)/i.test(href) ? href : '#'
    // 内部链接（/开头）在当前页面跳转，外部链接新标签页打开
    const target = href.startsWith('/') ? '_self' : '_blank'
    return `<a href="${esc(safeHref)}" target="${target}" style="color:var(--warm)">${esc(text)}</a>`
  })

  // 引用块
  html = html.replace(/^> (.+)$/gm, (_, t) => `<blockquote style="border-left:3px solid var(--warm);padding-left:10px;color:var(--ink-3);margin:8px 0">${esc(t)}</blockquote>`)

  // 段落（连续文本行合并）
  html = html.replace(/^(?!<[a-z/!]|$)(.+)$/gm, (_, t) => `<p>${esc(t)}</p>`)
  // 清理空段落
  html = html.replace(/<p>\s*<\/p>/g, '')

  // 还原代码块和行内代码
  html = html.replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[Number(i)])
  html = html.replace(/\x00IC(\d+)\x00/g, (_, i) => inlineCodes[Number(i)])

  return html
}
