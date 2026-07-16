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
}

interface QuestionCardProps {
  exercise: Exercise
  index: number
  answer: Answer
  submitted: boolean
  onSelectAnswer: (questionIndex: number, answer: number | boolean | string) => void
}

export default function QuestionCard({ 
  exercise, 
  index, 
  answer, 
  submitted, 
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
          {exercise.options.map((option, optIndex) => (
            <OptionButton
              key={optIndex}
              label={String.fromCharCode(65 + optIndex)}
              text={option}
              selected={answer?.selected === optIndex}
              submitted={submitted}
              isCorrect={answer?.correct === true}
              onClick={() => onSelectAnswer(index, optIndex)}
            />
          ))}
        </div>
      )}
      
      {/* 判断题选项 */}
      {exercise.type === 'judge' && (
        <div className="question-options judge">
          <OptionButton
            label="✓"
            text="正确"
            selected={answer?.selected === true}
            submitted={submitted}
            isCorrect={answer?.correct === true}
            onClick={() => onSelectAnswer(index, true)}
          />
          <OptionButton
            label="✗"
            text="错误"
            selected={answer?.selected === false}
            submitted={submitted}
            isCorrect={answer?.correct === true}
            onClick={() => onSelectAnswer(index, false)}
          />
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
          {submitted && exercise.answer && (
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