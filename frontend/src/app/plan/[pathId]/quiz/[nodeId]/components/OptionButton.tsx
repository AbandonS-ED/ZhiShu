'use client'

interface OptionButtonProps {
  label: string
  text: string
  selected: boolean
  submitted: boolean
  isCorrect: boolean
  isIncorrect?: boolean
  onClick: () => void
}

export default function OptionButton({ 
  label, 
  text, 
  selected, 
  submitted, 
  isCorrect,
  isIncorrect = false,
  onClick 
}: OptionButtonProps) {
  const getClassName = () => {
    let className = 'option-btn'
    if (selected) className += ' selected'
    if (submitted && isIncorrect) className += ' incorrect'
    if (submitted && isCorrect) className += ' correct'
    return className
  }

  return (
    <button
      className={getClassName()}
      onClick={onClick}
      disabled={submitted}
    >
      <span className="option-label">{label}</span>
      <span className="option-text">{text}</span>
    </button>
  )
}