import type { Group, PartySession, TraitKey } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { questions } from '../../src/data/questions'
import type { Question } from '../../src/types'

const TOTAL_ROUNDS = 6
const CORRECT_GUESS_XP = 6
const PARTICIPATION_XP = 1
const TARGET_XP = 3

interface RoundHistoryEntry {
  targetMemberId: string
  question: Question
  correctOptionId: string
  tally: Record<string, number>
  correctGuesserIds: string[]
}

interface GuessMyAnswerState {
  usedRoundKeys: string[]
  targetMemberId: string | null
  currentQuestion: Question | null
  votes: Record<string, string>
  totalRounds: number
  history: RoundHistoryEntry[]
}

function getState(session: PartySession): GuessMyAnswerState {
  return (
    (session.roundData as GuessMyAnswerState | null) ?? {
      usedRoundKeys: [],
      targetMemberId: null,
      currentQuestion: null,
      votes: {},
      totalRounds: TOTAL_ROUNDS,
      history: [],
    }
  )
}

function pickTarget(group: Group, lastTargetId: string | null): Group['members'][number] {
  const eligible = group.members.filter((m) => m.scores !== null)
  const fresh = eligible.filter((m) => m.id !== lastTargetId)
  const pool = fresh.length > 0 ? fresh : eligible
  return pool[Math.floor(Math.random() * pool.length)]
}

function pickQuestion(target: Group['members'][number], used: string[]): Question {
  const answered = questions.filter((q) => target.answers[q.id])
  const fresh = answered.filter((q) => !used.includes(`${target.id}:${q.id}`))
  const pool = fresh.length > 0 ? fresh : answered.length > 0 ? answered : questions
  return pool[Math.floor(Math.random() * pool.length)]
}

function dominantTrait(weights: Partial<Record<TraitKey, number>>): TraitKey | undefined {
  let best: TraitKey | undefined
  let bestValue = -Infinity
  for (const [key, value] of Object.entries(weights)) {
    if ((value ?? 0) > bestValue) {
      bestValue = value ?? 0
      best = key as TraitKey
    }
  }
  return best
}

export const guessMyAnswer: GameModule = {
  id: 'guess-my-answer',
  name: 'Devine ma réponse',
  icon: '🕵️',
  minPlayers: 3,

  canStart(group) {
    const eligible = group.members.filter((m) => m.scores !== null).length
    if (eligible < 1) {
      return 'Il faut au moins 1 joueur ayant terminé le test de personnalité pour ce jeu.'
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

    const target = pickTarget(group, state.targetMemberId)
    const question = pickQuestion(target, state.usedRoundKeys)

    const nextState: GuessMyAnswerState = {
      ...state,
      usedRoundKeys: [...state.usedRoundKeys, `${target.id}:${question.id}`],
      targetMemberId: target.id,
      currentQuestion: question,
      votes: {},
    }
    return {
      session: { ...session, status: 'playing', phase: 'voting', round, roundData: nextState },
    }
  },

  handleAction(group, session, memberId, action: GameAction) {
    if (session.phase !== 'voting' || action.type !== 'vote') return { session }
    const state = getState(session)
    if (memberId === state.targetMemberId) return { session }

    const payload = action.payload as { optionId?: string } | null
    const optionId = payload?.optionId
    if (!optionId || !state.currentQuestion?.options.some((o) => o.id === optionId)) return { session }
    if (state.votes[memberId]) return { session }
    if (!group.members.some((m) => m.id === memberId)) return { session }

    const nextState: GuessMyAnswerState = { ...state, votes: { ...state.votes, [memberId]: optionId } }
    return {
      session: { ...session, roundData: nextState },
      xpAwards: [
        {
          memberId,
          amount: PARTICIPATION_XP,
          statIncrements: { 'guessMyAnswer.votesCast': 1 },
          reason: 'A tenté de deviner la réponse',
        },
      ],
    }
  },

  isRoundComplete(group, session) {
    if (session.phase !== 'voting') return false
    const state = getState(session)
    const expectedVoters = group.members.length - 1
    return Object.keys(state.votes).length >= Math.max(expectedVoters, 0)
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'voting'
  },

  resolveRound(group, session) {
    const state = getState(session)
    const targetId = state.targetMemberId as string
    const question = state.currentQuestion as Question
    const target = group.members.find((m) => m.id === targetId)
    const correctOptionId = target?.answers[question.id] ?? ''

    const tally: Record<string, number> = {}
    const correctGuesserIds: string[] = []
    for (const [guesserId, optionId] of Object.entries(state.votes)) {
      tally[optionId] = (tally[optionId] ?? 0) + 1
      if (optionId === correctOptionId) correctGuesserIds.push(guesserId)
    }

    const xpAwards: XpAward[] = correctGuesserIds.map((memberId) => ({
      memberId,
      amount: CORRECT_GUESS_XP,
      statIncrements: { 'guessMyAnswer.correctGuesses': 1 },
      reason: `A deviné la réponse de ${target?.pseudo ?? 'quelqu\'un'}`,
    }))
    const correctOption = question.options.find((o) => o.id === correctOptionId)
    xpAwards.push({
      memberId: targetId,
      amount: TARGET_XP,
      trait: correctOption ? dominantTrait(correctOption.weights) : undefined,
      statIncrements: { 'guessMyAnswer.timesTarget': 1 },
      reason: 'Sa réponse a été mise à l\'épreuve',
    })

    const nextState: GuessMyAnswerState = {
      ...state,
      history: [
        ...state.history,
        { targetMemberId: targetId, question, correctOptionId, tally, correctGuesserIds },
      ],
    }
    return { session: { ...session, phase: 'reveal', roundData: nextState }, xpAwards }
  },
}
