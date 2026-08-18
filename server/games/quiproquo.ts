import type { PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import {
  QUIPROQUO_CONSTRAINTS,
  QUIPROQUO_TOPICS,
  DISCUSSION_TIME_SEC,
  type QuiproquoConstraint,
} from '../../src/data/quiproquo'

const TOTAL_ROUNDS = 3
const GUESS_XP = 3
const UNDETECTED_XP = 5

interface QuiproquoState {
  round: number
  totalRounds: number
  phase: 'intro' | 'reveal-constraints' | 'discussion' | 'guessing' | 'results' | 'ended'
  topic: string | null
  constraintsByMember: Record<string, QuiproquoConstraint>
  guesses: Record<string, string | null>  // voterId -> guessed constraintId for each target
  allGuesses: Record<string, Record<string, string>>  // voterId -> { targetId -> constraintId }
  scores: Record<string, number>
  timeLeft: number
  usedTopics: string[]
  usedConstraintIds: string[]
  results: { memberId: string; constraintId: string; guessedBy: string[]; guessedCorrectly: boolean }[]
}

function getState(session: PartySession): QuiproquoState {
  return session.roundData as QuiproquoState
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function assignConstraints(memberIds: string[], usedIds: string[]): Record<string, QuiproquoConstraint> {
  const available = QUIPROQUO_CONSTRAINTS.filter(c => !usedIds.includes(c.id))
  const pool = available.length >= memberIds.length ? available : QUIPROQUO_CONSTRAINTS
  const shuffled = shuffle(pool)
  const assignment: Record<string, QuiproquoConstraint> = {}
  memberIds.forEach((id, i) => {
    assignment[id] = shuffled[i % shuffled.length]
  })
  return assignment
}

function pickTopic(usedTopics: string[]): string {
  const available = QUIPROQUO_TOPICS.filter(t => !usedTopics.includes(t))
  const pool = available.length > 0 ? available : QUIPROQUO_TOPICS
  return pool[Math.floor(Math.random() * pool.length)]
}

export const quiproquo: GameModule = {
  id: 'quiproquo',
  name: 'Quiproquo',
  icon: '🎭',
  minPlayers: 4,

  initRound(group, session, _config) {
    const isFirstRound = session.round === 0
    const state = getState(session)

    if (!isFirstRound && state.phase === 'results') {
      // Start next round
      const nextRound = state.round + 1
      if (nextRound > state.totalRounds) {
        return { session: { ...session, status: 'ended', phase: 'ended', roundData: { ...state, phase: 'ended' } } }
      }

      const memberIds = group.members.map(m => m.id)
      const constraints = assignConstraints(memberIds, state.usedConstraintIds)
      const topic = pickTopic(state.usedTopics)
      const usedConstraintIds = [...state.usedConstraintIds, ...Object.values(constraints).map(c => c.id)]

      const newState: QuiproquoState = {
        ...state,
        round: nextRound,
        phase: 'reveal-constraints',
        topic,
        constraintsByMember: constraints,
        guesses: {},
        allGuesses: {},
        timeLeft: DISCUSSION_TIME_SEC,
        usedTopics: [...state.usedTopics, topic],
        usedConstraintIds,
        results: [],
      }
      return { session: { ...session, status: 'playing', phase: 'reveal-constraints', round: nextRound, roundData: newState } }
    }

    // First round
    const memberIds = group.members.map(m => m.id)
    const constraints = assignConstraints(memberIds, [])
    const topic = pickTopic([])

    const newState: QuiproquoState = {
      round: 1,
      totalRounds: TOTAL_ROUNDS,
      phase: 'reveal-constraints',
      topic,
      constraintsByMember: constraints,
      guesses: {},
      allGuesses: {},
      scores: {},
      timeLeft: DISCUSSION_TIME_SEC,
      usedTopics: [topic],
      usedConstraintIds: Object.values(constraints).map(c => c.id),
      results: [],
    }

    return { session: { ...session, status: 'playing', phase: 'reveal-constraints', round: 1, roundData: newState } }
  },

  handleAction(group, session, memberId, action) {
    const state = getState(session)
    const act = action as { type: string; payload: unknown }

    // Host starts discussion
    if (act.type === 'start-discussion') {
      if (state.phase !== 'reveal-constraints') return { session }
      return { session: { ...session, phase: 'discussion', roundData: { ...state, phase: 'discussion' } } }
    }

    // Host ends discussion → guessing phase
    if (act.type === 'end-discussion') {
      if (state.phase !== 'discussion') return { session }
      return { session: { ...session, phase: 'guessing', roundData: { ...state, phase: 'guessing' } } }
    }

    // Player submits a guess: guesses which constraint another player has
    if (act.type === 'submit-guess') {
      if (state.phase !== 'guessing') return { session }
      const { targetId, constraintId } = act.payload as { targetId: string; constraintId: string }
      if (targetId === memberId) return { session } // can't guess yourself

      const allGuesses = { ...state.allGuesses }
      if (!allGuesses[memberId]) allGuesses[memberId] = {}
      allGuesses[memberId][targetId] = constraintId

      // Check if all players have guessed all others
      const memberIds = group.members.map(m => m.id)
      const allDone = memberIds.every(voter => {
        if (!state.constraintsByMember[voter]) return true
        return allGuesses[voter] && memberIds.filter(t => t !== voter).every(t => allGuesses[voter][t])
      })

      if (allDone) {
        // Resolve results
        const results = memberIds.map(targetId => {
          const actualConstraint = state.constraintsByMember[targetId]
          const guessedBy: string[] = []
          memberIds.forEach(voter => {
            if (voter === targetId) return
            const guess = allGuesses[voter]?.[targetId]
            if (guess === actualConstraint.id) guessedBy.push(voter)
          })
          return {
            memberId: targetId,
            constraintId: actualConstraint.id,
            guessedBy,
            guessedCorrectly: guessedBy.length > 0,
          }
        })

        // Compute scores
        const scores = { ...state.scores }
        results.forEach(r => {
          // Points for guessing correctly
          memberIds.forEach(voter => {
            if (voter === r.memberId) return
            const guess = allGuesses[voter]?.[r.memberId]
            if (guess === r.constraintId) {
              scores[voter] = (scores[voter] ?? 0) + GUESS_XP
            }
          })
          // Points for NOT being detected
          if (!r.guessedCorrectly) {
            scores[r.memberId] = (scores[r.memberId] ?? 0) + UNDETECTED_XP
          }
        })

        return {
          session: { ...session, phase: 'results', roundData: { ...state, phase: 'results', allGuesses, scores, results } },
        }
      }

      return { session: { ...session, roundData: { ...state, allGuesses } } }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    return state.phase === 'results' || state.phase === 'ended'
  },

  isAwaitingInput(_group, session) {
    const state = getState(session)
    return state.phase !== 'ended' && state.phase !== 'results'
  },

  resolveRound(_group, session) {
    const state = getState(session)
    if (state.phase === 'ended') {
      const xpAwards: XpAward[] = Object.entries(state.scores).map(([memberId, score]) => ({
        memberId,
        amount: score,
        statIncrements: { 'quiproquo.totalScore': score },
        reason: `Score total: ${score}`,
      }))
      return { session: { ...session, status: 'ended', phase: 'ended', roundData: state }, xpAwards }
    }
    return { session }
  },
}