import type { PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'

/**
 * Histoire à un mot — chacun son tour, un mot, une histoire collective.
 *
 * Réécrit : la vue client lisait `myTurn`, `currentTurn`, `timeLeft` qu'aucun code ne produisait
 * (personne ne pouvait écrire), le client envoyait `skip-word` que le serveur ignorait (un joueur
 * absent bloquait tout), et les hooks de la vue étaient appelés après un retour anticipé.
 *
 * ## Un seul passage par tour
 * Chaque téléphone affiche le chrono et demande « passer » quand il expire. À cinq joueurs, ce
 * sont cinq demandes qui arrivent en rafale : sans garde, elles auraient sauté cinq tours d'un
 * coup. Chaque demande porte donc le numéro du tour qu'elle vise, et n'est acceptée que si ce
 * tour est toujours le tour courant ET que son temps est réellement écoulé (l'hôte, lui, peut
 * passer à tout moment).
 */

const DEFAULT_TOTAL_WORDS = 30
const TURN_TIME_MS = 15_000
/** Tolérance d'horloge : le chrono du téléphone peut finir un peu avant celui du serveur. */
const CLOCK_SLACK_MS = 1_000
const MAX_WORD_LENGTH = 30
const WORD_XP = 1

interface TurnInfo {
  memberId: string
  word: string
  timestamp: number
}

interface OneWordStoryState {
  phase: 'intro' | 'writing' | 'ended'
  order: string[]
  /** Compteur de tours, monotone : c'est l'identité d'un tour (passés compris). */
  turnNumber: number
  story: string[]
  history: TurnInfo[]
  totalWords: number
  turnDeadline: number
  skipped: number
}

function getState(session: PartySession): OneWordStoryState | null {
  return session.roundData as OneWordStoryState | null
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const currentId = (s: OneWordStoryState) => s.order[s.turnNumber % s.order.length]

function nextTurn(s: OneWordStoryState): OneWordStoryState {
  return { ...s, turnNumber: s.turnNumber + 1, turnDeadline: Date.now() + TURN_TIME_MS }
}

/** Garde un seul mot, sans espaces, borné en longueur. La ponctuation collée est gardée (« fin. »). */
function cleanWord(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const w = raw.trim().split(/\s+/)[0]?.slice(0, MAX_WORD_LENGTH)
  return w ? w : null
}

function ended(session: PartySession, s: OneWordStoryState): PartySession {
  return { ...session, status: 'ended', phase: 'ended', roundData: { ...s, phase: 'ended' } }
}

export const oneWordStory: GameModule = {
  id: 'one-word-story',
  name: 'Histoire à un mot',
  icon: '📖',
  minPlayers: 3,

  initRound(_group, session, config) {
    const state = getState(session)
    if (session.round === 0 || !state) {
      const cfg = config as { totalWords?: number } | undefined
      const totalWords = cfg?.totalWords ? Math.max(10, Math.min(100, Math.floor(cfg.totalWords))) : DEFAULT_TOTAL_WORDS
      const s: OneWordStoryState = {
        phase: 'intro',
        order: shuffle(session.participantIds),
        turnNumber: 0,
        story: [],
        history: [],
        totalWords,
        turnDeadline: 0,
        skipped: 0,
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 1, roundData: s } }
    }
    if (state.phase === 'intro') {
      const s: OneWordStoryState = { ...state, phase: 'writing', turnDeadline: Date.now() + TURN_TIME_MS }
      return { session: { ...session, phase: 'writing', roundData: s } }
    }
    if (state.phase === 'ended') return { session: ended(session, state) }
    return { session }
  },

  handleAction(_group, session, memberId, action) {
    const state = getState(session)
    if (!state || state.phase !== 'writing') return { session }

    if (action.type === 'submit-word') {
      if (currentId(state) !== memberId) return { session }
      const word = cleanWord((action.payload as { word?: unknown } | null)?.word)
      if (!word) return { session }
      const story = [...state.story, word]
      const s: OneWordStoryState = {
        ...state,
        story,
        history: [...state.history, { memberId, word, timestamp: Date.now() }],
      }
      const xpAwards: XpAward[] = [
        { memberId, amount: WORD_XP, statIncrements: { 'oneWordStory.wordsContributed': 1 }, reason: 'A ajouté un mot à l’histoire' },
      ]
      if (story.length >= s.totalWords) return { session: ended(session, s), xpAwards }
      return { session: { ...session, round: session.round + 1, roundData: nextTurn(s) }, xpAwards }
    }

    if (action.type === 'skip-word') {
      const turn = (action.payload as { turn?: unknown } | null)?.turn
      if (turn !== state.turnNumber) return { session } // demande en retard : le tour a déjà changé
      const isHost = memberId === session.hostMemberId
      if (!isHost && Date.now() < state.turnDeadline - CLOCK_SLACK_MS) return { session }
      return { session: { ...session, round: session.round + 1, roundData: nextTurn({ ...state, skipped: state.skipped + 1 }) } }
    }

    // L'hôte peut clore l'histoire quand elle a trouvé sa chute, sans attendre le compte.
    if (action.type === 'finish' && memberId === session.hostMemberId && state.story.length > 0) {
      return { session: ended(session, state) }
    }

    return { session }
  },

  isRoundComplete() {
    return false
  },

  isAwaitingInput(_group, session) {
    return getState(session)?.phase === 'writing'
  },

  /** Hôte pendant l'écriture : passer le joueur courant. */
  resolveRound(_group, session) {
    const state = getState(session)
    if (!state || state.phase !== 'writing') return { session }
    return { session: { ...session, round: session.round + 1, roundData: nextTurn({ ...state, skipped: state.skipped + 1 }) } }
  },

  viewFor(group, session, memberId) {
    const s = getState(session)
    if (!s) return null
    const cur = s.phase === 'writing' ? currentId(s) : null
    const m = cur ? group.members.find((x) => x.id === cur) : null
    return {
      phase: s.phase,
      story: s.story,
      history: s.history,
      totalWords: s.totalWords,
      turnIndex: s.turnNumber,
      currentTurn: m ? { memberId: m.id, pseudo: m.pseudo, color: m.color } : null,
      myTurn: !!memberId && cur === memberId,
      // Temps restant au moment de l'envoi : relatif, pour ne pas dépendre de l'heure du téléphone.
      timeLeft: s.phase === 'writing' ? Math.max(0, s.turnDeadline - Date.now()) : 0,
      order: s.order,
      completed: s.phase === 'ended',
    }
  },
}
