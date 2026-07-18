export interface BJCard {
  rank: number // 1=A, 2..10, 11=V, 12=D, 13=R
  suit: number // 0..3
}

export interface BJClientHand {
  cards: BJCard[]
  stood: boolean
  bust: boolean
  blackjack: boolean
}

export type BJOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust'

export interface BJClientResult {
  outcome: BJOutcome
  bet: number
  sips: number
  chips: number
}

/** État client du Blackjack — miroir de l'état serveur, le paquet et la carte cachée du croupier
 * (`secrets`) ayant été retirés par la sanitization. */
export interface BlackjackClientState {
  order: string[]
  adult: boolean
  bets: Record<string, number>
  playerHands: Record<string, BJClientHand>
  dealerUp: BJCard | null
  dealer: { cards: BJCard[]; total: number; bust: boolean } | null
  results: Record<string, BJClientResult> | null
  totalSips: Record<string, number>
  chips: Record<string, number>
  roundsPlayed: number
}

/** Valeur d'une main (As = 11 ou 1). Miroir exact du calcul serveur, pour l'affichage. */
export function handTotal(cards: BJCard[]): number {
  let total = 0
  let aces = 0
  for (const c of cards) {
    if (c.rank === 1) {
      total += 11
      aces++
    } else if (c.rank >= 11) total += 10
    else total += c.rank
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

export const OUTCOME_LABEL: Record<BJOutcome, string> = {
  blackjack: 'Blackjack !',
  win: 'Gagné',
  push: 'Égalité',
  lose: 'Perdu',
  bust: 'Sauté',
}
