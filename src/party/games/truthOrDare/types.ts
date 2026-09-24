import type { TruthOrDareType, TruthOrDarePack } from '../../../data/truthOrDare'

export interface TruthOrDareHistoryEntry {
  memberId: string
  partnerId: string | null
  choice: TruthOrDareType
  cardText: string
  approved: boolean
  refused: boolean
}

export interface TruthOrDarePlayerState {
  streakTruth: number
  streakDare: number
  truthsAnswered: number
  daresCompleted: number
  daresRefused: number
}

export interface TruthOrDareClientState {
  phase: 'choosing' | 'revealed' | 'result' | 'ended'
  pack: TruthOrDarePack | 'mixed'
  players: string[]
  currentCard: { id: string; type: TruthOrDareType; text: string } | null
  currentMemberId: string | null
  /** Partenaire désigné en Double Action */
  partnerId: string | null
  currentChoice: TruthOrDareType | null
  forcedChoice: TruthOrDareType | null
  totalRounds: number
  turnIndex: number
  turnOrder: string[]
  playerStates: Record<string, TruthOrDarePlayerState>
  history: TruthOrDareHistoryEntry[]
  /** Qui a voté (public) */
  votedIds: string[]
  /** Qui doit voter : tout le monde sauf le ou les joueurs du défi */
  expectedVoters: string[]
  canVote: boolean
  /** Ton vote, à toi seul avant le verdict */
  yourVote: boolean | null
  /** Nombre de « validé », révélé avec le verdict */
  approveCount: number | null
}

export const CHOICE_LABEL: Record<TruthOrDareType, string> = {
  truth: 'Vérité',
  dare: 'Action',
  'double-dare': 'Double Action',
}

export const CHOICE_ICON: Record<TruthOrDareType, string> = {
  truth: '🗣️',
  dare: '🎯',
  'double-dare': '🤝',
}