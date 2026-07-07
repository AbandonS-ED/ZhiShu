import { marked } from 'marked'

export function markdownToHtml(md: string): string {
  if (!md) return ''

  // 去除首尾空白
  md = md.trim()

  // 使用 marked 统一处理 markdown 和 HTML 混合内容
  return marked.parse(md, { breaks: true, gfm: true }) as string
}
