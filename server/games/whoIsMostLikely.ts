import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { WHO_IS_MOST_LIKELY_QUESTIONS, type PartyQuestion } from '../../src/data/partyQuestions'

const TOTAL_ROUNDS = 6
const VOTE_XP = 2
const WIN_XP = 15

interface RoundHistoryEntry {
  question: PartyQuestion
  tally: Record<string, number>
  winnerId: string | null
}

interface WhoIsMostLikelyState {
  usedQuestionIds: string[]
  currentQuestion: PartyQuestion | null
  votes: Record<string, string>
  totalRounds: number
  history: RoundHistoryEntry[]
}

function getState(session: PartySession): WhoIsMostLikelyState {
  return (
    (session.roundData as WhoIsMostLikelyState | null) ?? {
      usedQuestionIds: [],
      currentQuestion: null,
      votes: {},
      totalRounds: TOTAL_ROUNDS,
      history: [],
    }
  )
}

function pickQuestion(used: string[]): PartyQuestion {
  const available = WHO_IS_MOST_LIKELY_QUESTIONS.filter((q) => !used.includes(q.id))
  const pool = available.length > 0 ? available : WHO_IS_MOST_LIKELY_QUESTIONS
  return pool[Math.floor(Math.random() * pool.length)]
}

export const whoIsMostLikely: GameModule = {
  id: 'who-is-most-likely',
  name: 'Qui est le plus ?',
  icon: '🎯',
  minPlayers: 3,

  initRound(_group, session) {
    const state = getState(session)
    const isFirstRound = session.round === 0
    const round = isFirstRound ? 1 : session.round + 1

    if (!isFirstRound && round > state.totalRounds) {
      return { session: { ...session, status: 'ended', phase: 'ended' } }
    }

    const question = pickQuestion(state.usedQuestionIds)
    const nextState: WhoIsMostLikelyState = {
      ...state,
      usedQuestionIds: [...state.usedQuestionIds, question.id],
      currentQuestion: question,
      votes: {},
    }
    return {
      session: { ...session, status: 'playing', phase: 'voting', round, roundData: nextState },
    }
  },

  handleAction(group, session, memberId, action: GameAction) {
    if (session.phase !== 'voting' || action.type !== 'vote') return { session }
    const payload = action.payload as { targetMemberId?: string } | null
    const targetMemberId = payload?.targetMemberId
    if (!targetMemberId || !group.members.some((m) => m.id === targetMemberId)) return { session }

    const state = getState(session)
    if (state.votes[memberId]) return { session }

    const nextState: WhoIsMostLikelyState = { ...state, votes: { ...state.votes, [memberId]: targetMemberId } }
    return {
      session: { ...session, roundData: nextState },
      xpAwards: [
        {
          memberId,
          amount: VOTE_XP,
          statIncrements: { 'mostLikely.votesCast': 1 },
          reason: 'A voté à "Qui est le plus ?"',
        },
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
    const tally: Record<string, number> = {}
    for (const targetId of Object.values(state.votes)) {
      tally[targetId] = (tally[targetId] ?? 0) + 1
    }

    let winnerId: string | null = null
    let topVotes = 0
    let tie = false
    for (const [id, count] of Object.entries(tally)) {
      if (count > topVotes) {
        topVotes = count
        winnerId = id
        tie = false
      } else if (count === topVotes && topVotes > 0) {
        tie = true
      }
    }
    if (tie) winnerId = null

    const xpAwards: XpAward[] = []
    for (const [targetId, count] of Object.entries(tally)) {
      xpAwards.push({
        memberId: targetId,
        amount: 0,
        statIncrements: { 'mostLikely.votesReceived': count },
        reason: 'A reçu des votes à "Qui est le plus ?"',
      })
    }
    if (winnerId && state.currentQuestion) {
      const trait = state.currentQuestion.trait
      xpAwards.push({
        memberId: winnerId,
        amount: WIN_XP,
        trait,
        statIncrements: { 'mostLikely.wins': 1, [`mostLikely.wins.${trait}`]: 1 },
        reason: `Élu·e "${state.currentQuestion.text}"`,
      })
    }

    const nextState: WhoIsMostLikelyState = {
      ...state,
      history: [...state.history, { question: state.currentQuestion as PartyQuestion, tally, winnerId }],
    }

    return {
      session: { ...session, phase: 'reveal', roundData: nextState },
      xpAwards,
    }
  },
}
