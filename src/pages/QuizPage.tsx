import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { ProgressBar } from '../components/ProgressBar'
import { questions } from '../data/questions'
import { useAppStore } from '../store/useAppStore'

const CATEGORY_LABEL: Record<string, string> = {
  personality: 'Personnalité',
  values: 'Valeurs',
  dilemma: 'Dilemme',
  preference: 'Préférence',
}

export function QuizPage() {
  const navigate = useNavigate()
  const member = useAppStore((s) => s.currentMember())
  const saveAnswer = useAppStore((s) => s.saveAnswer)
  const finishQuestionnaire = useAppStore((s) => s.finishQuestionnaire)

  const startIndex = useMemo(() => {
    if (!member) return 0
    const answered = Object.keys(member.answers).length
    return Math.min(answered, questions.length - 1)
  }, [member])

  const [index, setIndex] = useState(startIndex)
  const [direction, setDirection] = useState(1)

  if (!member) return null

  const question = questions[index]
  const selected = member.answers[question.id]

  const goNext = () => {
    if (index >= questions.length - 1) {
      finishQuestionnaire()
      navigate('/profile')
      return
    }
    setDirection(1)
    setIndex((i) => i + 1)
  }

  const goBack = () => {
    if (index === 0) return
    setDirection(-1)
    setIndex((i) => i - 1)
  }

  const handleSelect = (optionId: string) => {
    saveAnswer(question.id, optionId)
    setTimeout(goNext, 260)
  }

  return (
    <PageTransition>
      <div className="min-h-svh flex flex-col px-6 pt-8 pb-10 safe-top">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={goBack}
            disabled={index === 0}
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/70 disabled:opacity-30 shrink-0"
          >
            ←
          </button>
          <ProgressBar value={index} total={questions.length} />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={question.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -60 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-fuchsia-300/80 bg-fuchsia-500/10 rounded-full px-3 py-1 mb-4">
                {CATEGORY_LABEL[question.category]}
              </span>
              <h2 className="text-2xl font-bold leading-snug mb-6">{question.prompt}</h2>

              <div className="flex flex-col gap-3">
                {question.options.map((option, i) => {
                  const isSelected = selected === option.id
                  return (
                    <motion.button
                      key={option.id}
                      onClick={() => handleSelect(option.id)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.3 }}
                      whileTap={{ scale: 0.97 }}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                        isSelected
                          ? 'bg-gradient-to-r from-fuchsia-500/20 to-purple-500/20 border-fuchsia-400/60'
                          : 'bg-white/6 border-white/10 active:bg-white/10'
                      }`}
                    >
                      <span className="text-xl shrink-0">{option.emoji}</span>
                      <span className="text-[15px] text-white/90 leading-snug">{option.label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  )
}
