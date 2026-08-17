import type { PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import {
  truthOrDareForType,
  type TruthOrDareCard,
  type TruthOrDarePack,
  type TruthOrDareType,
} from '../../src/data/truthOrDare'

type PackChoice = TruthOrDarePack | 'mixed'

const TOTAL_ROUNDS = 8
const CHOICE_XP = 3
const COMPLETION_XP = 5
const VOTE_XP = 1
const MAX_STREAK = 3

interface PlayerState {
  streakTruth: number
  streakDare: number
  truthsAnswered: number
  daresCompleted: number
  daresRefused: number
}

interface TruthOrDareRoundState {
  pack: PackChoice
  usedIds: string[]
  currentCard: TruthOrDareCard | null
  currentMemberId: string | null
  currentChoice: TruthOrDareType | null // 'truth' | 'dare' | 'double-dare'
  forcedChoice: TruthOrDareType | null // si streak force un type
  votes: Record<string, boolean> // voterId -> approved
  roundComplete: boolean
  choiceComplete: boolean
  totalRounds: number
  playerStates: Record<string, PlayerState>
  turnOrder: string[]
  turnIndex: number
  history: { memberId: string; choice: TruthOrDareType; cardText: string; approved: boolean }[]
}

function getState(session: PartySession): TruthOrDareRoundState {
  return (
    (session.roundData as TruthOrDareRoundState | null) ?? {
      pack: 'classic',
      usedIds: [],
      currentCard: null,
      currentMemberId: null,
      currentChoice: null,
      forcedChoice: null,
      votes: {},
      roundComplete: false,
      choiceComplete: false,
      totalRounds: TOTAL_ROUNDS,
      playerStates: {},
      turnOrder: [],
      turnIndex: 0,
      history: [],
    }
  )
}

function pickCard(
  pack: PackChoice,
  type: TruthOrDareType,
  used: string[],
  customCards: TruthOrDareCard[],
): TruthOrDareCard {
  // Mix custom cards (from player proposals) with bank cards
  const bankPool = truthOrDareForType(pack, type)
  const customPool = customCards.filter((c) => c.type === type && !used.includes(c.id))
  const available = [...customPool, ...bankPool.filter((c) => !used.includes(c.id))]
  const finalPool = available.length > 0 ? available : bankPool
  return finalPool[Math.floor(Math.random() * finalPool.length)]
}

function getPlayerState(state: TruthOrDareRoundState, memberId: string): PlayerState {
  return (
    state.playerStates[memberId] ?? {
      streakTruth: 0,
      streakDare: 0,
      truthsAnswered: 0,
      daresCompleted: 0,
      daresRefused: 0,
    }
  )
}

function computeForcedChoice(state: TruthOrDareRoundState, memberId: string): TruthOrDareType | null {
  const ps = getPlayerState(state, memberId)
  if (ps.streakTruth >= MAX_STREAK) return 'dare'
  if (ps.streakDare >= MAX_STREAK) return 'truth'
  return null
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const truthOrDare: GameModule = {
  id: 'truth-or-dare',
  name: 'Action ou Vérité',
  icon: '🎯',
  minPlayers: 3,

  initRound(group, session, config) {
    const state = getState(session)
    const isFirstRound = session.round === 0
    const round = isFirstRound ? 1 : session.round + 1
    const pack: PackChoice = isFirstRound
      ? ((config as { pack?: PackChoice } | undefined)?.pack ?? 'classic')
      : state.pack

    if (!isFirstRound && round > state.totalRounds) {
      return { session: { ...session, status: 'ended', phase: 'ended', roundData: state } }
    }

    // Build turn order on first round
    let turnOrder = state.turnOrder
    let turnIndex = state.turnIndex
    if (isFirstRound || turnOrder.length === 0) {
      turnOrder = shuffleArray(group.members.map((m) => m.id))
      turnIndex = 0
    } else {
      turnIndex = (state.turnIndex + 1) % turnOrder.length
    }

    const currentMemberId = turnOrder[turnIndex]
    const forced = computeForcedChoice(state, currentMemberId)

    const nextState: TruthOrDareRoundState = {
      ...state,
      pack,
      currentCard: null,
      currentMemberId,
      currentChoice: null,
      forcedChoice: forced,
      votes: {},
      roundComplete: false,
      choiceComplete: false,
      totalRounds: state.totalRounds || TOTAL_ROUNDS,
      playerStates: state.playerStates,
      turnOrder,
      turnIndex,
    }

    return {
      session: { ...session, status: 'playing', phase: 'choosing', round, roundData: nextState },
    }
  },

  handleAction(group, session, memberId, action) {
    const state = getState(session)
    const act = action as { type: string; payload: unknown }

    // Action: choose truth or dare
    if (act.type === 'choose') {
      if (memberId !== state.currentMemberId) return { session }
      const choice = (act.payload as { choice: TruthOrDareType }).choice

      // Check forced choice
      if (state.forcedChoice && choice !== state.forcedChoice) {
        return { session } // ignore — forced
      }

      // Pick a card
      const card = pickCard(state.pack, choice, state.usedIds, [])
      const nextState: TruthOrDareRoundState = {
        ...state,
        currentChoice: choice,
        currentCard: card,
        usedIds: [...state.usedIds, card.id],
        choiceComplete: true,
      }

      return {
        session: { ...session, phase: 'revealed', roundData: nextState },
        xpAwards: [
          {
            memberId,
            amount: CHOICE_XP,
            statIncrements: { [`truthOrDare.${choice}s`]: 1 },
            reason: `A choisi ${choice === 'truth' ? 'Vérité' : choice === 'dare' ? 'Action' : 'Double Action'}`,
          },
        ],
      }
    }

    // Action: vote (group votes on whether truth was real or dare was completed)
    if (act.type === 'vote') {
      if (memberId === state.currentMemberId) return { session } // can't vote for yourself
      if (state.choiceComplete && state.currentCard) {
        const approved = (act.payload as { approved: boolean }).approved
        const votes = { ...state.votes, [memberId]: approved }
        const nextState = { ...state, votes }
        return { session: { ...session, roundData: nextState } }
      }
      return { session }
    }

    // Action: complete (player marks the dare/truth as done)
    if (act.type === 'complete') {
      if (memberId !== state.currentMemberId) return { session }

      const ps = getPlayerState(state, memberId)
      const approved = Object.values(state.votes).filter(Boolean).length >= Math.ceil((group.members.length - 1) / 2)
      const choice = state.currentChoice as TruthOrDareType

      const newPs: PlayerState = {
        ...ps,
        streakTruth: choice === 'truth' ? ps.streakTruth + 1 : 0,
        streakDare: choice === 'dare' || choice === 'double-dare' ? ps.streakDare + 1 : 0,
        truthsAnswered: choice === 'truth' ? ps.truthsAnswered + 1 : ps.truthsAnswered,
        daresCompleted: choice !== 'truth' ? ps.daresCompleted + 1 : ps.daresCompleted,
        daresRefused: 0,
      }

      const historyEntry = {
        memberId,
        choice,
        cardText: state.currentCard?.text ?? '',
        approved,
      }

      const nextState: TruthOrDareRoundState = {
        ...state,
        roundComplete: true,
        playerStates: { ...state.playerStates, [memberId]: newPs },
        history: [...state.history, historyEntry],
      }

      const xpAwards: XpAward[] = [
        {
          memberId,
          amount: COMPLETION_XP,
          statIncrements: { 'truthOrDare.completions': 1 },
          reason: approved ? 'A relevé le défi / répondu honnêtement' : 'A tenté',
        },
      ]
      // XP for voters who participated
      for (const [voterId] of Object.entries(state.votes)) {
        xpAwards.push({
          memberId: voterId,
          amount: VOTE_XP,
          reason: 'A voté',
        })
      }

      return {
        session: { ...session, phase: 'result', roundData: nextState },
        xpAwards,
      }
    }

    // Action: refuse (player refuses the dare)
    if (act.type === 'refuse') {
      if (memberId !== state.currentMemberId) return { session }

      const ps = getPlayerState(state, memberId)
      const choice = state.currentChoice as TruthOrDareType

      const newPs: PlayerState = {
        ...ps,
        streakTruth: 0,
        streakDare: 0,
        daresRefused: ps.daresRefused + 1,
      }

      const historyEntry = {
        memberId,
        choice,
        cardText: state.currentCard?.text ?? '',
        approved: false,
      }

      const nextState: TruthOrDareRoundState = {
        ...state,
        roundComplete: true,
        playerStates: { ...state.playerStates, [memberId]: newPs },
        history: [...state.history, historyEntry],
      }

      return {
        session: { ...session, phase: 'result', roundData: nextState },
        xpAwards: [
          {
            memberId,
            amount: 1,
            statIncrements: { 'truthOrDare.refusals': 1 },
            reason: 'A refusé le défi',
          },
        ],
      }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    return state.roundComplete
  },

  isAwaitingInput(_group, session) {
    const state = getState(session)
    return !state.roundComplete
  },

  resolveRound(_group, session) {
    return { session }
  },
}