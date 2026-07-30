import type { Dilemma, DilemmaPack } from '../../../data/dilemmas'

export interface DilemmaHistoryEntry {
  dilemma: Dilemma
  tallyA: number
  tallyB: number
}

export interface DilemmasClientState {
  pack: DilemmaPack | 'mixed'
  currentDilemma: Dilemma | null
  totalRounds: number
  history: DilemmaHistoryEntry[]
  votedCount: number
  votedMemberIds: string[]
  yourVote: 'A' | 'B' | null
}
