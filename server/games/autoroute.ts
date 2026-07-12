import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

const DEFAULT_CYCLES = 3
const MIN_CYCLES = 2
const MAX_CYCLES = 6
// Safety net: with the one-step-back penalty a very unlucky player could in theory yo-yo forever,
// so the game force-ends after this many rounds and ranks players by distance travelled.
const MAX_ROUNDS = 60
const FINISH_XP = 6
const SURVIVOR_XP = 15

export type QuestionKind = 'higher-lower' | 'red-black' | 'inter-exter'
type Choice = 'higher' | 'lower' | 'red' | 'black' | 'inter' | 'exter'

const CHOICES_BY_KIND: Record<QuestionKind, [Choice, Choice]> = {
  'higher-lower': ['higher', 'lower'],
  'red-black': ['red', 'black'],
  'inter-exter': ['inter', 'exter'],
}

interface Card {
  id: string
  rank: number
  suit: number
}

type TrackCell = { type: 'question'; kind: QuestionKind } | { type: 'toll' }

interface PlayerRoundResult {
  choice: Choice
  kind: QuestionKind
  drawnCard: Card
  correct: boolean
  /** Sips from the wrong guess itself (0 or 1). */
  faultSips: number
  /** Sips paid crossing péages this round. */
  tollSips: number
  newPosition: number
  finished: boolean
}

interface RoundHistoryEntry {
  results: Record<string, PlayerRoundResult>
}

interface AutorouteState {
  // The shuffled deck stays server-only (`secrets` is stripped for every client by the generic
  // sanitizer) — otherwise players could peek at their next card before guessing.
  secrets: { deck: Card[] }
  track: TrackCell[]
  positions: Record<string, number>
  finished: Record<string, boolean>
  finishOrder: string[]
  /** Last two cards drawn per player (newest last) — references for plus/moins and inter/exter. */
  recentCards: Record<string, Card[]>
  votes: Record<string, Choice>
  totalSipsReceived: Record<string, number>
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

/** 0 0 0 Péage 0 0 0 Péage 0 0 0 — each cycle is one full question loop (plus/moins → rouge/noir
 * → inter/exter), with a péage between cycles but none after the last one. */
export function buildTrack(cycles: number): TrackCell[] {
  const kinds: QuestionKind[] = ['higher-lower', 'red-black', 'inter-exter']
  const track: TrackCell[] = []
  for (let c = 0; c < cycles; c++) {
    if (c > 0) track.push({ type: 'toll' })
    for (const kind of kinds) track.push({ type: 'question', kind })
  }
  return track
}

function isRed(suit: number): boolean {
  return suit === 1 || suit === 2
}

function evaluate(kind: QuestionKind, choice: Choice, drawn: Card, recent: Card[]): boolean {
  if (kind === 'higher-lower') {
    const reference = recent[recent.length - 1]
    if (!reference || drawn.rank === reference.rank) return false // égalité = perdu
    return choice === 'higher' ? drawn.rank > reference.rank : drawn.rank < reference.rank
  }
  if (kind === 'red-black') {
    return choice === 'red' ? isRed(drawn.suit) : !isRed(drawn.suit)
  }
  // inter-exter: strictly between the player's two last cards, boundary ranks lose either way.
  const [a, b] = recent.slice(-2)
  if (!a || !b) return false
  const low = Math.min(a.rank, b.rank)
  const high = Math.max(a.rank, b.rank)
  if (drawn.rank === low || drawn.rank === high) return false // poteau = perdu
  const isInter = drawn.rank > low && drawn.rank < high
  return choice === 'inter' ? isInter : !isInter
}

function getState(session: PartySession): AutorouteState {
  return (
    (session.roundData as AutorouteState | null) ?? {
      secrets: { deck: [] },
      track: buildTrack(DEFAULT_CYCLES),
      positions: {},
      finished: {},
      finishOrder: [],
      recentCards: {},
      votes: {},
      totalSipsReceived: {},
      history: [],
    }
  )
}

function addSips(totals: Record<string, number>, memberId: string, amount: number): Record<string, number> {
  if (amount <= 0) return totals
  return { ...totals, [memberId]: (totals[memberId] ?? 0) + amount }
}

function activePlayers(session: PartySession, state: AutorouteState): string[] {
  return session.participantIds.filter((id) => !state.finished[id])
}

function endResults(session: PartySession, state: AutorouteState): { session: PartySession; xpAwards: XpAward[] } {
  const entries = session.participantIds.map((id) => ({ id, sips: state.totalSipsReceived[id] ?? 0 }))
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

export const autoroute: GameModule = {
  id: 'autoroute',
  name: 'Autoroute',
  icon: '🛣️',
  minPlayers: 2,

  initRound(_group, session, config) {
    const state = getState(session)

    // 1) Very first call: build the track from the host's chosen length, show the rules.
    if (session.round === 0 && session.phase === null) {
      const cyclesRaw = (config as { cycles?: number } | undefined)?.cycles
      const cycles = Math.max(MIN_CYCLES, Math.min(MAX_CYCLES, Math.round(Number(cyclesRaw)) || DEFAULT_CYCLES))
      const { card: startCard, deck } = drawCard(buildDeck())

      const recentCards: Record<string, Card[]> = {}
      const positions: Record<string, number> = {}
      for (const id of session.participantIds) {
        recentCards[id] = [startCard]
        positions[id] = 0
      }

      const newState: AutorouteState = {
        secrets: { deck },
        track: buildTrack(cycles),
        positions,
        finished: {},
        finishOrder: [],
        recentCards,
        votes: {},
        totalSipsReceived: {},
        history: [],
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    // 2) Host dismisses the rules -> first betting round.
    if (session.phase === 'intro') {
      return { session: { ...session, phase: 'predicting', round: 1, roundData: state } }
    }

    // 3) Reveal -> next round (or the end once everyone has crossed the finish line).
    if (activePlayers(session, state).length === 0 || session.round >= MAX_ROUNDS) {
      return endResults(session, state)
    }
    const nextState: AutorouteState = { ...state, votes: {} }
    return { session: { ...session, phase: 'predicting', round: session.round + 1, roundData: nextState } }
  },

  handleAction(_group, session, memberId, action: GameAction) {
    if (session.phase !== 'predicting' || action.type !== 'predict') return { session }
    const state = getState(session)
    if (state.votes[memberId] || state.finished[memberId]) return { session }
    if (!session.participantIds.includes(memberId)) return { session }

    const cell = state.track[state.positions[memberId] ?? 0]
    if (!cell || cell.type !== 'question') return { session }
    const payload = action.payload as { choice?: Choice } | null
    const choice = payload?.choice
    if (!choice || !CHOICES_BY_KIND[cell.kind].includes(choice)) return { session }

    const nextState: AutorouteState = { ...state, votes: { ...state.votes, [memberId]: choice } }
    return { session: { ...session, roundData: nextState } }
  },

  isRoundComplete(_group, session) {
    if (session.phase !== 'predicting') return false
    const state = getState(session)
    const active = activePlayers(session, state)
    return active.length > 0 && active.every((id) => !!state.votes[id])
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'predicting'
  },

  resolveRound(_group, session) {
    const state = getState(session)
    let deck = state.secrets.deck
    let positions = state.positions
    let finished = state.finished
    let finishOrder = state.finishOrder
    let recentCards = state.recentCards
    let totals = state.totalSipsReceived
    const results: Record<string, PlayerRoundResult> = {}
    const xpAwards: XpAward[] = []

    for (const [memberId, choice] of Object.entries(state.votes)) {
      const position = positions[memberId] ?? 0
      const cell = state.track[position]
      if (!cell || cell.type !== 'question' || finished[memberId]) continue

      const drawResult = drawCard(deck)
      deck = drawResult.deck
      const drawn = drawResult.card
      const recent = recentCards[memberId] ?? []
      const correct = evaluate(cell.kind, choice, drawn, recent)

      let faultSips = 0
      let tollSips = 0
      let newPosition = position
      let hasFinished = false

      if (correct) {
        newPosition = position + 1
        // Les péages se franchissent obligatoirement : 1 gorgée chacun, on ne s'y arrête pas.
        while (newPosition < state.track.length && state.track[newPosition].type === 'toll') {
          tollSips += 1
          newPosition += 1
        }
        if (newPosition >= state.track.length) {
          hasFinished = true
          finished = { ...finished, [memberId]: true }
          finishOrder = [...finishOrder, memberId]
          xpAwards.push({
            memberId,
            amount: FINISH_XP,
            statIncrements: { 'autoroute.laps': 1 },
            reason: "A terminé l'Autoroute",
          })
        }
      } else {
        faultSips = 1
        newPosition = position - 1
        // On ne recule jamais SUR un péage (et on ne le repaie pas en marche arrière).
        while (newPosition > 0 && state.track[newPosition].type === 'toll') newPosition -= 1
        newPosition = Math.max(0, newPosition)
      }

      totals = addSips(totals, memberId, faultSips + tollSips)
      positions = { ...positions, [memberId]: hasFinished ? state.track.length : newPosition }
      recentCards = { ...recentCards, [memberId]: [...recent, drawn].slice(-2) }
      results[memberId] = {
        choice,
        kind: cell.kind,
        drawnCard: drawn,
        correct,
        faultSips,
        tollSips,
        newPosition: hasFinished ? state.track.length : newPosition,
        finished: hasFinished,
      }
    }

    const nextState: AutorouteState = {
      ...state,
      secrets: { deck },
      positions,
      finished,
      finishOrder,
      recentCards,
      totalSipsReceived: totals,
      history: [...state.history, { results }],
    }

    return { session: { ...session, phase: 'reveal', roundData: nextState }, xpAwards }
  },
}
