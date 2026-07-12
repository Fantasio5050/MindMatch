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

type AccusationStatus = 'pending' | 'accepted' | 'contested-wrong' | 'contested-right'

interface Accusation {
  id: string
  cardIndex: number
  accuserId: string
  targetId: string
  status: AccusationStatus
}

interface RecitationEntry {
  score: number
  bonusSips: number
  distributed: boolean
  targetId: string | null
}

interface PyramidState {
  hands: Record<string, Card[]>
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
        pyramid: pyramidCards,
        currentIndex: -1,
        accusations: [],
        totalSipsReceived: {},
        recitation: {},
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    // 2) Host dismisses the rules screen -> reveal the first card.
    if (session.phase === 'intro') {
      const nextPyramid = state.pyramid.map((c, i) => (i === 0 ? { ...c, revealed: true } : c))
      return {
        session: { ...session, phase: 'matching', round: 1, roundData: { ...state, pyramid: nextPyramid, currentIndex: 0 } },
      }
    }

    // 3) Host wraps up the recitation -> final results.
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

    // 4) Normal card-to-card advance.
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
      const sipValue = card.sips === 'culsec' ? CULSEC_WEIGHT : card.sips

      let status: AccusationStatus
      let totals = state.totalSipsReceived
      const xpAwards: XpAward[] = []

      if (!payload?.contest) {
        status = 'accepted'
        totals = addSips(totals, memberId, sipValue)
      } else {
        const accuserHasCard = state.hands[accusation.accuserId]?.some((c) => c.rank === card.rank) ?? false
        if (accuserHasCard) {
          status = 'contested-wrong'
          totals = addSips(totals, memberId, sipValue * 2)
          xpAwards.push({ memberId: accusation.accuserId, amount: CONTEST_XP, reason: 'Accusation confirmée' })
        } else {
          status = 'contested-right'
          totals = addSips(totals, accusation.accuserId, sipValue * 2)
          xpAwards.push({ memberId, amount: CONTEST_XP, reason: 'A démasqué un bluff' })
        }
      }

      const nextAccusations = state.accusations.map((a) => (a.id === accusation.id ? { ...a, status } : a))
      return {
        session: { ...session, roundData: { ...state, accusations: nextAccusations, totalSipsReceived: totals } },
        xpAwards,
      }
    }

    if (action.type === 'submitRecitation' && session.phase === 'recitation') {
      if (state.recitation[memberId]) return { session }
      const payload = action.payload as { order?: string[] } | null
      const order = payload?.order
      const hand = state.hands[memberId] ?? []
      if (!order || order.length !== hand.length) return { session }
      const validIds = new Set(hand.map((c) => c.id))
      if (new Set(order).size !== order.length || !order.every((id) => validIds.has(id))) return { session }

      let score = 0
      for (let i = 0; i < hand.length; i++) {
        const guessed = hand.find((c) => c.id === order[i])
        const truth = hand[i]
        if (!guessed) continue
        if (guessed.rank === truth.rank) score++
        if (guessed.suit === truth.suit) score++
      }

      const nextRecitation = { ...state.recitation, [memberId]: { score, bonusSips: score, distributed: false, targetId: null } }
      return { session: { ...session, roundData: { ...state, recitation: nextRecitation } } }
    }

    if (action.type === 'distributeRecitationBonus' && session.phase === 'recitation') {
      const entry = state.recitation[memberId]
      const payload = action.payload as { targetMemberId?: string } | null
      const targetMemberId = payload?.targetMemberId
      if (!entry || entry.distributed || !targetMemberId || targetMemberId === memberId) return { session }
      if (!group.members.some((m) => m.id === targetMemberId)) return { session }

      const nextRecitation = { ...state.recitation, [memberId]: { ...entry, distributed: true, targetId: targetMemberId } }
      const totals = entry.bonusSips > 0 ? addSips(state.totalSipsReceived, targetMemberId, entry.bonusSips) : state.totalSipsReceived
      return { session: { ...session, roundData: { ...state, recitation: nextRecitation, totalSipsReceived: totals } } }
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
