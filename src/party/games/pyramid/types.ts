export interface HandCard {
  id: string
  /** Absent while the server masks the hand (post-memorize) — see `handsHidden`. */
  rank?: number
  suit?: number
}

export type AccusationStatus = 'pending' | 'accepted' | 'awaiting-proof' | 'contested-wrong' | 'contested-right'

export interface Accusation {
  id: string
  cardIndex: number
  accuserId: string
  targetId: string
  status: AccusationStatus
  /** Sips at stake for this specific claim (may be less than the card's full value — see the
   * distribution budget: level 2+ cards split into several 1-sip claims). */
  sips: number
}

export interface PyramidCard {
  id: string
  rank: number
  suit: number
  row: number
  sips: number | 'culsec'
  revealed: boolean
}

export interface RecitationGuess {
  rank: number
  suit: number
}

export interface RecitationEntry {
  guesses: RecitationGuess[]
  /** Real hand, revealed once recited (public — like flipping your cards on the table). */
  actualHand: { id: string; rank: number; suit: number }[]
  perCard: { rankCorrect: boolean; suitCorrect: boolean }[]
  score: number
  bonusSips: number
  remaining: number
  given: Record<string, number>
}

export interface PyramidClientState {
  pyramid: PyramidCard[]
  currentIndex: number
  accusations: Accusation[]
  totalSipsReceived: Record<string, number>
  recitation: Record<string, RecitationEntry>
  yourHand: HandCard[]
  /** True from the end of the memorize window until the recitation — your cards stay face-down. */
  handsHidden?: boolean
}

export const SUITS: { symbol: string; red: boolean }[] = [
  { symbol: '♠', red: false },
  { symbol: '♥', red: true },
  { symbol: '♦', red: true },
  { symbol: '♣', red: false },
]

const RANK_LABELS: Record<number, string> = { 1: 'A', 11: 'V', 12: 'D', 13: 'R' }

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank)
}

export function sipLabel(sips: number | 'culsec'): string {
  if (sips === 'culsec') return 'CUL SEC 🥃'
  return `${sips} gorgée${sips > 1 ? 's' : ''}`
}

/** How many times a player may distribute for a given card — mirrors the server's rule exactly
 * (see server/games/pyramid.ts::distributionBudget) so the button can disable itself locally
 * instead of waiting on a round-trip. Level 1 and cul sec: 1 shot, all-or-nothing. Levels 2-4:
 * as many slots as the card is worth, splittable across different players. */
export function distributionSlots(sips: number | 'culsec'): number {
  return sips === 'culsec' ? 1 : sips
}
