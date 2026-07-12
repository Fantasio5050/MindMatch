import type { PartyQuestion } from '../../../data/partyQuestions'

export interface RoundHistoryEntry {
  question: PartyQuestion
  tally: Record<string, number>
  winnerId: string | null
}

export interface WhoIsMostLikelyClientState {
  currentQuestion: PartyQuestion | null
  totalRounds: number
  history: RoundHistoryEntry[]
  votedCount: number
  yourVote: string | null
}
