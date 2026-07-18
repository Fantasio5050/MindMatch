import type { Group, PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

/** Blackjack multijoueur contre une banque commune. Les règles s'adaptent au mode :
 *  - Mode normal : mises en jetons, XP aux gagnants, podium au plus gros tapis.
 *  - Mode 18+ : les mises sont des gorgées. Perdre = boire sa mise, sauter (bust) = mise + 1,
 *    égalité = 1 gorgée, gagner = tu ne bois pas, blackjack = intouchable. Podium au moins imbibé.
 * Le paquet et la carte cachée du croupier vivent dans `secrets` (retiré avant d'atteindre les
 * clients) : impossible de compter les cartes ou de lire le trou du croupier avant la révélation. */

const MIN_BET = 1
const MAX_BET = 5
const DEALER_STANDS_ON = 17
const WIN_XP = 8
const BLACKJACK_XP = 14
const PODIUM_XP = 15

interface Card {
  rank: number // 1=As, 2..10, 11=Valet, 12=Dame, 13=Roi
  suit: number // 0..3
}

interface BJHand {
  cards: Card[]
  stood: boolean
  bust: boolean
  blackjack: boolean
}

type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust'

interface BJResult {
  outcome: Outcome
  bet: number
  sips: number
  chips: number
}

interface BlackjackState {
  order: string[]
  adult: boolean
  bets: Record<string, number>
  hands: Record<string, BJHand>
  dealerUp: Card | null
  dealer: { cards: Card[]; total: number; bust: boolean } | null
  secrets: { deck: Card[]; dealerHole: Card | null }
  results: Record<string, BJResult> | null
  totalSips: Record<string, number>
  chips: Record<string, number>
  roundsPlayed: number
}

function freshDeck(): Card[] {
  const deck: Card[] = []
  for (let suit = 0; suit < 4; suit++) for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function handTotal(cards: Card[]): number {
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

function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21
}

function emptyState(): BlackjackState {
  return {
    order: [],
    adult: false,
    bets: {},
    hands: {},
    dealerUp: null,
    dealer: null,
    secrets: { deck: [], dealerHole: null },
    results: null,
    totalSips: {},
    chips: {},
    roundsPlayed: 0,
  }
}

function getState(session: PartySession): BlackjackState {
  return (session.roundData as BlackjackState | null) ?? emptyState()
}

function add(totals: Record<string, number>, id: string, amount: number): Record<string, number> {
  return { ...totals, [id]: (totals[id] ?? 0) + amount }
}

/** Prépare une nouvelle donne : mises remises à zéro, paquet neuf, croupier avec une carte visible
 * et une carte cachée. */
function startBettingRound(state: BlackjackState, participantIds: string[]): BlackjackState {
  return {
    ...state,
    order: participantIds,
    bets: {},
    hands: {},
    dealerUp: null,
    dealer: null,
    secrets: { deck: [], dealerHole: null },
    results: null,
  }
}

export const blackjack: GameModule = {
  id: 'blackjack',
  name: 'Blackjack',
  icon: '🃏',
  minPlayers: 2,

  initRound(group, session) {
    const state = getState(session)

    if (session.round === 0 && session.phase === null) {
      const fresh: BlackjackState = {
        ...emptyState(),
        order: [...session.participantIds],
        adult: !!group.adultModeEnabled,
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: fresh } }
    }

    if (session.phase === 'intro') {
      return { session: { ...session, phase: 'betting', round: 1, roundData: startBettingRound(state, session.participantIds) } }
    }

    // Après les résultats, l'hôte relance une nouvelle donne.
    if (session.phase === 'results') {
      return {
        session: {
          ...session,
          phase: 'betting',
          round: session.round + 1,
          roundData: startBettingRound(state, session.participantIds),
        },
      }
    }

    return { session }
  },

  handleAction(_group, session, memberId, action: GameAction) {
    const state = getState(session)

    // --- Mise ---
    if (action.type === 'bet' && session.phase === 'betting') {
      if (!state.order.includes(memberId) || state.bets[memberId] !== undefined) return { session }
      const payload = action.payload as { amount?: number } | null
      const amount = Math.max(MIN_BET, Math.min(MAX_BET, Math.round(payload?.amount ?? MIN_BET)))
      return { session: { ...session, roundData: { ...state, bets: { ...state.bets, [memberId]: amount } } } }
    }

    // --- Tirer une carte ---
    if (action.type === 'hit' && session.phase === 'playing') {
      const hand = state.hands[memberId]
      if (!hand || hand.stood || hand.bust) return { session }
      const deck = [...state.secrets.deck]
      const card = deck.pop()
      if (!card) return { session }
      const cards = [...hand.cards, card]
      const total = handTotal(cards)
      const bust = total > 21
      const nextHand: BJHand = { ...hand, cards, bust, stood: bust ? true : hand.stood }
      return {
        session: {
          ...session,
          roundData: { ...state, hands: { ...state.hands, [memberId]: nextHand }, secrets: { ...state.secrets, deck } },
        },
      }
    }

    // --- Rester ---
    if (action.type === 'stand' && session.phase === 'playing') {
      const hand = state.hands[memberId]
      if (!hand || hand.stood || hand.bust) return { session }
      return {
        session: { ...session, roundData: { ...state, hands: { ...state.hands, [memberId]: { ...hand, stood: true } } } },
      }
    }

    // --- L'hôte clôt la partie -> podium ---
    if (action.type === 'finish' && (session.phase === 'betting' || session.phase === 'playing' || session.phase === 'results')) {
      if (session.hostMemberId !== memberId) return { session }
      const xpAwards = podiumXp(state)
      return { session: { ...session, status: 'ended', phase: 'ended' }, xpAwards }
    }

    return { session }
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'betting' || session.phase === 'playing'
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    if (session.phase === 'betting') {
      return state.order.every((id) => state.bets[id] !== undefined)
    }
    if (session.phase === 'playing') {
      return state.order.every((id) => {
        const h = state.hands[id]
        return h && (h.stood || h.bust || handTotal(h.cards) === 21)
      })
    }
    return false
  },

  resolveRound(_group, session) {
    const state = getState(session)

    // Fin des mises -> distribution des cartes.
    if (session.phase === 'betting') {
      const deck = freshDeck()
      const hands: Record<string, BJHand> = {}
      for (const id of state.order) {
        const cards = [deck.pop()!, deck.pop()!]
        hands[id] = { cards, stood: false, bust: false, blackjack: isBlackjack(cards) }
      }
      const dealerUp = deck.pop()!
      const dealerHole = deck.pop()!
      return {
        session: {
          ...session,
          phase: 'playing',
          roundData: { ...state, hands, dealerUp, dealer: null, secrets: { deck, dealerHole } },
        },
      }
    }

    // Fin des actions joueurs -> le croupier joue puis on résout.
    if (session.phase === 'playing') {
      const deck = [...state.secrets.deck]
      const dealerCards: Card[] = [state.dealerUp!, state.secrets.dealerHole!]
      // Le croupier tire tant qu'il est sous 17 — sauf si tout le monde a déjà sauté.
      const anyoneAlive = state.order.some((id) => !state.hands[id]?.bust)
      while (anyoneAlive && handTotal(dealerCards) < DEALER_STANDS_ON) {
        const c = deck.pop()
        if (!c) break
        dealerCards.push(c)
      }
      const dealerTotal = handTotal(dealerCards)
      const dealerBust = dealerTotal > 21
      const dealerBJ = isBlackjack(dealerCards)

      const results: Record<string, BJResult> = {}
      const xpAwards: XpAward[] = []
      let totalSips = state.totalSips
      let chips = state.chips

      for (const id of state.order) {
        const hand = state.hands[id]
        const bet = state.bets[id] ?? MIN_BET
        const total = handTotal(hand.cards)
        let outcome: Outcome
        if (hand.bust) outcome = 'bust'
        else if (hand.blackjack && !dealerBJ) outcome = 'blackjack'
        else if (dealerBust) outcome = 'win'
        else if (total > dealerTotal) outcome = 'win'
        else if (total === dealerTotal) outcome = 'push'
        else outcome = 'lose'

        // Enjeux : gorgées en 18+, jetons sinon.
        let sips = 0
        let chipDelta = 0
        if (state.adult) {
          if (outcome === 'bust') sips = bet + 1
          else if (outcome === 'lose') sips = bet
          else if (outcome === 'push') sips = 1
          // win / blackjack : le joueur ne boit pas.
        } else {
          if (outcome === 'blackjack') chipDelta = Math.round(bet * 1.5)
          else if (outcome === 'win') chipDelta = bet
          else if (outcome === 'push') chipDelta = 0
          else chipDelta = -bet // lose / bust
        }

        if (sips > 0) totalSips = add(totalSips, id, sips)
        if (chipDelta !== 0) chips = add(chips, id, chipDelta)
        results[id] = { outcome, bet, sips, chips: chipDelta }

        if (outcome === 'win' || outcome === 'blackjack') {
          xpAwards.push({
            memberId: id,
            amount: outcome === 'blackjack' ? BLACKJACK_XP : WIN_XP,
            statIncrements: outcome === 'blackjack' ? { 'blackjack.blackjacks': 1, 'blackjack.wins': 1 } : { 'blackjack.wins': 1 },
            reason: outcome === 'blackjack' ? 'Blackjack !' : 'A battu la banque au Blackjack',
          })
        }
      }

      return {
        session: {
          ...session,
          phase: 'results',
          roundData: {
            ...state,
            dealer: { cards: dealerCards, total: dealerTotal, bust: dealerBust },
            secrets: { deck, dealerHole: null },
            results,
            totalSips,
            chips,
            roundsPlayed: state.roundsPlayed + 1,
          },
        },
        xpAwards,
      }
    }

    return { session }
  },
}

function podiumXp(state: BlackjackState): XpAward[] {
  if (state.order.length === 0) return []
  if (state.adult) {
    const min = Math.min(...state.order.map((id) => state.totalSips[id] ?? 0))
    return state.order
      .filter((id) => (state.totalSips[id] ?? 0) === min)
      .map((id) => ({ memberId: id, amount: PODIUM_XP, statIncrements: { 'blackjack.gamesWon': 1 }, reason: 'A le mieux tenu la banque au Blackjack' }))
  }
  const max = Math.max(...state.order.map((id) => state.chips[id] ?? 0))
  return state.order
    .filter((id) => (state.chips[id] ?? 0) === max)
    .map((id) => ({ memberId: id, amount: PODIUM_XP, statIncrements: { 'blackjack.gamesWon': 1 }, reason: 'A fini avec le plus gros tapis au Blackjack' }))
}
