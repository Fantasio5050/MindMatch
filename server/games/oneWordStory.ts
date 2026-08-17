import type { Group, PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'

const DEFAULT_TOTAL_WORDS = 30
const TURN_TIME_MS = 15_000 // 15 secondes par tour
const WORD_XP = 1

interface TurnInfo {
  memberId: string
  word: string
  timestamp: number
}

interface OneWordStoryState {
  /** Ordre des joueurs (mélangé au début) */
  order: string[]
  /** Index du joueur dont c'est le tour dans `order` */
  turnIndex: number
  /** Mots accumulés dans l'histoire */
  story: string[]
  /** Nombre total de mots visés (paramétrable) */
  totalWords: number
  /** Timestamp limite du tour actuel (server-side pour le timeout) */
  turnDeadline: number
  /** Historique des tours pour l'affichage */
  history: TurnInfo[]
  /** Si la partie est finie (tous les mots posés) */
  completed: boolean
}

function getState(session: PartySession): OneWordStoryState {
  return (
    (session.roundData as OneWordStoryState | null) ?? {
      order: [],
      turnIndex: 0,
      story: [],
      totalWords: DEFAULT_TOTAL_WORDS,
      turnDeadline: 0,
      history: [],
      completed: false,
    }
  )
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function advanceTurn(state: OneWordStoryState): OneWordStoryState {
  // Passe au joueur suivant
  const nextTurnIndex = (state.turnIndex + 1) % state.order.length
  const turnDeadline = Date.now() + TURN_TIME_MS

  return {
    ...state,
    turnIndex: nextTurnIndex,
    turnDeadline,
  }
}

function isGameComplete(state: OneWordStoryState): boolean {
  return state.story.length >= state.totalWords
}

export const oneWordStory: GameModule = {
  id: 'one-word-story',
  name: 'Histoire à un mot',
  icon: '📖',
  minPlayers: 3,

  canStart(group: Group): string | null {
    if (group.members.length < 3) {
      return 'Il faut au moins 3 joueurs pour jouer à "Histoire à un mot".'
    }
    return null
  },

  initRound(_group, session, config): { session: PartySession; xpAward?: XpAward[] } {
    const state = getState(session)
    const isFirstRound = session.round === 0

    // Configuration optionnelle (ex: nombre de mots personnalisé)
    const cfg = config as { totalWords?: number } | undefined
    const totalWords = isFirstRound && cfg?.totalWords ? Math.max(10, Math.min(100, cfg.totalWords)) : state.totalWords

    if (!isFirstRound && session.phase === 'ended') {
      // Partie déjà finie
      return { session: { ...session, status: 'ended', phase: 'ended' } }
    }

    if (!isFirstRound && isGameComplete(state)) {
      // L'histoire est complète, on termine
      return { session: { ...session, status: 'ended', phase: 'ended', roundData: { ...state, completed: true } } }
    }

    if (isFirstRound) {
      // Première initialisation : mélanger l'ordre des joueurs
      const order = shuffle(session.participantIds)
      const turnDeadline = Date.now() + TURN_TIME_MS

      const newState: OneWordStoryState = {
        order,
        turnIndex: 0,
        story: [],
        totalWords,
        turnDeadline,
        history: [],
        completed: false,
      }

      return {
        session: {
          ...session,
          status: 'playing',
          phase: 'writing',
          round: 1,
          roundData: newState,
        },
      }
    }

    // Tours suivants : avancer au joueur suivant si le tour précédent n'a pas fini la partie
    if (session.phase === 'writing' || session.phase === 'turn') {
      // Le joueur actuel a joué (ou timeout), on passe au suivant
      const nextState = advanceTurn(state)
      const nextRound = session.round + 1

      // Vérifier si la partie est finie après ce tour
      if (isGameComplete(nextState)) {
        return {
          session: {
            ...session,
            status: 'ended',
            phase: 'ended',
            round: nextRound,
            roundData: { ...nextState, completed: true },
          },
        }
      }

      return {
        session: {
          ...session,
          phase: 'writing',
          round: nextRound,
          roundData: nextState,
        },
      }
    }

    return { session }
  },

  handleAction(_group, session, memberId, action) {
    const state = getState(session)

    // Seule l'action 'submit-word' en phase 'writing' est gérée ici
    if (session.phase !== 'writing' || action.type !== 'submit-word') {
      return { session }
    }

    // Vérifier que c'est bien le tour de ce joueur
    const currentPlayerId = state.order[state.turnIndex]
    if (currentPlayerId !== memberId) {
      return { session }
    }

    // Vérifier que le timer n'a pas expiré (côté serveur pour la sécurité)
    if (Date.now() > state.turnDeadline) {
      // Timeout : on passe au joueur suivant sans mot
      const nextState = advanceTurn(state)
      const nextRound = session.round + 1

      if (isGameComplete(nextState)) {
        return {
          session: {
            ...session,
            status: 'ended',
            phase: 'ended',
            round: nextRound,
            roundData: { ...nextState, completed: true },
          },
        }
      }

      return {
        session: {
          ...session,
          round: nextRound,
          roundData: nextState,
        },
      }
    }

    const payload = action.payload as { word?: string } | null
    const word = payload?.word?.trim()

    // Valider le mot : 1 seul mot, pas vide, pas trop long
    if (!word) {
      return { session }
    }

    // Nettoyer : un seul mot (pas d'espaces), max 30 caractères
    const cleanWord = word.split(/\s+/)[0].slice(0, 30)
    if (!cleanWord) {
      return { session }
    }

    // Ajouter le mot à l'histoire
    const newStory = [...state.story, cleanWord]
    const historyEntry: TurnInfo = {
      memberId,
      word: cleanWord,
      timestamp: Date.now(),
    }

    const nextState: OneWordStoryState = {
      ...state,
      story: newStory,
      history: [...state.history, historyEntry],
    }

    // XP pour participation
    const xpAwards: XpAward[] = [
      {
        memberId,
        amount: WORD_XP,
        statIncrements: { 'oneWordStory.wordsContributed': 1 },
        reason: 'A contribué un mot à l\'histoire',
      },
    ]

    // La résolution du tour (passage au joueur suivant ou fin) se fait dans initRound
    // via isRoundComplete / resolveRound. Ici on met juste à jour l'état.
    return {
      session: {
        ...session,
        roundData: nextState,
      },
      xpAwards,
    }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    if (session.phase !== 'writing') return false

    // Le tour est complet si :
    // 1. Le joueur actuel a soumis son mot (géré par handleAction qui met à jour l'histoire)
    // 2. OU le timer a expiré (vérifié côté serveur dans handleAction ou ici)
    // Pour simplifier : on considère le tour complet dès qu'on a un nouveau mot dans l'histoire
    // par rapport au tour précédent, OU si timeout.
    // Mais comme handleAction ne fait pas avancer le tour, on laisse initRound le faire
    // au prochain appel. Ici on dit "true" si le joueur actuel a joué (dernier mot = son tour)
    // OU si le timer est dépassé.
    const currentPlayerId = state.order[state.turnIndex]
    const lastTurn = state.history[state.history.length - 1]
    const hasPlayed = lastTurn?.memberId === currentPlayerId
    const isTimeout = Date.now() > state.turnDeadline

    return hasPlayed || isTimeout
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'writing'
  },

  resolveRound(_group: Group, session: PartySession): { session: PartySession; xpAwards?: XpAward[] } {
    const state = getState(session)

    // Si le tour n'est pas complet, ne rien faire
    if (!this.isRoundComplete(_group, session)) {
      return { session }
    }

    // Vérifier si timeout (joueur n'a pas joué)
    const isTimeout = Date.now() > state.turnDeadline
    const currentPlayerId = state.order[state.turnIndex]
    const lastTurn = state.history[state.history.length - 1]
    const hasPlayed = lastTurn?.memberId === currentPlayerId

    // Si timeout et pas joué, on ajoute un marqueur "skip" (optionnel, pour l'affichage)
    // Mais on ne met pas de mot, on passe juste au suivant
    let nextState = state

    if (isTimeout && !hasPlayed) {
      // Marquer le timeout dans l'historique (optionnel - pour debug/affichage)
      // On n'ajoute pas de mot, on passe juste au tour suivant
    }

    // Avancer au tour suivant
    nextState = advanceTurn(nextState)
    const nextRound = session.round + 1

    // Vérifier fin de partie
    if (isGameComplete(nextState)) {
      return {
        session: {
          ...session,
          status: 'ended',
          phase: 'ended',
          round: nextRound,
          roundData: { ...nextState, completed: true },
        },
      }
    }

    return {
      session: {
        ...session,
        phase: 'writing',
        round: nextRound,
        roundData: nextState,
      },
    }
  },
}