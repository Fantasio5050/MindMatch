import type { TruthOrDareType, TruthOrDarePack } from '../../../data/truthOrDare'

export interface TruthOrDareHistoryEntry {
  memberId: string
  choice: TruthOrDareType
  cardText: string
  approved: boolean
}

export interface TruthOrDarePlayerState {
  streakTruth: number
  streakDare: number
  truthsAnswered: number
  daresCompleted: number
  daresRefused: number
}

export interface TruthOrDareClientState {
  pack: TruthOrDarePack | 'mixed'
  currentCard: { id: string; type: TruthOrDareType; text: string } | null
  currentMemberId: string | null
  currentChoice: TruthOrDareType | null
  forcedChoice: TruthOrDareType | null
  votes: Record<string, boolean>
  roundComplete: boolean
  choiceComplete: boolean
  totalRounds: number
  playerStates: Record<string, TruthOrDarePlayerState>
  turnOrder: string[]
  turnIndex: number
  history: TruthOrDareHistoryEntry[]
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