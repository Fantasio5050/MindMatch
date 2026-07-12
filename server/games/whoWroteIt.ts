import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { WHO_WROTE_IT_PROMPTS, type WhoWroteItPrompt } from '../../src/data/whoWroteItPrompts'

const TOTAL_ROUNDS = 5
const CORRECT_GUESS_XP = 4
const FOOLED_XP_PER_WRONG_GUESS = 2
const SUBMIT_XP = 1
const MAX_TEXT_LENGTH = 140

interface RoundHistoryEntry {
  prompt: WhoWroteItPrompt
  entries: { text: string; authorId: string }[]
  correctByMember: Record<string, number>
}

interface WhoWroteItState {
  usedPromptIds: string[]
  currentPrompt: WhoWroteItPrompt | null
  submissions: Record<string, string>
  entries: { text: string }[]
  guesses: Record<string, Record<number, string>>
  secrets: { authorByIndex: Record<number, string> } | null
  revealedAuthors: Record<number, string> | null
  totalRounds: number
  history: RoundHistoryEntry[]
}

function getState(session: PartySession): WhoWroteItState {
  return (
    (session.roundData as WhoWroteItState | null) ?? {
      usedPromptIds: [],
      currentPrompt: null,
      submissions: {},
      entries: [],
      guesses: {},
      secrets: null,
      revealedAuthors: null,
      totalRounds: TOTAL_ROUNDS,
      history: [],
    }
  )
}

function pickPrompt(used: string[]): WhoWroteItPrompt {
  const available = WHO_WROTE_IT_PROMPTS.filter((p) => !used.includes(p.id))
  const pool = available.length > 0 ? available : WHO_WROTE_IT_PROMPTS
  return pool[Math.floor(Math.random() * pool.length)]
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export const whoWroteIt: GameModule = {
  id: 'who-wrote-it',
  name: 'Qui a écrit ça ?',
  icon: '✍️',
  minPlayers: 3,

  initRound(_group, session) {
    const state = getState(session)
    const isFirstRound = session.round === 0
    const round = isFirstRound ? 1 : session.round + 1

    if (!isFirstRound && round > state.totalRounds) {
      return { session: { ...session, status: 'ended', phase: 'ended' } }
    }

    const prompt = pickPrompt(state.usedPromptIds)
    const nextState: WhoWroteItState = {
      ...state,
      usedPromptIds: [...state.usedPromptIds, prompt.id],
      currentPrompt: prompt,
      submissions: {},
      entries: [],
      guesses: {},
      secrets: null,
      revealedAuthors: null,
    }
    return { session: { ...session, status: 'playing', phase: 'writing', round, roundData: nextState } }
  },

  handleAction(group, session, memberId, action: GameAction) {
    const state = getState(session)

    if (session.phase === 'writing' && action.type === 'submit') {
      const payload = action.payload as { text?: string } | null
      const text = payload?.text?.trim().slice(0, MAX_TEXT_LENGTH)
      if (!text || state.submissions[memberId]) return { session }

      const nextState: WhoWroteItState = { ...state, submissions: { ...state.submissions, [memberId]: text } }
      return {
        session: { ...session, roundData: nextState },
        xpAwards: [
          { memberId, amount: SUBMIT_XP, statIncrements: { 'whoWroteIt.submissions': 1 }, reason: 'A écrit une réponse' },
        ],
      }
    }

    if (session.phase === 'guessing' && action.type === 'guess') {
      const payload = action.payload as { entryIndex?: number; guessedMemberId?: string } | null
      const entryIndex = payload?.entryIndex
      const guessedMemberId = payload?.guessedMemberId
      if (
        entryIndex === undefined ||
        entryIndex < 0 ||
        entryIndex >= state.entries.length ||
        !guessedMemberId ||
        !group.members.some((m) => m.id === guessedMemberId)
      ) {
        return { session }
      }

      const nextState: WhoWroteItState = {
        ...state,
        guesses: { ...state.guesses, [memberId]: { ...(state.guesses[memberId] ?? {}), [entryIndex]: guessedMemberId } },
      }
      return { session: { ...session, roundData: nextState } }
    }

    return { session }
  },

  isRoundComplete(group, session) {
    const state = getState(session)
    if (session.phase === 'writing') {
      return Object.keys(state.submissions).length >= group.members.length
    }
    if (session.phase === 'guessing') {
      return group.members.every((m) => Object.keys(state.guesses[m.id] ?? {}).length >= state.entries.length)
    }
    return false
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'writing' || session.phase === 'guessing'
  },

  resolveRound(_group, session) {
    const state = getState(session)

    if (session.phase === 'writing') {
      const authorIds = shuffled(Object.keys(state.submissions))
      const entries = authorIds.map((id) => ({ text: state.submissions[id] }))
      const authorByIndex: Record<number, string> = {}
      authorIds.forEach((id, i) => (authorByIndex[i] = id))

      const nextState: WhoWroteItState = { ...state, entries, secrets: { authorByIndex }, guesses: {} }
      return { session: { ...session, phase: 'guessing', roundData: nextState } }
    }

    if (session.phase === 'guessing') {
      const authorByIndex = state.secrets?.authorByIndex ?? {}
      const xpAwards: XpAward[] = []
      const correctByMember: Record<string, number> = {}
      const wrongGuessesPerEntry: Record<number, number> = {}

      for (const [guesserId, guessMap] of Object.entries(state.guesses)) {
        let correctCount = 0
        for (const [idxStr, guessedId] of Object.entries(guessMap)) {
          const idx = Number(idxStr)
          const trueAuthor = authorByIndex[idx]
          if (guessedId === trueAuthor) correctCount++
          else wrongGuessesPerEntry[idx] = (wrongGuessesPerEntry[idx] ?? 0) + 1
        }
        correctByMember[guesserId] = correctCount
        if (correctCount > 0) {
          xpAwards.push({
            memberId: guesserId,
            amount: correctCount * CORRECT_GUESS_XP,
            statIncrements: { 'whoWroteIt.correctGuesses': correctCount },
            reason: 'A démasqué des auteurs à "Qui a écrit ça ?"',
          })
        }
      }

      for (const [idxStr, authorId] of Object.entries(authorByIndex)) {
        const fooled = wrongGuessesPerEntry[Number(idxStr)] ?? 0
        if (fooled > 0) {
          xpAwards.push({
            memberId: authorId,
            amount: fooled * FOOLED_XP_PER_WRONG_GUESS,
            statIncrements: { 'whoWroteIt.foolCount': fooled },
            reason: 'A trompé le groupe avec son texte',
          })
        }
      }

      const entriesWithAuthors = state.entries.map((e, i) => ({ text: e.text, authorId: authorByIndex[i] }))
      const nextState: WhoWroteItState = {
        ...state,
        revealedAuthors: authorByIndex,
        secrets: null,
        history: [
          ...state.history,
          { prompt: state.currentPrompt as WhoWroteItPrompt, entries: entriesWithAuthors, correctByMember },
        ],
      }
      return { session: { ...session, phase: 'reveal', roundData: nextState }, xpAwards }
    }

    return { session }
  },
}
