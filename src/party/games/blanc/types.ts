/** État client du Grand Blanc — miroir de l'état serveur après sanitization (le paquet et les
 * auteurs des cartes sont masqués ; `yourHand` / `yourEntryIndex` sont dérivés pour le joueur). */

export interface BlancAnswerCard {
  id: string
  text: string
}

export interface BlancPlay {
  text: string
}

export interface BlancEntry {
  text: string
  authorId: string
}

export interface BlancRoundResult {
  promptText: string
  entries: BlancEntry[]
  votesByEntry: number[]
  winnerEntryIndices: number[]
}

export interface BlancClientState {
  currentPrompt: { id: string; text: string } | null
  order: string[]
  yourHand: BlancAnswerCard[]
  submittedCount: number
  yourSubmission: string | null
  plays: BlancPlay[]
  votedCount: number
  yourVote: number | null
  yourEntryIndex?: number | null
  results: BlancRoundResult | null
  scores: Record<string, number>
  totalRounds: number
  roundsPlayed: number
}

export const BLANC_BLANK = '___'

/** Remplit le trou d'une carte noire avec le texte d'une carte blanche (pour l'affichage résultat). */
export function fillBlank(promptText: string, answer: string): string {
  if (!promptText.includes(BLANC_BLANK)) return `${promptText} ${answer}`
  return promptText.replace(BLANC_BLANK, answer)
}
