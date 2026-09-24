import type { PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import {
  timesUpCardsForCategory,
  CARDS_PER_PLAYER,
  TURN_TIME_SEC,
  type TimesUpCard,
  type TimesUpCategory,
} from '../../src/data/timesUp'

/**
 * Time's Up — mêmes cartes sur trois manches : description libre, un seul mot, mime.
 *
 * Réécrit. Dans la version précédente :
 *  - la TV affichait LE MOT À FAIRE DEVINER en très gros, sur l'écran que regardent justement
 *    ceux qui devinent, pendant que le téléphone du joueur qui décrit n'affichait rien (le client
 *    attendait `isYourTurn`, jamais produit) ;
 *  - passer toutes les cartes restantes terminait la manche, cartes non trouvées comprises ;
 *  - le chrono du téléphone repartait à 30 s à chaque carte trouvée : un tour ne finissait pas ;
 *  - le tour suivant démarrait aussitôt, avant que le joueur suivant ait son téléphone en main ;
 *  - n'importe qui pouvait déclarer « temps écoulé » pendant le tour d'un autre.
 *
 * Déroulé : le joueur désigné lance lui-même son tour (« Je suis prêt »), fait deviner autant de
 * cartes que possible en 30 s ; une carte passée retourne sous la pioche et reviendra. La manche
 * s'arrête quand TOUTES les cartes ont été trouvées, puis les mêmes cartes reviennent, mélangées.
 */

const TURN_MS = TURN_TIME_SEC * 1000
const CLOCK_SLACK_MS = 1_000
const FOUND_XP = 2

type Round = 1 | 2 | 3

interface TimesUpState {
  phase: 'round1' | 'round2' | 'round3' | 'ended'
  round: Round
  category: TimesUpCategory | 'mixed'
  allCards: TimesUpCard[]
  /** Cartes restant à trouver dans cette manche (hors carte en main). */
  deck: TimesUpCard[]
  foundThisRound: TimesUpCard[]
  turnOrder: string[]
  turnIndex: number
  /** Le tour du joueur désigné est-il lancé (chrono en marche) ? */
  turnActive: boolean
  turnEndsAt: number
  /** Identité du tour, pour ignorer les « temps écoulé » en retard ou en double. */
  turnSeq: number
  currentCard: TimesUpCard | null
  foundThisTurn: TimesUpCard[]
  passedThisTurn: number
  lastFound: string | null
  /** Pause entre deux manches : l'hôte relance. */
  betweenRounds: boolean
  scores: Record<string, number>
  roundResults: { round: Round; found: TimesUpCard[]; missed: TimesUpCard[] }[]
}

function getState(session: PartySession): TimesUpState | null {
  return session.roundData as TimesUpState | null
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const describerId = (s: TimesUpState) => s.turnOrder[s.turnIndex % s.turnOrder.length]
const phaseOf = (r: Round) => (`round${r}` as TimesUpState['phase'])

/** Fin du tour : la carte en main retourne dans la pioche, la main passe au joueur suivant. */
function endTurn(s: TimesUpState): TimesUpState {
  const deck = s.currentCard ? shuffle([...s.deck, s.currentCard]) : s.deck
  return {
    ...s,
    deck,
    currentCard: null,
    turnActive: false,
    turnIndex: s.turnIndex + 1,
    turnSeq: s.turnSeq + 1,
    foundThisTurn: [],
    passedThisTurn: 0,
  }
}

/** Toutes les cartes trouvées : manche close (et partie, après la troisième). */
function endRound(s: TimesUpState): TimesUpState {
  const closed: TimesUpState = {
    ...s,
    currentCard: null,
    turnActive: false,
    turnIndex: s.turnIndex + 1,
    turnSeq: s.turnSeq + 1,
    foundThisTurn: [],
    passedThisTurn: 0,
    roundResults: [...s.roundResults, { round: s.round, found: s.foundThisRound, missed: [] }],
  }
  if (s.round === 3) return { ...closed, phase: 'ended' }
  return { ...closed, betweenRounds: true }
}

function sessionWith(session: PartySession, s: TimesUpState): PartySession {
  return s.phase === 'ended'
    ? { ...session, status: 'ended', phase: 'ended', roundData: s }
    : { ...session, phase: s.phase, roundData: s }
}

function finalXp(s: TimesUpState): XpAward[] {
  return Object.entries(s.scores)
    .filter(([, n]) => n > 0)
    .map(([memberId, n]) => ({
      memberId,
      amount: n * FOUND_XP,
      statIncrements: { 'timesUp.cardsFound': n },
      reason: `${n} carte${n > 1 ? 's' : ''} fait${n > 1 ? 'es' : 'e'} deviner`,
    }))
}

export const timesUp: GameModule = {
  id: 'times-up',
  name: "Time's Up",
  icon: '⏰',
  minPlayers: 4,

  initRound(_group, session, config) {
    const state = getState(session)
    if (session.round === 0 || !state) {
      const category = ((config as { category?: TimesUpCategory | 'mixed' } | undefined)?.category ?? 'mixed')
      const pool = timesUpCardsForCategory(category)
      const allCards = shuffle(pool).slice(0, Math.min(pool.length, CARDS_PER_PLAYER * session.participantIds.length))
      const s: TimesUpState = {
        phase: 'round1',
        round: 1,
        category,
        allCards,
        deck: shuffle(allCards),
        foundThisRound: [],
        turnOrder: shuffle(session.participantIds),
        turnIndex: 0,
        turnActive: false,
        turnEndsAt: 0,
        turnSeq: 0,
        currentCard: null,
        foundThisTurn: [],
        passedThisTurn: 0,
        lastFound: null,
        betweenRounds: false,
        scores: {},
        roundResults: [],
      }
      return { session: { ...session, status: 'playing', phase: s.phase, round: 1, roundData: s } }
    }
    // Hôte, entre deux manches : les mêmes cartes reviennent, remélangées.
    if (state.betweenRounds) {
      const round = (state.round + 1) as Round
      const s: TimesUpState = {
        ...state,
        round,
        phase: phaseOf(round),
        deck: shuffle(state.allCards),
        foundThisRound: [],
        lastFound: null,
        betweenRounds: false,
      }
      return { session: { ...session, phase: s.phase, round, roundData: s } }
    }
    return { session }
  },

  handleAction(_group, session, memberId, action) {
    const state = getState(session)
    if (!state || state.phase === 'ended' || state.betweenRounds) return { session }
    const isDescriber = memberId === describerId(state)
    const isHost = memberId === session.hostMemberId

    // Le joueur désigné lance son chrono quand il a le téléphone en main (ou l'hôte pour lui).
    if (action.type === 'start-turn') {
      if (state.turnActive || !(isDescriber || isHost)) return { session }
      const [card, ...rest] = state.deck
      if (!card) return { session }
      const s: TimesUpState = {
        ...state,
        turnActive: true,
        turnEndsAt: Date.now() + TURN_MS,
        currentCard: card,
        deck: rest,
        lastFound: null,
      }
      return { session: sessionWith(session, s) }
    }

    if (!state.turnActive || !state.currentCard) return { session }
    const expired = Date.now() > state.turnEndsAt + CLOCK_SLACK_MS

    if (action.type === 'card-found') {
      // Trouvée après la sonnerie : ne compte pas (le serveur fait foi, pas le téléphone).
      if (!isDescriber || expired) return { session }
      const found = state.currentCard
      const scores = { ...state.scores, [memberId]: (state.scores[memberId] ?? 0) + 1 }
      const foundThisRound = [...state.foundThisRound, found]
      const [next, ...rest] = state.deck
      let s: TimesUpState = {
        ...state,
        scores,
        foundThisRound,
        foundThisTurn: [...state.foundThisTurn, found],
        lastFound: found.text,
        currentCard: next ?? null,
        deck: rest,
      }
      if (!next) {
        s = endRound(s)
        return { session: sessionWith(session, s), xpAwards: s.phase === 'ended' ? finalXp(s) : [] }
      }
      return { session: sessionWith(session, s) }
    }

    if (action.type === 'pass-card') {
      if (!isDescriber || expired) return { session }
      // La carte passée repart SOUS la pioche : elle reviendra, dans ce tour ou un suivant.
      if (state.deck.length === 0) return { session } // c'est la dernière : rien à passer
      const [next, ...rest] = state.deck
      const s: TimesUpState = { ...state, currentCard: next, deck: [...rest, state.currentCard], passedThisTurn: state.passedThisTurn + 1 }
      return { session: sessionWith(session, s) }
    }

    if (action.type === 'time-up') {
      const seq = (action.payload as { turn?: unknown } | null)?.turn
      if (seq !== state.turnSeq) return { session } // demande en retard ou en double
      // Le joueur qui décrit peut arrêter son tour ; les autres seulement une fois le temps écoulé.
      if (!isDescriber && !isHost && Date.now() < state.turnEndsAt - CLOCK_SLACK_MS) return { session }
      return { session: sessionWith(session, endTurn(state)) }
    }

    return { session }
  },

  isRoundComplete() {
    return false
  },

  isAwaitingInput(_group, session) {
    const s = getState(session)
    return !!s && s.phase !== 'ended' && !s.betweenRounds
  },

  /** Hôte pendant une manche : lance le tour d'un joueur distrait, ou arrête un tour qui traîne. */
  resolveRound(_group, session) {
    const state = getState(session)
    if (!state || state.phase === 'ended' || state.betweenRounds) return { session }
    if (state.turnActive) return { session: sessionWith(session, endTurn(state)) }
    const [card, ...rest] = state.deck
    if (!card) return { session }
    return {
      session: sessionWith(session, { ...state, turnActive: true, turnEndsAt: Date.now() + TURN_MS, currentCard: card, deck: rest, lastFound: null }),
    }
  },

  viewFor(group, session, memberId) {
    const s = getState(session)
    if (!s) return null
    const d = describerId(s)
    const dm = group.members.find((m) => m.id === d)
    const isYourTurn = !!memberId && memberId === d
    return {
      phase: s.phase,
      round: s.round,
      // La carte n'existe que sur le téléphone de celui qui fait deviner — jamais sur la TV.
      currentCard: isYourTurn && s.turnActive ? s.currentCard : null,
      currentDescriber: dm ? { memberId: dm.id, pseudo: dm.pseudo, color: dm.color } : null,
      isYourTurn,
      turnActive: s.turnActive,
      turnSeq: s.turnSeq,
      betweenRounds: s.betweenRounds,
      timeLeft: s.turnActive ? Math.max(0, s.turnEndsAt - Date.now()) : TURN_MS,
      turnTotal: TURN_MS,
      cardsRemaining: s.deck.length + (s.currentCard ? 1 : 0),
      totalCards: s.allCards.length,
      foundCount: s.foundThisRound.length,
      foundThisTurn: s.foundThisTurn.map((c) => c.text),
      passedThisTurn: s.passedThisTurn,
      lastFound: s.lastFound,
      scores: s.scores,
      turnOrder: s.turnOrder,
      roundResults: s.roundResults,
    }
  },
}
