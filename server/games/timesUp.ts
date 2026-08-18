import type { PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import {
  timesUpCardsForCategory,
  CARDS_PER_PLAYER,
  TURN_TIME_SEC,
  type TimesUpCard,
  type TimesUpCategory,
} from '../../src/data/timesUp'

type CategoryChoice = TimesUpCategory | 'mixed'

interface TimesUpState {
  category: CategoryChoice
  deck: TimesUpCard[]          // remaining cards to describe
  foundCards: TimesUpCard[]     // cards found this round
  missedCards: TimesUpCard[]    // cards not found (carried to next round)
  allRoundCards: TimesUpCard[]  // all cards for this round
  round: 1 | 2 | 3
  phase: 'intro' | 'round1' | 'round2' | 'round3' | 'ended'
  currentDescriber: string | null
  currentCard: TimesUpCard | null
  turnOrder: string[]
  turnIndex: number
  scores: Record<string, number>
  timeLeft: number
  turnStartTime: number
  passedCards: TimesUpCard[]
  lastFound: string | null
  roundResults: { round: 1 | 2 | 3; found: TimesUpCard[]; missed: TimesUpCard[] }[]
}

function getState(session: PartySession): TimesUpState {
  return session.roundData as TimesUpState
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildDeck(category: CategoryChoice, playerCount: number): TimesUpCard[] {
  const pool = timesUpCardsForCategory(category)
  const count = Math.min(pool.length, CARDS_PER_PLAYER * playerCount)
  return shuffle(pool).slice(0, count)
}

function nextTurn(state: TimesUpState): TimesUpState {
  const nextIndex = (state.turnIndex + 1) % state.turnOrder.length
  const nextDescriber = state.turnOrder[nextIndex]
  const remaining = state.deck.filter(c => !state.foundCards.includes(c) && !state.passedCards.includes(c))

  if (remaining.length === 0) {
    // Round is over
    return endRound(state)
  }

  return {
    ...state,
    turnIndex: nextIndex,
    currentDescriber: nextDescriber,
    currentCard: remaining[0],
    timeLeft: TURN_TIME_SEC,
    turnStartTime: Date.now(),
    passedCards: [],
    lastFound: null,
  }
}

function endRound(state: TimesUpState): TimesUpState {
  const missed = state.deck.filter(c => !state.foundCards.includes(c))
  const roundResult = {
    round: state.round,
    found: [...state.foundCards],
    missed: [...missed],
  }

  if (state.round >= 3) {
    return {
      ...state,
      phase: 'ended',
      currentCard: null,
      currentDescriber: null,
      roundResults: [...state.roundResults, roundResult],
    }
  }

  const nextRound = (state.round + 1) as 1 | 2 | 3
  const newDeck = shuffle([...state.foundCards, ...missed])

  return {
    ...state,
    round: nextRound,
    phase: nextRound === 2 ? 'round2' : 'round3',
    deck: newDeck,
    allRoundCards: newDeck,
    foundCards: [],
    missedCards: [],
    currentCard: null,
    currentDescriber: null,
    turnIndex: -1,
    passedCards: [],
    roundResults: [...state.roundResults, roundResult],
  }
}

export const timesUp: GameModule = {
  id: 'times-up',
  name: "Time's Up",
  icon: '⏰',
  minPlayers: 4,

  initRound(group, session, config) {
    const isFirstRound = session.round === 0
    const state = getState(session)

    if (!isFirstRound) {
      // Start next turn
      if (state.phase === 'ended') {
        return { session: { ...session, status: 'ended', phase: 'ended' } }
      }
      const nextTurnState = nextTurn(state)
      return { session: { ...session, status: 'playing', phase: nextTurnState.phase, roundData: nextTurnState } }
    }

    const category: CategoryChoice = ((config as { category?: CategoryChoice } | undefined)?.category ?? 'mixed')
    const deck = buildDeck(category, group.members.length)
    const turnOrder = shuffle(group.members.map(m => m.id))

    const newState: TimesUpState = {
      category,
      deck,
      foundCards: [],
      missedCards: [],
      allRoundCards: deck,
      round: 1,
      phase: 'round1',
      currentDescriber: null,
      currentCard: null,
      turnOrder,
      turnIndex: -1,
      scores: {},
      timeLeft: TURN_TIME_SEC,
      turnStartTime: 0,
      passedCards: [],
      lastFound: null,
      roundResults: [],
    }

    return {
      session: { ...session, status: 'playing', phase: 'round1', round: 1, roundData: newState },
    }
  },

  handleAction(_group, session, memberId, action) {
    const state = getState(session)
    const act = action as { type: string; payload: unknown }

    // Start first turn (host)
    if (act.type === 'start-turn') {
      if (state.currentDescriber !== null) return { session }
      const nextTurnState = nextTurn(state)
      return { session: { ...session, roundData: nextTurnState } }
    }

    // Player found the card
    if (act.type === 'card-found') {
      if (memberId !== state.currentDescriber || !state.currentCard) return { session }
      const scores = { ...state.scores, [memberId]: (state.scores[memberId] ?? 0) + 1 }
      const foundCards = [...state.foundCards, state.currentCard]
      const remaining = state.deck.filter(c => !foundCards.includes(c) && !state.passedCards.includes(c))

      if (remaining.length === 0) {
        const endedState = endRound({ ...state, foundCards, scores })
        return { session: { ...session, phase: endedState.phase, roundData: endedState } }
      }

      return {
        session: {
          ...session,
          roundData: { ...state, foundCards, scores, currentCard: remaining[0], lastFound: state.currentCard.text, passedCards: [] },
        },
      }
    }

    // Player passes (skip card)
    if (act.type === 'pass-card') {
      if (memberId !== state.currentDescriber || !state.currentCard) return { session }
      const passedCards = [...state.passedCards, state.currentCard]
      const remaining = state.deck.filter(c => !state.foundCards.includes(c) && !passedCards.includes(c))

      if (remaining.length === 0) {
        // No more cards — end turn
        const nextTurnState = nextTurn({ ...state, passedCards })
        return { session: { ...session, roundData: nextTurnState } }
      }

      return {
        session: { ...session, roundData: { ...state, passedCards, currentCard: remaining[0] } },
      }
    }

    // Time's up (host or auto)
    if (act.type === 'time-up') {
      if (!state.currentDescriber) return { session }
      const nextTurnState = nextTurn({ ...state, timeLeft: 0 })
      return { session: { ...session, roundData: nextTurnState } }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    return state.phase === 'ended'
  },

  isAwaitingInput(_group, session) {
    const state = getState(session)
    return state.phase !== 'ended'
  },

  resolveRound(_group, session) {
    const state = getState(session)
    if (state.phase !== 'ended') return { session }
    const xpAwards: XpAward[] = Object.entries(state.scores).map(([memberId, score]) => ({
      memberId,
      amount: score * 2,
      statIncrements: { 'timesUp.cardsFound': score },
      reason: `${score} carte${score > 1 ? 's' : ''} trouvée${score > 1 ? 's' : ''}`,
    }))
    return { session: { ...session, status: 'ended', phase: 'ended', roundData: state }, xpAwards }
  },
}