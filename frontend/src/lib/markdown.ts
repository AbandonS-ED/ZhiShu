import { marked } from 'marked'

export function markdownToHtml(md: string): string {
  if (!md) return ''

  // 去除首尾空白
  md = md.trim()

  // 配置 marked：启用换行符转换，禁用标题ID
  marked.setOptions({
    breaks: true,
    gfm: true,
  })

  // 使用 marked 统一处理 markdown 和 HTML 混合内容
  return marked.parse(md) as string
}
