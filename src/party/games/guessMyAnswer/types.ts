import type { Question } from '../../../types'

export interface GuessMyAnswerHistoryEntry {
  targetMemberId: string
  question: Question
  correctOptionId: string
  tally: Record<string, number>
  correctGuesserIds: string[]
}

export interface GuessMyAnswerClientState {
  targetMemberId: string | null
  currentQuestion: Question | null
  totalRounds: number
  history: GuessMyAnswerHistoryEntry[]
  votedCount: number
  yourVote: string | null
}
