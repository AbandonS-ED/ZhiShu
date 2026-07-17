'use client'

import OptionButton from './OptionButton'

interface Exercise {
  type: 'choice' | 'judge' | 'short_answer' | 'coding'
  question: string
  options?: string[]
  answer?: string
  explanation?: string
  difficulty?: number
}

interface Answer {
  selected: number | boolean | string | null
  correct: boolean | null
  score?: number
  feedback?: string
  suggestion?: string
}

interface QuestionCardProps {
  exercise: Exercise
  index: number
  answer: Answer
  submitted: boolean
  scoringStatus?: 'pending' | 'scoring' | 'done'
  onSelectAnswer: (questionIndex: number, answer: number | boolean | string) => void
}

export default function QuestionCard({ 
  exercise, 
  index, 
  answer, 
  submitted,
  scoringStatus,
  onSelectAnswer 
}: QuestionCardProps) {
  const typeLabels: Record<string, string> = {
    choice: '选择题',
    judge: '判断题',
    short_answer: '简答题',
    coding: '编程题'
  }

  return (
    <div className="quiz-question">
      <div className="question-header">
        <span className="question-number">第 {index + 1} 题</span>
        <span className="question-type">{typeLabels[exercise.type]}</span>
        {exercise.difficulty && (
          <span className="question-difficulty">
            难度: {exercise.difficulty}%
          </span>
        )}
      </div>
      
      <div className="question-text">{exercise.question}</div>
      
      {/* 选择题选项 */}
      {exercise.type === 'choice' && exercise.options && (
        <div className="question-options">
          {exercise.options.map((option, optIndex) => {
            // 计算正确答案的索引
            const correctIndex = exercise.answer ? exercise.answer.charCodeAt(0) - 65 : -1
            const isThisOptionCorrect = submitted && optIndex === correctIndex
            const isThisOptionSelected = answer?.selected === optIndex
            const isThisOptionIncorrect = submitted && isThisOptionSelected && !isThisOptionCorrect
            
            return (
              <OptionButton
                key={optIndex}
                label={String.fromCharCode(65 + optIndex)}
                text={option}
                selected={isThisOptionSelected}
                submitted={submitted}
                isCorrect={isThisOptionCorrect}
                isIncorrect={isThisOptionIncorrect}
                onClick={() => onSelectAnswer(index, optIndex)}
              />
            )
          })}
        </div>
      )}
      
      {/* 判断题选项 */}
      {exercise.type === 'judge' && (
        <div className="question-options judge">
          {(() => {
            const correctBool = exercise.answer === 'true' || exercise.answer === '对'
            const isTrueCorrect = submitted && correctBool === true
            const isFalseCorrect = submitted && correctBool === false
            const isTrueSelected = answer?.selected === true
            const isFalseSelected = answer?.selected === false
            
            return (
              <>
                <OptionButton
                  label="✓"
                  text="正确"
                  selected={isTrueSelected}
                  submitted={submitted}
                  isCorrect={isTrueCorrect}
                  isIncorrect={submitted && isTrueSelected && !isTrueCorrect}
                  onClick={() => onSelectAnswer(index, true)}
                />
                <OptionButton
                  label="✗"
                  text="错误"
                  selected={isFalseSelected}
                  submitted={submitted}
                  isCorrect={isFalseCorrect}
                  isIncorrect={submitted && isFalseSelected && !isFalseCorrect}
                  onClick={() => onSelectAnswer(index, false)}
                />
              </>
            )
          })()}
        </div>
      )}

      {/* 简答题输入框 */}
      {exercise.type === 'short_answer' && (
        <div className="short-answer-box">
          <textarea
            className="short-answer-input"
            placeholder="请输入你的答案..."
            value={(answer?.selected as string) || ''}
            onChange={(e) => onSelectAnswer(index, e.target.value)}
            rows={6}
            disabled={submitted}
          />
          
          {/* 评分状态显示 */}
          {submitted && scoringStatus === 'scoring' && (
            <div className="scoring-status">
              <div className="scoring-spinner"></div>
              <span>AI 评分中...</span>
            </div>
          )}
          
          {/* 评分结果显示 */}
          {submitted && scoringStatus === 'done' && (
            <div className="ai-feedback">
              {answer?.score !== undefined && (
                <div className="score-display">
                  <span className="score-label">AI评分：</span>
                  <span className={`score-value ${answer.score >= 60 ? 'pass' : 'fail'}`}>
                    {answer.score}分
                  </span>
                </div>
              )}
              {answer?.feedback && (
                <div className="feedback-section">
                  <h4>AI反馈：</h4>
                  <p>{answer.feedback}</p>
                </div>
              )}
              {answer?.suggestion && (
                <div className="suggestion-section">
                  <h4>改进建议：</h4>
                  <p>{answer.suggestion}</p>
                </div>
              )}
            </div>
          )}
          
          {submitted && scoringStatus === 'done' && exercise.answer && (
            <div className="reference-answer">
              <h4>参考答案：</h4>
              <p>{exercise.answer}</p>
              {exercise.explanation && (
                <div className="answer-explanation">
                  <h4>解析：</h4>
                  <p>{exercise.explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}