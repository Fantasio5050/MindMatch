import type { Group, PartySession, TraitKey } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { sortedTraits } from '../../src/lib/scoring'

const TOTAL_ROUNDS = 5
const CORRECT_GUESS_XP = 8
const MYSTERY_XP = 5
const TRAIT_TOP_COUNT = 2

interface RoundHistoryEntry {
  mysteryMemberId: string
  clueTraits: TraitKey[]
  tally: Record<string, number>
  correctGuesserIds: string[]
}

interface SecretProfileState {
  usedMysteryIds: string[]
  clueTraits: TraitKey[]
  votes: Record<string, string>
  totalRounds: number
  history: RoundHistoryEntry[]
  secrets: { mysteryMemberId: string | null }
}

function getState(session: PartySession): SecretProfileState {
  return (
    (session.roundData as SecretProfileState | null) ?? {
      usedMysteryIds: [],
      clueTraits: [],
      votes: {},
      totalRounds: TOTAL_ROUNDS,
      history: [],
      secrets: { mysteryMemberId: null },
    }
  )
}

function pickMystery(group: Group, used: string[]): Group['members'][number] {
  const eligible = group.members.filter((m) => m.scores !== null)
  const fresh = eligible.filter((m) => !used.includes(m.id))
  const pool = fresh.length > 0 ? fresh : eligible
  return pool[Math.floor(Math.random() * pool.length)]
}

export const secretProfile: GameModule = {
  id: 'secret-profile',
  name: 'Profil secret',
  icon: '🔍',
  minPlayers: 3,

  canStart(group) {
    const eligible = group.members.filter((m) => m.scores !== null).length
    if (eligible < 2) {
      return 'Il faut au moins 2 joueurs ayant terminé le test de personnalité pour ce jeu.'
    }
    return null
  },

  initRound(group, session) {
    const state = getState(session)
    const isFirstRound = session.round === 0
    const round = isFirstRound ? 1 : session.round + 1

    if (!isFirstRound && round > state.totalRounds) {
      return { session: { ...session, status: 'ended', phase: 'ended' } }
    }

    const mystery = pickMystery(group, state.usedMysteryIds)
    const clueTraits = sortedTraits(mystery.scores!).slice(0, TRAIT_TOP_COUNT)

    const nextState: SecretProfileState = {
      ...state,
      usedMysteryIds: [...state.usedMysteryIds, mystery.id],
      clueTraits,
      votes: {},
      secrets: { mysteryMemberId: mystery.id },
    }
    return {
      session: { ...session, status: 'playing', phase: 'voting', round, roundData: nextState },
    }
  },

  handleAction(group, session, memberId, action: GameAction) {
    if (session.phase !== 'voting' || action.type !== 'vote') return { session }
    const payload = action.payload as { guessMemberId?: string } | null
    const guessMemberId = payload?.guessMemberId
    if (!guessMemberId || !group.members.some((m) => m.id === guessMemberId)) return { session }

    const state = getState(session)
    if (state.votes[memberId]) return { session }

    const nextState: SecretProfileState = { ...state, votes: { ...state.votes, [memberId]: guessMemberId } }
    return {
      session: { ...session, roundData: nextState },
      xpAwards: [{ memberId, amount: 1, reason: 'A tenté de démasquer le profil secret' }],
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
    const mysteryMemberId = state.secrets.mysteryMemberId as string
    const tally: Record<string, number> = {}
    const correctGuesserIds: string[] = []
    for (const [guesserId, guessId] of Object.entries(state.votes)) {
      tally[guessId] = (tally[guessId] ?? 0) + 1
      if (guessId === mysteryMemberId) correctGuesserIds.push(guesserId)
    }

    const xpAwards: XpAward[] = correctGuesserIds.map((memberId) => ({
      memberId,
      amount: CORRECT_GUESS_XP,
      statIncrements: { 'secretProfile.correctGuesses': 1 },
      reason: 'A démasqué le profil secret',
    }))
    xpAwards.push({
      memberId: mysteryMemberId,
      amount: MYSTERY_XP,
      trait: state.clueTraits[0],
      statIncrements: { 'secretProfile.timesMystery': 1 },
      reason: 'Était le profil secret de la manche',
    })

    const nextState: SecretProfileState = {
      ...state,
      history: [...state.history, { mysteryMemberId, clueTraits: state.clueTraits, tally, correctGuesserIds }],
    }

    return {
      session: { ...session, phase: 'reveal', roundData: nextState },
      xpAwards,
    }
  },
}
