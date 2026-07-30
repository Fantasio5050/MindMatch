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
  /** QUI a voté (jamais pour qui) — convention `votes` de sanitizeParty. Alimente GroupPulse. */
  votedMemberIds: string[]
  yourVote: string | null
}
