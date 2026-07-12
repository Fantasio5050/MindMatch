export type PalmierEffectType =
  | 'drink-self'
  | 'give-sips'
  | 'center-self'
  | 'center-give'
  | 'race'
  | 'left-drinks'
  | 'right-drinks'
  | 'buddy'
  | 'challenge'
  | 'rule'
  | 'king'

export interface PalmierCard {
  id: string
  rank: number
  suit: number
}

export interface PalmierLogEntry {
  card: PalmierCard
  drawerMemberId: string
  effect: PalmierEffectType
  text: string
}

export interface PalmierClientState {
  currentCard: PalmierCard | null
  currentIndex: number
  totalCards: number
  drawerMemberId: string | null
  effect: PalmierEffectType | null
  amount: number
  label: string
  resolved: boolean
  targetMemberId: string | null
  ruleText: string | null
  kingsDrawn: number
  totalSipsReceived: Record<string, number>
  log: PalmierLogEntry[]
}
