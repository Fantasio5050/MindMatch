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
  yourSubmission: string | null
}
