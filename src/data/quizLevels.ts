import { questions } from './questions'
import type { Question, QuestionCategory } from '../types'

/**
 * Les 3 longueurs du test de personnalité, et le TIRAGE des questions.
 *
 * ## Pourquoi un tirage, et pas un sous-ensemble fixe
 * L'ancienne version prenait « 1 question sur 3 » : deux passages successifs posaient exactement
 * les mêmes questions, et le niveau Précis posait toujours la banque entière. Refaire le test
 * n'avait donc aucun intérêt. La banque compte désormais 106 questions pour un test long de 40 :
 * chaque passage en pioche un sous-ensemble différent.
 *
 * ## Pourquoi c'est déterministe malgré tout
 * Le tirage est semé par `seed` — en pratique l'identifiant du joueur + son numéro de passage.
 * Conséquence : recharger la page au milieu du test redonne EXACTEMENT les mêmes questions dans le
 * même ordre (la reprise se fait sur les réponses déjà données, elle serait cassée par un
 * re-tirage), tandis qu'un nouveau passage change de graine et donc de questions.
 *
 * ## Pourquoi c'est stratifié
 * Un tirage uniforme sur 106 questions peut sortir 12 dilemmes d'affilée et aucune préférence.
 * On pioche donc proportionnellement DANS CHAQUE catégorie, ce qui garde le profil comparable
 * d'un passage à l'autre — et entre deux joueurs qui n'ont pas eu les mêmes questions.
 */
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
  { key: 'normal', name: 'Normal', emoji: '🎯', count: 25, duration: '~4 min', blurb: 'Le bon équilibre précision / durée' },
  { key: 'precis', name: 'Précis', emoji: '🔬', count: 40, duration: '~7 min', blurb: 'Le profil le plus fiable' },
]

export function quizLevelMeta(key: QuizLevel): QuizLevelMeta {
  return QUIZ_LEVELS.find((l) => l.key === key) ?? QUIZ_LEVELS[2]
}

/** Taille totale de la banque — sert à annoncer honnêtement la variété dans l'UI. */
export const QUESTION_BANK_SIZE = questions.length

/** Générateur pseudo-aléatoire déterministe (mulberry32). Petit, sans dépendance, et surtout
 * reproductible : même graine = même tirage, sur tous les appareils. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hache une chaîne en entier 32 bits (FNV-1a) pour transformer « memberId:passage » en graine. */
export function seedFrom(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const CATEGORIES: QuestionCategory[] = ['personality', 'values', 'dilemma', 'preference']

/**
 * Le sous-ensemble de questions d'un passage.
 *
 * @param level  longueur choisie dans le salon
 * @param seed   graine du passage (voir `seedFrom`). Omise, le tirage est aléatoire à chaque appel
 *               — pratique pour un aperçu, jamais pour un test en cours.
 */
export function questionsForLevel(level: QuizLevel, seed?: number): Question[] {
  const target = Math.min(quizLevelMeta(level).count, questions.length)
  const rand = rng(seed ?? Math.floor(Math.random() * 0xffffffff))

  const pools = CATEGORIES.map((c) => shuffled(questions.filter((q) => q.category === c), rand))
  const picked: Question[] = []

  // Répartition proportionnelle à la taille de chaque catégorie, puis complément au tour par tour
  // pour absorber les arrondis. Aucune catégorie ne peut donc être absente d'un test long.
  const quotas = pools.map((pool) => Math.floor((pool.length / questions.length) * target))
  pools.forEach((pool, i) => picked.push(...pool.slice(0, quotas[i])))

  let cursor = 0
  while (picked.length < target) {
    const i = cursor % pools.length
    const pool = pools[i]
    const taken = quotas[i]
    if (taken < pool.length) {
      picked.push(pool[taken])
      quotas[i] = taken + 1
    }
    cursor++
    // Sécurité : si toutes les catégories sont épuisées, on s'arrête plutôt que de boucler.
    if (cursor > pools.length * questions.length) break
  }

  // Mélange final : sans lui, le test enchaînerait les 4 catégories en blocs.
  return shuffled(picked, rand).slice(0, target)
}
