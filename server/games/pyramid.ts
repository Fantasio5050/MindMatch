import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

const HAND_SIZE = 4
const CULSEC_WEIGHT = 10

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
}

interface PyramidCardState extends Card {
  row: number
  sips: number | 'culsec'
  revealed: boolean
  plays: { memberId: string; targetMemberId: string; matchCount: number }[]
}

interface PyramidState {
  hands: Record<string, Card[]>
  pyramid: PyramidCardState[]
  currentIndex: number
  totalSipsReceived: Record<string, number>
  submissions: Record<string, 'played' | 'passed'>
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
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  const deck: Card[] = []
  let i = 0
  while (deck.length < count) {
    deck.push({ id: `card-${deck.length}-${Math.random().toString(36).slice(2, 7)}`, rank: ranks[i % ranks.length] })
    i++
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
      out.push({ id: card.id, rank: card.rank, row: rowIndex, sips: row.sips, revealed: false, plays: [] })
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
      totalSipsReceived: {},
      submissions: {},
    }
  )
}

export const pyramid: GameModule = {
  id: 'pyramid',
  name: 'Pyramide',
  icon: '🍻',
  minPlayers: 2,

  initRound(group, session) {
    const isFirstRound = session.round === 0

    if (isFirstRound) {
      const needed = group.members.length * HAND_SIZE + totalPyramidCount()
      const deck = buildDeck(needed)
      const hands: Record<string, Card[]> = {}
      for (const m of group.members) hands[m.id] = deck.splice(0, HAND_SIZE)
      const pyramidCards = buildPyramid(deck.splice(0, totalPyramidCount()))
      pyramidCards[0].revealed = true

      const state: PyramidState = { hands, pyramid: pyramidCards, currentIndex: 0, totalSipsReceived: {}, submissions: {} }
      return { session: { ...session, status: 'playing', phase: 'matching', round: 1, roundData: state } }
    }

    const state = getState(session)
    const nextIndex = state.currentIndex + 1

    if (nextIndex >= state.pyramid.length) {
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

    const nextPyramid = state.pyramid.map((c, i) => (i === nextIndex ? { ...c, revealed: true } : c))
    const nextState: PyramidState = { ...state, pyramid: nextPyramid, currentIndex: nextIndex, submissions: {} }
    return { session: { ...session, phase: 'matching', round: session.round + 1, roundData: nextState } }
  },

  handleAction(group, session, memberId, action: GameAction) {
    if (session.phase !== 'matching' || action.type !== 'pyramidPlay') return { session }
    const state = getState(session)
    if (state.submissions[memberId]) return { session }

    const currentCard = state.pyramid[state.currentIndex]
    if (!currentCard) return { session }
    const hand = state.hands[memberId] ?? []
    const matches = hand.filter((c) => c.rank === currentCard.rank)

    const payload = action.payload as { play?: boolean; targetMemberId?: string } | null

    if (!payload?.play || matches.length === 0) {
      const nextState: PyramidState = { ...state, submissions: { ...state.submissions, [memberId]: 'passed' } }
      return { session: { ...session, roundData: nextState } }
    }

    const targetMemberId = payload.targetMemberId
    if (!targetMemberId || !group.members.some((m) => m.id === targetMemberId)) return { session }

    const matchIds = new Set(matches.map((c) => c.id))
    const remainingHand = hand.filter((c) => !matchIds.has(c.id))
    const addedWeight = currentCard.sips === 'culsec' ? CULSEC_WEIGHT : currentCard.sips * matches.length

    const updatedPyramid = state.pyramid.map((c, i) =>
      i === state.currentIndex
        ? { ...c, plays: [...c.plays, { memberId, targetMemberId, matchCount: matches.length }] }
        : c,
    )
    const nextState: PyramidState = {
      ...state,
      hands: { ...state.hands, [memberId]: remainingHand },
      pyramid: updatedPyramid,
      totalSipsReceived: {
        ...state.totalSipsReceived,
        [targetMemberId]: (state.totalSipsReceived[targetMemberId] ?? 0) + addedWeight,
      },
      submissions: { ...state.submissions, [memberId]: 'played' },
    }
    return { session: { ...session, roundData: nextState } }
  },

  isRoundComplete(group, session) {
    if (session.phase !== 'matching') return false
    const state = getState(session)
    const currentCard = state.pyramid[state.currentIndex]
    if (!currentCard) return true
    for (const m of group.members) {
      const hand = state.hands[m.id] ?? []
      const hasMatch = hand.some((c) => c.rank === currentCard.rank)
      if (hasMatch && !state.submissions[m.id]) return false
    }
    return true
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'matching'
  },

  resolveRound(_group, session) {
    return { session: { ...session, phase: 'revealed' } }
  },
}
