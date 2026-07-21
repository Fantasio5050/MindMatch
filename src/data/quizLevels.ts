import { questions } from './questions'
import type { Question } from '../types'

/** Les 3 longueurs du test de personnalité. Le sous-ensemble est déterministe (1 question sur N,
 * réparties sur toute la banque) pour rester équilibré entre catégories et traits — le scoring
 * normalise de toute façon sur les questions répondues. */
export type QuizLevel = 'rapide' | 'normal' | 'precis'

export interface QuizLevelMeta {
  key: QuizLevel
  name: string
  emoji: string
  count: number
  duration: string
  blurb: string
}

export const QUIZ_LEVELS: QuizLevelMeta[] = [
  { key: 'rapide', name: 'Rapide', emoji: '⚡', count: 12, duration: '~2 min', blurb: 'Un aperçu express de ton profil' },
  { key: 'normal', name: 'Normal', emoji: '🎯', count: 24, duration: '~4 min', blurb: 'Le bon équilibre précision / durée' },
  { key: 'precis', name: 'Précis', emoji: '🔬', count: 36, duration: '~6 min', blurb: 'Le profil le plus fiable' },
]

export function quizLevelMeta(key: QuizLevel): QuizLevelMeta {
  return QUIZ_LEVELS.find((l) => l.key === key) ?? QUIZ_LEVELS[2]
}

/** Questions du niveau demandé. 'precis' = banque complète ; 'normal' = 2 sur 3 ; 'rapide' = 1
 * sur 3. L'échantillonnage par pas régulier garde la répartition des catégories/traits. */
export function questionsForLevel(level: QuizLevel): Question[] {
  if (level === 'precis') return questions
  if (level === 'normal') return questions.filter((_, i) => i % 3 !== 2)
  return questions.filter((_, i) => i % 3 === 0)
}
