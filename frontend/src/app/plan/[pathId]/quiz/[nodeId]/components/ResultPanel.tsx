'use client'

import Icon from '@/components/Icon'

interface ResultPanelProps {
  score: number
  passed: boolean
  onContinue: () => void
  onRetry: () => void
}

export default function ResultPanel({ 
  score, 
  passed, 
  onContinue, 
  onRetry 
}: ResultPanelProps) {
  return (
    <div className={`quiz-result ${passed ? 'passed' : 'failed'}`}>
      <div className="result-icon">
        {passed ? <Icon name="check" size={48} /> : <Icon name="x" size={48} />}
      </div>
      <h2>{passed ? '恭喜通过！' : '未通过'}</h2>
      <div className="result-score">
        <span className="score">{score}</span>
        <span className="label">分</span>
      </div>
      <p>{passed ? '你已掌握该知识点，可以继续学习下一个' : '需要60分以上才能通过，请重新学习后再试'}</p>
      <div className="result-actions">
        <button className="btn-primary" onClick={onContinue}>
          {passed ? '继续学习下一个知识点' : '返回重新学习'}
        </button>
        {!passed && (
          <button className="btn-secondary" onClick={onRetry}>
            重新测验
          </button>
        )}
      </div>
    </div>
  )
}