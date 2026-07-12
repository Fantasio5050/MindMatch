export type AutorouteDirection = 'higher' | 'lower'

export interface AutorouteCard {
  id: string
  rank: number
  suit: number
}

export interface AutorouteRoundResultEntry {
  prediction: AutorouteDirection
  correct: boolean
  sipsOwed: number
  newProgress: number
  lapCompleted: boolean
}

export interface AutorouteHistoryEntry {
  referenceCard: AutorouteCard
  drawnCard: AutorouteCard
  tie: boolean
  results: Record<string, AutorouteRoundResultEntry>
}

export interface AutorouteClientState {
  referenceCard: AutorouteCard | null
  progress: Record<string, number>
  laps: Record<string, number>
  totalSipsReceived: Record<string, number>
  totalRounds: number
  history: AutorouteHistoryEntry[]
  votedCount: number
  yourVote: AutorouteDirection | null
}

export const ROAD_LENGTH = 5
