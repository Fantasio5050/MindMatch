import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

const ROAD_LENGTH = 5
const TOTAL_ROUNDS = 10
const LAP_XP = 6
const SURVIVOR_XP = 15

type Direction = 'higher' | 'lower'

interface Card {
  id: string
  rank: number
  suit: number
}

interface RoundResultEntry {
  prediction: Direction
  correct: boolean
  sipsOwed: number
  newProgress: number
  lapCompleted: boolean
}

interface RoundHistoryEntry {
  referenceCard: Card
  drawnCard: Card
  tie: boolean
  results: Record<string, RoundResultEntry>
}

interface AutorouteState {
  // The remaining shuffled deck is only known server-side (nested under `secrets` so the generic
  // sanitizer strips it for every client) — otherwise players could see the next card and know in
  // advance whether "higher" or "lower" is correct.
  secrets: { deck: Card[] }
  referenceCard: Card | null
  votes: Record<string, Direction>
  progress: Record<string, number>
  laps: Record<string, number>
  totalSipsReceived: Record<string, number>
  totalRounds: number
  history: RoundHistoryEntry[]
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildDeck(): Card[] {
  const deck: Card[] = []
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ id: `a-${rank}-${suit}-${Math.random().toString(36).slice(2, 6)}`, rank, suit })
  }
  return shuffle(deck)
}

function drawCard(deckIn: Card[]): { card: Card; deck: Card[] } {
  const deck = deckIn.length > 0 ? deckIn : buildDeck()
  const [card, ...rest] = deck
  return { card, deck: rest }
}

function getState(session: PartySession): AutorouteState {
  return (
    (session.roundData as AutorouteState | null) ?? {
      secrets: { deck: [] },
      referenceCard: null,
      votes: {},
      progress: {},
      laps: {},
      totalSipsReceived: {},
      totalRounds: TOTAL_ROUNDS,
      history: [],
    }
  )
}

function addSips(totals: Record<string, number>, memberId: string, amount: number): Record<string, number> {
  return { ...totals, [memberId]: (totals[memberId] ?? 0) + amount }
}

export const autoroute: GameModule = {
  id: 'autoroute',
  name: 'Autoroute',
  icon: '🛣️',
  minPlayers: 2,

  initRound(group, session) {
    const state = getState(session)
    const isFirstRound = session.round === 0

    if (isFirstRound) {
      const { card: referenceCard, deck: rest } = drawCard(buildDeck())
      const nextState: AutorouteState = { ...state, secrets: { deck: rest }, referenceCard, votes: {} }
      return { session: { ...session, status: 'playing', phase: 'predicting', round: 1, roundData: nextState } }
    }

    const round = session.round + 1
    if (round > state.totalRounds) {
      const entries = group.members.map((m) => ({ id: m.id, sips: state.totalSipsReceived[m.id] ?? 0 }))
      const minSips = entries.length > 0 ? Math.min(...entries.map((e) => e.sips)) : 0
      const xpAwards: XpAward[] = entries
        .filter((e) => e.sips === minSips)
        .map((e) => ({
          memberId: e.id,
          amount: SURVIVOR_XP,
          statIncrements: { 'autoroute.gamesWon': 1 },
          reason: "A le mieux survécu à l'Autoroute",
        }))
      return { session: { ...session, status: 'ended', phase: 'ended' }, xpAwards }
    }

    const nextState: AutorouteState = { ...state, votes: {} }
    return { session: { ...session, phase: 'predicting', round, roundData: nextState } }
  },

  handleAction(group, session, memberId, action: GameAction) {
    if (session.phase !== 'predicting' || action.type !== 'predict') return { session }
    const payload = action.payload as { direction?: Direction } | null
    if (payload?.direction !== 'higher' && payload?.direction !== 'lower') return { session }

    const state = getState(session)
    if (state.votes[memberId]) return { session }
    if (!group.members.some((m) => m.id === memberId)) return { session }

    const nextState: AutorouteState = { ...state, votes: { ...state.votes, [memberId]: payload.direction } }
    return { session: { ...session, roundData: nextState } }
  },

  isRoundComplete(group, session) {
    if (session.phase !== 'predicting') return false
    const state = getState(session)
    return Object.keys(state.votes).length >= group.members.length
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'predicting'
  },

  resolveRound(_group, session) {
    const state = getState(session)
    const reference = state.referenceCard as Card
    const { card: drawnCard, deck } = drawCard(state.secrets.deck)
    const tie = drawnCard.rank === reference.rank

    let progress = state.progress
    let laps = state.laps
    let totals = state.totalSipsReceived
    const xpAwards: XpAward[] = []
    const results: Record<string, RoundResultEntry> = {}

    for (const [memberId, prediction] of Object.entries(state.votes)) {
      if (tie) continue
      const actual: Direction = drawnCard.rank > reference.rank ? 'higher' : 'lower'
      const correct = prediction === actual
      const currentProgress = progress[memberId] ?? 0

      if (correct) {
        const newProgress = currentProgress + 1
        const lapCompleted = newProgress >= ROAD_LENGTH
        progress = { ...progress, [memberId]: lapCompleted ? 0 : newProgress }
        if (lapCompleted) {
          laps = { ...laps, [memberId]: (laps[memberId] ?? 0) + 1 }
          xpAwards.push({ memberId, amount: LAP_XP, statIncrements: { 'autoroute.laps': 1 }, reason: "A terminé l'Autoroute" })
        }
        results[memberId] = { prediction, correct: true, sipsOwed: 0, newProgress: lapCompleted ? 0 : newProgress, lapCompleted }
      } else {
        const sipsOwed = Math.max(1, currentProgress)
        totals = addSips(totals, memberId, sipsOwed)
        progress = { ...progress, [memberId]: 0 }
        results[memberId] = { prediction, correct: false, sipsOwed, newProgress: 0, lapCompleted: false }
      }
    }

    const nextState: AutorouteState = {
      ...state,
      secrets: { deck },
      referenceCard: tie ? state.referenceCard : drawnCard,
      progress,
      laps,
      totalSipsReceived: totals,
      history: [...state.history, { referenceCard: reference, drawnCard, tie, results }],
    }

    return { session: { ...session, phase: 'reveal', roundData: nextState }, xpAwards }
  },
}
