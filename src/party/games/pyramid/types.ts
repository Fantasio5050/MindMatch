export interface PyramidCardPlay {
  memberId: string
  targetMemberId: string
  matchCount: number
}

export interface PyramidCard {
  id: string
  rank: number
  row: number
  sips: number | 'culsec'
  revealed: boolean
  plays: PyramidCardPlay[]
}

export interface HandCard {
  id: string
  rank: number
}

export interface PyramidClientState {
  pyramid: PyramidCard[]
  currentIndex: number
  totalSipsReceived: Record<string, number>
  submissions: Record<string, 'played' | 'passed'>
  yourHand: HandCard[]
}

export const RANK_LABELS: Record<number, string> = {
  1: 'A',
  11: 'V',
  12: 'D',
  13: 'R',
}

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank)
}
