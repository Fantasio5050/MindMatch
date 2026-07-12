import type { PartyCard, PartyCardType } from '../../../data/partyCards'

export interface PartyCardsHistoryEntry {
  card: PartyCard
  assignedMemberId: string
}

export interface PartyCardsClientState {
  pack: 'classic' | 'trash' | 'mixed'
  currentCard: PartyCard | null
  assignedMemberId: string | null
  totalRounds: number
  history: PartyCardsHistoryEntry[]
}

export const CARD_TYPE_LABEL: Record<PartyCardType, string> = {
  action: 'Action',
  verite: 'Vérité',
  defi: 'Défi',
}
