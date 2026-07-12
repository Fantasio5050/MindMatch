import type { PartySession } from '../../src/types'
import type { GameModule, GameAction } from './types'
import { dilemmasForPack, type Dilemma, type DilemmaPack } from '../../src/data/dilemmas'

type PackChoice = DilemmaPack | 'mixed'

const TOTAL_ROUNDS = 6
const VOTE_XP = 2

interface RoundHistoryEntry {
  dilemma: Dilemma
  tallyA: number
  tallyB: number
}

interface DilemmasState {
  pack: PackChoice
  usedIds: string[]
  currentDilemma: Dilemma | null
  votes: Record<string, 'A' | 'B'>
  totalRounds: number
  history: RoundHistoryEntry[]
}

function getState(session: PartySession): DilemmasState {
  return (
    (session.roundData as DilemmasState | null) ?? {
      pack: 'classic',
      usedIds: [],
      currentDilemma: null,
      votes: {},
      totalRounds: TOTAL_ROUNDS,
      history: [],
    }
  )
}

function pickDilemma(pack: PackChoice, used: string[]): Dilemma {
  const pool = dilemmasForPack(pack)
  const available = pool.filter((d) => !used.includes(d.id))
  const finalPool = available.length > 0 ? available : pool
  return finalPool[Math.floor(Math.random() * finalPool.length)]
}

export const dilemmas: GameModule = {
  id: 'dilemmas',
  name: 'Dilemmes & Débats',
  icon: '⚖️',
  minPlayers: 2,

  initRound(_group, session, config) {
    const state = getState(session)
    const isFirstRound = session.round === 0
    const round = isFirstRound ? 1 : session.round + 1
    const pack: PackChoice = isFirstRound
      ? ((config as { pack?: PackChoice } | undefined)?.pack ?? 'classic')
      : state.pack

    if (!isFirstRound && round > state.totalRounds) {
      return { session: { ...session, status: 'ended', phase: 'ended' } }
    }

    const dilemma = pickDilemma(pack, state.usedIds)
    const nextState: DilemmasState = {
      ...state,
      pack,
      usedIds: [...state.usedIds, dilemma.id],
      currentDilemma: dilemma,
      votes: {},
    }
    return { session: { ...session, status: 'playing', phase: 'voting', round, roundData: nextState } }
  },

  handleAction(_group, session, memberId, action: GameAction) {
    if (session.phase !== 'voting' || action.type !== 'vote') return { session }
    const payload = action.payload as { side?: 'A' | 'B' } | null
    if (payload?.side !== 'A' && payload?.side !== 'B') return { session }

    const state = getState(session)
    if (state.votes[memberId]) return { session }

    const nextState: DilemmasState = { ...state, votes: { ...state.votes, [memberId]: payload.side } }
    return {
      session: { ...session, roundData: nextState },
      xpAwards: [
        { memberId, amount: VOTE_XP, statIncrements: { 'dilemmas.votesCast': 1 }, reason: 'A voté sur un dilemme' },
      ],
    }
  },

  isRoundComplete(group, session) {
    if (session.phase !== 'voting') return false
    const state = getState(session)
    return Object.keys(state.votes).length >= group.members.length
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'voting'
  },

  resolveRound(_group, session) {
    const state = getState(session)
    let tallyA = 0
    let tallyB = 0
    for (const side of Object.values(state.votes)) {
      if (side === 'A') tallyA++
      else tallyB++
    }
    const nextState: DilemmasState = {
      ...state,
      history: [...state.history, { dilemma: state.currentDilemma as Dilemma, tallyA, tallyB }],
    }
    return { session: { ...session, phase: 'reveal', roundData: nextState } }
  },
}
