/**错题本相关常量 — 前后端共用映射。修改这里同步所有页面。

错因类型枚举和 CSS class 与后端 backend/app/agents/wrong_question_agent.py 保持一致。
*/

export interface ErrorTypeConfig {
  label: string
  cls: string
}

export const ERROR_TYPE_CONFIG: Record<string, ErrorTypeConfig> = {
  calculation: { label: '计算失误', cls: 'calculation' },
  concept: { label: '概念不清', cls: 'concept' },
  reading: { label: '审题错误', cls: 'reading' },
  carelessness: { label: '粗心大意', cls: 'carelessness' },
  unknown: { label: '未分析', cls: 'unknown' },
}

export const ERROR_TYPES = Object.keys(ERROR_TYPE_CONFIG)
