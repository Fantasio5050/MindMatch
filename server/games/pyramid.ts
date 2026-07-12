import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

const HAND_SIZE = 4
const CULSEC_WEIGHT = 10
const CONTEST_XP = 5

interface PyramidRowConfig {
  count: number
  sips: number | 'culsec'
}

// Bottom row first (widest, cheapest), top row last (single card, finish your drink).
const ROWS: PyramidRowConfig[] = [
  { count: 5, sips: 1 },
  { count: 4, sips: 2 },
  { count: 3, sips: 3 },
  { count: 2, sips: 4 },
  { count: 1, sips: 'culsec' },
]

interface Card {
  id: string
  rank: number
  suit: number
}

interface PyramidCardState extends Card {
  row: number
  sips: number | 'culsec'
  revealed: boolean
}

type AccusationStatus = 'pending' | 'accepted' | 'awaiting-proof' | 'contested-wrong' | 'contested-right'

interface Accusation {
  id: string
  cardIndex: number
  accuserId: string
  targetId: string
  status: AccusationStatus
}

interface RecitationGuess {
  rank: number
  suit: number
}

interface RecitationCardResult {
  rankCorrect: boolean
  suitCorrect: boolean
}

interface RecitationEntry {
  guesses: RecitationGuess[]
  /** The player's real hand, revealed publicly once they've recited (like flipping your cards). */
  actualHand: Card[]
  perCard: RecitationCardResult[]
  score: number
  bonusSips: number
  /** Bonus sips not yet handed out — distributed one at a time so they can be split freely. */
  remaining: number
  given: Record<string, number>
}

interface PyramidState {
  hands: Record<string, Card[]>
  /** Once the memorize window closes, hands are masked in every payload (rank/suit stripped by
   * the sanitizer) — players must genuinely play from memory, even by inspecting the network. */
  handsHidden: boolean
  pyramid: PyramidCardState[]
  currentIndex: number
  accusations: Accusation[]
  totalSipsReceived: Record<string, number>
  recitation: Record<string, RecitationEntry>
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildDeck(count: number): Card[] {
  const base: Omit<Card, 'id'>[] = []
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) base.push({ rank, suit })
  }
  const deck: Card[] = []
  let cycle = 0
  while (deck.length < count) {
    for (const card of base) {
      deck.push({ ...card, id: `c-${card.rank}-${card.suit}-${cycle}` })
      if (deck.length >= count) break
    }
    cycle++
  }
  return shuffle(deck)
}

function totalPyramidCount(): number {
  return ROWS.reduce((sum, r) => sum + r.count, 0)
}

function buildPyramid(cards: Card[]): PyramidCardState[] {
  const out: PyramidCardState[] = []
  let rowIndex = 0
  for (const row of ROWS) {
    for (let i = 0; i < row.count; i++) {
      const card = cards[out.length]
      out.push({ ...card, row: rowIndex, sips: row.sips, revealed: false })
    }
    rowIndex++
  }
  return out
}

function getState(session: PartySession): PyramidState {
  return (
    (session.roundData as PyramidState | null) ?? {
      hands: {},
      handsHidden: false,
      pyramid: [],
      currentIndex: -1,
      accusations: [],
      totalSipsReceived: {},
      recitation: {},
    }
  )
}

function addSips(totals: Record<string, number>, memberId: string, amount: number): Record<string, number> {
  return { ...totals, [memberId]: (totals[memberId] ?? 0) + amount }
}

export const pyramid: GameModule = {
  id: 'pyramid',
  name: 'Pyramide',
  icon: '🍻',
  minPlayers: 2,

  initRound(group, session) {
    const state = getState(session)

    // 1) Very first call: deal hands, build the pyramid, show the rules first.
    if (session.round === 0 && session.phase === null) {
      const needed = group.members.length * HAND_SIZE + totalPyramidCount()
      const deck = buildDeck(needed)
      const hands: Record<string, Card[]> = {}
      for (const m of group.members) hands[m.id] = deck.splice(0, HAND_SIZE)
      const pyramidCards = buildPyramid(deck.splice(0, totalPyramidCount()))
      const newState: PyramidState = {
        hands,
        handsHidden: false,
        pyramid: pyramidCards,
        currentIndex: -1,
        accusations: [],
        totalSipsReceived: {},
        recitation: {},
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    // 2) Host dismisses the rules screen -> everyone gets a timed window to memorize their hand
    // before the cards are dealt "face down". Nothing about the pyramid is revealed yet.
    if (session.phase === 'intro') {
      return { session: { ...session, phase: 'memorize', roundData: state } }
    }

    // 3) Memorize window is over (host advances, timer or manual "C'est parti !") -> reveal card 1.
    // From here on the hands go face-down for good: play from memory only.
    if (session.phase === 'memorize') {
      const nextPyramid = state.pyramid.map((c, i) => (i === 0 ? { ...c, revealed: true } : c))
      return {
        session: {
          ...session,
          phase: 'matching',
          round: 1,
          roundData: { ...state, handsHidden: true, pyramid: nextPyramid, currentIndex: 0 },
        },
      }
    }

    // 4) Host wraps up the recitation -> final results.
    if (session.phase === 'recitation') {
      const entries = group.members.map((m) => ({ id: m.id, sips: state.totalSipsReceived[m.id] ?? 0 }))
      const minSips = entries.length > 0 ? Math.min(...entries.map((e) => e.sips)) : 0
      const xpAwards: XpAward[] = entries
        .filter((e) => e.sips === minSips)
        .map((e) => ({
          memberId: e.id,
          amount: 15,
          statIncrements: { 'pyramid.gamesWon': 1 },
          reason: 'A le mieux survécu à la Pyramide',
        }))
      return { session: { ...session, status: 'ended', phase: 'ended' }, xpAwards }
    }

    // 5) Normal card-to-card advance. The hands STAY hidden through the recitation — the minigame
    // is to recite each card's value and suit blind, in order; a player's real cards only get
    // revealed (inside their recitation entry) once they've submitted, like flipping your cards.
    const nextIndex = state.currentIndex + 1
    if (nextIndex >= state.pyramid.length) {
      return { session: { ...session, phase: 'recitation', roundData: state } }
    }
    const nextPyramid = state.pyramid.map((c, i) => (i === nextIndex ? { ...c, revealed: true } : c))
    return {
      session: {
        ...session,
        phase: 'matching',
        round: session.round + 1,
        roundData: { ...state, pyramid: nextPyramid, currentIndex: nextIndex },
      },
    }
  },

  handleAction(group, session, memberId, action: GameAction) {
    const state = getState(session)

    if (action.type === 'accuse' && session.phase === 'matching') {
      const payload = action.payload as { targetMemberId?: string } | null
      const targetMemberId = payload?.targetMemberId
      if (!targetMemberId || targetMemberId === memberId || !group.members.some((m) => m.id === targetMemberId)) {
        return { session }
      }
      const accusation: Accusation = {
        id: `acc-${state.accusations.length}-${Math.random().toString(36).slice(2, 7)}`,
        cardIndex: state.currentIndex,
        accuserId: memberId,
        targetId: targetMemberId,
        status: 'pending',
      }
      return { session: { ...session, roundData: { ...state, accusations: [...state.accusations, accusation] } } }
    }

    if (action.type === 'respond' && session.phase === 'matching') {
      const payload = action.payload as { accusationId?: string; contest?: boolean } | null
      const accusation = state.accusations.find((a) => a.id === payload?.accusationId)
      if (!accusation || accusation.targetId !== memberId || accusation.status !== 'pending') return { session }
      const card = state.pyramid[accusation.cardIndex]
      if (!card) return { session }

      let status: AccusationStatus
      let totals = state.totalSipsReceived

      if (!payload?.contest) {
        // Accepted at face value: the target trusts the distributor really has the card, no proof needed.
        status = 'accepted'
        totals = addSips(totals, memberId, card.sips === 'culsec' ? CULSEC_WEIGHT : card.sips)
      } else {
        // "Tu bluffes !" — the distributor now has ONE attempt to point at the exact card in their
        // hand that matches. Nothing resolves yet: see the `proveCard` action below.
        status = 'awaiting-proof'
      }

      const nextAccusations = state.accusations.map((a) => (a.id === accusation.id ? { ...a, status } : a))
      return { session: { ...session, roundData: { ...state, accusations: nextAccusations, totalSipsReceived: totals } } }
    }

    if (action.type === 'proveCard' && session.phase === 'matching') {
      const payload = action.payload as { accusationId?: string; cardSlotIndex?: number } | null
      const accusation = state.accusations.find((a) => a.id === payload?.accusationId)
      if (!accusation || accusation.accuserId !== memberId || accusation.status !== 'awaiting-proof') return { session }
      const card = state.pyramid[accusation.cardIndex]
      if (!card) return { session }
      const slot = payload?.cardSlotIndex
      if (slot === undefined || slot === null) return { session }
      const sipValue = card.sips === 'culsec' ? CULSEC_WEIGHT : card.sips

      // Single attempt: whichever one card they point to is the whole answer, correct or not —
      // no re-tries, and no credit for "having a match somewhere else" in hand.
      const shown = state.hands[memberId]?.[slot]
      const correct = shown?.rank === card.rank

      let status: AccusationStatus
      let totals = state.totalSipsReceived
      const xpAwards: XpAward[] = []

      if (correct) {
        status = 'contested-wrong'
        totals = addSips(totals, accusation.targetId, sipValue * 2)
        xpAwards.push({ memberId: accusation.accuserId, amount: CONTEST_XP, reason: 'A prouvé sa carte' })
      } else {
        status = 'contested-right'
        totals = addSips(totals, accusation.accuserId, sipValue * 2)
        xpAwards.push({ memberId: accusation.targetId, amount: CONTEST_XP, reason: 'A démasqué un bluff' })
      }

      const nextAccusations = state.accusations.map((a) => (a.id === accusation.id ? { ...a, status } : a))
      return {
        session: { ...session, roundData: { ...state, accusations: nextAccusations, totalSipsReceived: totals } },
        xpAwards,
      }
    }

    // Recite each of your (still hidden) cards, in order: value + suit per slot. Every correct
    // value earns 1 sip to distribute, every correct suit too — up to hand size × 2.
    if (action.type === 'submitRecitation' && session.phase === 'recitation') {
      if (state.recitation[memberId]) return { session }
      const payload = action.payload as { guesses?: { rank?: number; suit?: number }[] } | null
      const rawGuesses = payload?.guesses
      const hand = state.hands[memberId] ?? []
      if (!Array.isArray(rawGuesses) || rawGuesses.length !== hand.length) return { session }
      if (
        !rawGuesses.every(
          (g) =>
            typeof g?.rank === 'number' && g.rank >= 1 && g.rank <= 13 && typeof g?.suit === 'number' && g.suit >= 0 && g.suit <= 3,
        )
      ) {
        return { session }
      }
      const guesses = rawGuesses as RecitationGuess[]

      const perCard: RecitationCardResult[] = hand.map((truth, i) => ({
        rankCorrect: guesses[i].rank === truth.rank,
        suitCorrect: guesses[i].suit === truth.suit,
      }))
      const score = perCard.reduce((sum, c) => sum + (c.rankCorrect ? 1 : 0) + (c.suitCorrect ? 1 : 0), 0)

      const entry: RecitationEntry = {
        guesses,
        actualHand: hand,
        perCard,
        score,
        bonusSips: score,
        remaining: score,
        given: {},
      }
      return { session: { ...session, roundData: { ...state, recitation: { ...state.recitation, [memberId]: entry } } } }
    }

    // Hand out bonus sips ONE at a time so they can be split across several players.
    if (action.type === 'distributeRecitationBonus' && session.phase === 'recitation') {
      const entry = state.recitation[memberId]
      const payload = action.payload as { targetMemberId?: string } | null
      const targetMemberId = payload?.targetMemberId
      if (!entry || entry.remaining <= 0 || !targetMemberId || targetMemberId === memberId) return { session }
      if (!group.members.some((m) => m.id === targetMemberId)) return { session }

      const nextEntry: RecitationEntry = {
        ...entry,
        remaining: entry.remaining - 1,
        given: { ...entry.given, [targetMemberId]: (entry.given[targetMemberId] ?? 0) + 1 },
      }
      const totals = addSips(state.totalSipsReceived, targetMemberId, 1)
      return {
        session: {
          ...session,
          roundData: { ...state, recitation: { ...state.recitation, [memberId]: nextEntry }, totalSipsReceived: totals },
        },
      }
    }

    return { session }
  },

  // The whole game is host-paced by design (bluffing is a live social call, not something the
  // server can validate as "everyone responded") — never auto-resolve, never auto-block.
  isRoundComplete() {
    return false
  },
  isAwaitingInput() {
    return false
  },
  resolveRound(_group, session) {
    return { session }
  },
}
