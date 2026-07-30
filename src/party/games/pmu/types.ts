export interface PmuCard {
  id: string
  rank: number
  suit: number
}

export interface PmuBet {
  suit: number
  sips: number
}

export type PmuRaceEvent =
  | { type: 'draw'; card: PmuCard; suit: number; newPosition: number }
  | { type: 'setback'; card: PmuCard; suit: number; newPosition: number; row: number }
  | { type: 'finish'; suit: number }

export interface PmuRaceResultEntry {
  bet: PmuBet
  won: boolean
  sipsToDrink: number
  sipsToGive: number
  remaining: number
  given: Record<string, number>
}

export interface PmuClientState {
  bets: Record<string, PmuBet>
  positions: number[]
  events: PmuRaceEvent[]
  raceStartedAt: number | null
  winnerSuit: number | null
  raceResults: Record<string, PmuRaceResultEntry>
  totalSipsDrunk: Record<string, number>
  totalSipsGiven: Record<string, number>
  raceWins: Record<string, number>
  racesPlayed: number
  votedCount: number
  votedMemberIds: string[]
  yourVote: PmuBet | null
}

export const PMU_TRACK_LEN = 7

/** Les 4 chevaux (index = suit, même convention que les cartes : 0=♠ 1=♥ 2=♦ 3=♣). */
export const HORSES = [
  { suit: 0, name: 'Tonnerre de Pique', symbol: '♠', color: '#a78bfa', red: false },
  { suit: 1, name: 'Cœur Vaillant', symbol: '♥', color: '#f87171', red: true },
  { suit: 2, name: "Carreau d'Or", symbol: '♦', color: '#fbbf24', red: true },
  { suit: 3, name: 'Trèfle Turbo', symbol: '♣', color: '#34d399', red: false },
] as const
