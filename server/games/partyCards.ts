import type { PartySession } from '../../src/types'
import type { GameModule } from './types'
import { partyCardsForPack, type PartyCard, type PartyCardPack } from '../../src/data/partyCards'

type PackChoice = PartyCardPack | 'mixed'

const TOTAL_ROUNDS = 10
const CARD_XP = 4

interface RoundHistoryEntry {
  card: PartyCard
  assignedMemberId: string
}

interface PartyCardsState {
  pack: PackChoice
  usedIds: string[]
  currentCard: PartyCard | null
  assignedMemberId: string | null
  totalRounds: number
  history: RoundHistoryEntry[]
}

function getState(session: PartySession): PartyCardsState {
  return (
    (session.roundData as PartyCardsState | null) ?? {
      pack: 'classic',
      usedIds: [],
      currentCard: null,
      assignedMemberId: null,
      totalRounds: TOTAL_ROUNDS,
      history: [],
    }
  )
}

function pickCard(pack: PackChoice, used: string[]): PartyCard {
  const pool = partyCardsForPack(pack)
  const available = pool.filter((c) => !used.includes(c.id))
  const finalPool = available.length > 0 ? available : pool
  return finalPool[Math.floor(Math.random() * finalPool.length)]
}

export const partyCards: GameModule = {
  id: 'party-cards',
  name: 'Cartes de soirée',
  icon: '🃏',
  minPlayers: 2,

  initRound(group, session, config) {
    const state = getState(session)
    const isFirstRound = session.round === 0
    const round = isFirstRound ? 1 : session.round + 1
    const pack: PackChoice = isFirstRound
      ? ((config as { pack?: PackChoice } | undefined)?.pack ?? 'classic')
      : state.pack

    const history =
      !isFirstRound && state.currentCard
        ? [...state.history, { card: state.currentCard, assignedMemberId: state.assignedMemberId as string }]
        : state.history

    if (!isFirstRound && round > state.totalRounds) {
      return { session: { ...session, status: 'ended', phase: 'ended', roundData: { ...state, history } } }
    }

    const card = pickCard(pack, state.usedIds)
    const assigned = group.members[Math.floor(Math.random() * group.members.length)]

    const nextState: PartyCardsState = {
      ...state,
      pack,
      usedIds: [...state.usedIds, card.id],
      currentCard: card,
      assignedMemberId: assigned.id,
      history,
    }
    return {
      session: { ...session, status: 'playing', phase: 'card', round, roundData: nextState },
      xpAwards: [
        {
          memberId: assigned.id,
          amount: CARD_XP,
          statIncrements: { 'partyCards.cardsDrawn': 1 },
          reason: 'A tiré une carte de soirée',
        },
      ],
    }
  },

  handleAction(_group, session) {
    return { session }
  },

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
