import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { ProgressBar } from '../components/ProgressBar'
import { questionsForLevel, quizLevelMeta, seedFrom, type QuizLevel } from '../data/quizLevels'
import { useAppStore } from '../store/useAppStore'
import type { Member } from '../types'
import { useSound } from '../hooks/useSound'

const CATEGORY_LABEL: Record<string, string> = {
  personality: 'Personnalité',
  values: 'Valeurs',
  dilemma: 'Dilemme',
  preference: 'Préférence',
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Garde de montage.
 *
 * Au rechargement, le salon est rechargé de façon asynchrone : `currentMember()` vaut null le
 * temps d'un rendu. Ça paraît anodin, mais deux choses en dépendent — la GRAINE du tirage (sans
 * joueur, on tirait un questionnaire « anonyme » remplacé une fraction de seconde plus tard) et
 * l'INDEX de reprise (figé par `useState` au premier rendu, donc calculé sur le mauvais tirage).
 * Résultat observé : recharger en plein test faisait atterrir sur une question totalement
 * différente. On ne monte donc le test qu'une fois le joueur connu.
 */
export function QuizPage() {
  const [searchParams] = useSearchParams()
  const member = useAppStore((s) => s.currentMember())
  const levelParam = searchParams.get('niveau')
  const level: QuizLevel = levelParam === 'rapide' || levelParam === 'normal' ? levelParam : 'precis'
  if (!member) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-soft text-sm">Chargement du test…</p>
      </div>
    )
  }
  // Le NIVEAU fait partie de la clé, au même titre que le joueur et le passage : il vient de la
  // query du hash (`#/quiz?niveau=rapide`) et n'est pas résolu au tout premier rendu après un
  // rechargement. Sans ça, l'index de reprise se calculait sur le tirage « précis » puis le
  // tirage basculait sur « rapide » sous ses pieds — on restait à la question 4/12, mais ce
  // n'était plus la même question.
  return <QuizRunner key={`${member.id}:${member.quizAttempt}:${level}`} member={member} level={level} />
}

function QuizRunner({ member, level }: { member: Member; level: QuizLevel }) {
  const navigate = useNavigate()
  const saveAnswer = useAppStore((s) => s.saveAnswer)
  const finishQuestionnaire = useAppStore((s) => s.finishQuestionnaire)

  // La graine tient au JOUEUR et à son numéro de passage : recharger la page redonne exactement
  // le même tirage (sinon la reprise sur les réponses déjà données n'aurait aucun sens), tandis
  // qu'un nouveau passage — qui incrémente `quizAttempt` — change tout le questionnaire.
  const seed = useMemo(
    () => seedFrom(`${member.id}:${member.quizAttempt}:${level}`),
    [member.id, member.quizAttempt, level],
  )
  const questions = useMemo(() => questionsForLevel(level, seed), [level, seed])
  const levelMeta = quizLevelMeta(level)

  // Reprise : première question du tirage encore sans réponse. Calculé une seule fois, au montage
  // — le composant est monté avec un joueur déjà chargé, donc la valeur est juste d'emblée.
  const [index, setIndex] = useState(() => {
    const firstUnanswered = questions.findIndex((q) => !member.answers[q.id])
    return firstUnanswered === -1 ? questions.length - 1 : firstUnanswered
  })
  const [direction, setDirection] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const { play } = useSound()

  const question = questions[index]
  const selected = member.answers[question.id]

  const goBack = () => {
    if (index === 0) return
    setDirection(-1)
    setIndex((i) => i - 1)
  }

  const handleSelect = async (optionId: string) => {
    if (pending) return
    play('pop')
    setPending(true)
    setError('')
    try {
      await Promise.all([saveAnswer(question.id, optionId), wait(260)])
      if (index >= questions.length - 1) {
        await finishQuestionnaire()
        play('win')
        navigate('/profile')
        return
      }
      setDirection(1)
      setIndex((i) => i + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "La réponse n'a pas pu être enregistrée, réessaie.")
    } finally {
      setPending(false)
    }
  }

  return (
    <PageTransition>
      <div className="min-h-svh flex flex-col px-6 pt-8 pb-10 safe-top">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={goBack}
            disabled={index === 0}
            className="w-9 h-9 rounded-full bg-felt-raised flex items-center justify-center text-chalk-muted disabled:opacity-30 shrink-0"
          >
            ←
          </button>
          <ProgressBar value={index} total={questions.length} />
          <span className="text-[10px] text-chalk-faint shrink-0 px-2 py-1.5 rounded-full bg-felt-raised" title={levelMeta.blurb}>
            {levelMeta.emoji} {levelMeta.name}
          </span>
          <button
            onClick={() => navigate('/lobby')}
            className="text-xs text-chalk-soft shrink-0 px-2 py-1.5 rounded-full bg-felt-raised"
          >
            Salle
          </button>
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

              {error && <p className="text-sm text-pink-400 mb-4">{error}</p>}

              <div className="flex flex-col gap-3">
                {question.options.map((option, i) => {
                  const isSelected = selected === option.id
                  return (
                    <motion.button
                      key={option.id}
                      onClick={() => handleSelect(option.id)}
                      disabled={pending}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.3 }}
                      whileTap={{ scale: 0.97 }}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors disabled:opacity-60 ${
                        isSelected
                          ? 'bg-gradient-to-r from-fuchsia-500/20 to-purple-500/20 border-fuchsia-400/60'
                          : 'bg-felt-raised border-line active:bg-felt-raised'
                      }`}
                    >
                      <span className="text-xl shrink-0">{option.emoji}</span>
                      <span className="text-[15px] text-chalk-muted leading-snug">{option.label}</span>
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
