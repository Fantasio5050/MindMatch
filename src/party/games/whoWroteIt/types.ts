import type { WhoWroteItPrompt } from '../../../data/whoWroteItPrompts'

export interface WhoWroteItHistoryEntry {
  prompt: WhoWroteItPrompt
  entries: { text: string; authorId: string }[]
  correctByMember: Record<string, number>
}

export interface WhoWroteItClientState {
  currentPrompt: WhoWroteItPrompt | null
  entries: { text: string }[]
  guesses: Record<string, Record<number, string>>
  revealedAuthors: Record<number, string> | null
  totalRounds: number
  history: WhoWroteItHistoryEntry[]
  submittedCount: number
  submittedMemberIds: string[]
  yourSubmission: string | null
  /** Index de la phrase écrite par le joueur qui reçoit cet état (pendant la phase de devinette),
   * pour que le client la masque de ses propres choix. null s'il n'a pas écrit / hors devinette. */
  yourEntryIndex?: number | null
}
