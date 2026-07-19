import type { Group, PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { pickWithoutRepeat } from './pickHelpers'
import { WHEEL_GAGES } from '../../src/data/wheelSegments'
import {
  PC_TRACK,
  PC_FINISH_INDEX,
  PC_CAPTURE_SIPS,
  PC_CULSEC_SIPS,
  type PCCell,
} from '../../src/data/petitsChevaux'

/** Petits Chevaux à boire (18+). Jeu au tour par tour : le joueur courant lance le dé sur son
 * téléphone, le serveur calcule le déplacement (rebond à l'arrivée, événement de case, capture),
 * la TV anime le plateau. Premier·ère à l'arrivée gagne. */

const FINISH_XP = 20
const ROLL_XP = 1
const MAX_TURNS = 80 // garde-fou anti-partie-infinie

interface PCRoll {
  playerId: string
  die: number
  from: number
  to: number
  text: string
  captured: string[]
}

interface PCState {
  order: string[]
  currentIndex: number
  positions: Record<string, number>
  lastRoll: PCRoll | null
  totalSips: Record<string, number>
  finishOrder: string[]
  turnsPlayed: number
  usedGages: string[]
  winnerId: string | null
}

function emptyState(): PCState {
  return {
    order: [],
    currentIndex: 0,
    positions: {},
    lastRoll: null,
    totalSips: {},
    finishOrder: [],
    turnsPlayed: 0,
    usedGages: [],
    winnerId: null,
  }
}

function getState(session: PartySession): PCState {
  return (session.roundData as PCState | null) ?? emptyState()
}

function addSip(map: Record<string, number>, id: string, amount: number): void {
  if (amount > 0) map[id] = (map[id] ?? 0) + amount
}

/** Index du prochain joueur non arrivé (boucle sur l'ordre). Renvoie -1 si tout le monde a fini. */
function nextActiveIndex(state: PCState, from: number): number {
  const n = state.order.length
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n
    if (!state.finishOrder.includes(state.order[idx])) return idx
  }
  return -1
}

export const petitsChevaux: GameModule = {
  id: 'petits-chevaux',
  name: 'Petits Chevaux',
  icon: '🐴',
  minPlayers: 2,

  canStart(group: Group) {
    if (!group.adultModeEnabled) return 'Active le mode 18+ pour lancer les Petits Chevaux (jeu à boire).'
    return null
  },

  initRound(_group, session) {
    const state = getState(session)

    // 1) Premier appel : mise en place du plateau.
    if (session.round === 0 && session.phase === null) {
      const positions: Record<string, number> = {}
      for (const id of session.participantIds) positions[id] = 0
      const newState: PCState = { ...emptyState(), order: [...session.participantIds], positions }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    // 2) Fin des règles -> premier tour.
    if (session.phase === 'intro') {
      return { session: { ...session, phase: 'turn', round: 1, roundData: { ...state, currentIndex: 0 } } }
    }

    return { session }
  },

  handleAction(_group, session, memberId, action: GameAction) {
    const state = getState(session)
    if (session.phase !== 'turn' || action.type !== 'roll') return { session }
    if (state.order[state.currentIndex] !== memberId) return { session }
    if (state.finishOrder.includes(memberId)) return { session }

    const die = 1 + Math.floor(Math.random() * 6)
    const positions = { ...state.positions }
    const sips = { ...state.totalSips }
    const from = positions[memberId] ?? 0
    const last = PC_FINISH_INDEX

    // Déplacement avec rebond si on dépasse l'arrivée.
    let to = from + die
    if (to > last) to = last - (to - last)
    if (to < 0) to = 0

    let usedGages = state.usedGages
    let text = ''
    const cell: PCCell = PC_TRACK[to]

    switch (cell.type) {
      case 'drink':
        addSip(sips, memberId, cell.value ?? 1)
        text = `${cell.emoji} ${cell.label}`
        break
      case 'culsec':
        addSip(sips, memberId, PC_CULSEC_SIPS)
        text = `${cell.emoji} Cul sec !`
        break
      case 'everyone':
        for (const id of state.order) addSip(sips, id, 1)
        text = `${cell.emoji} Tournée générale, tout le monde boit 1 !`
        break
      case 'forward':
        to = Math.min(last, to + (cell.value ?? 1))
        text = `${cell.emoji} ${cell.label}`
        break
      case 'back':
        to = Math.max(0, to - (cell.value ?? 1))
        text = `${cell.emoji} ${cell.label}`
        break
      case 'gage': {
        const gage = pickWithoutRepeat(WHEEL_GAGES, state.usedGages)
        usedGages = [...state.usedGages, gage]
        text = `🎭 Gage : ${gage} (fais-le ou bois 3)`
        break
      }
      default:
        text = ''
    }

    // Capture : atterrir pile sur un adversaire (hors départ et arrivée) le renvoie au départ.
    const captured: string[] = []
    if (to !== 0 && to !== last) {
      for (const id of state.order) {
        if (id !== memberId && (positions[id] ?? 0) === to && !state.finishOrder.includes(id)) {
          positions[id] = 0
          addSip(sips, id, PC_CAPTURE_SIPS)
          captured.push(id)
        }
      }
    }
    positions[memberId] = to

    const finished = to === last
    const finishOrder = finished ? [...state.finishOrder, memberId] : state.finishOrder
    const winnerId = state.winnerId ?? (finished ? memberId : null)

    const lastRoll: PCRoll = { playerId: memberId, die, from, to, text, captured }
    const turnsPlayed = state.turnsPlayed + 1

    const xpAwards: XpAward[] = [
      { memberId, amount: ROLL_XP, statIncrements: { 'petitsChevaux.rolls': 1 }, reason: 'A lancé le dé aux Petits Chevaux' },
    ]
    if (finished) {
      xpAwards.push({
        memberId,
        amount: FINISH_XP,
        statIncrements: { 'petitsChevaux.finishes': 1 },
        reason: 'A atteint l\'arrivée aux Petits Chevaux',
      })
    }

    // Fin de partie : premier·ère arrivé·e, ou garde-fou de tours atteint.
    const everyoneDone = state.order.every((id) => finishOrder.includes(id))
    const gameOver = finished || everyoneDone || turnsPlayed >= MAX_TURNS

    const baseNext: PCState = { ...state, positions, totalSips: sips, lastRoll, finishOrder, winnerId, turnsPlayed, usedGages }

    if (gameOver) {
      return { session: { ...session, status: 'ended', phase: 'ended', roundData: baseNext }, xpAwards }
    }

    const nextIdx = nextActiveIndex(baseNext, state.currentIndex)
    return {
      session: { ...session, phase: 'turn', round: session.round + 1, roundData: { ...baseNext, currentIndex: nextIdx < 0 ? state.currentIndex : nextIdx } },
      xpAwards,
    }
  },

  isRoundComplete() {
    return false
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'turn'
  },

  // hostAdvance pendant un tour = sauter le joueur AFK.
  resolveRound(_group, session) {
    const state = getState(session)
    if (session.phase !== 'turn') return { session }
    const nextIdx = nextActiveIndex(state, state.currentIndex)
    if (nextIdx < 0) return { session }
    return { session: { ...session, round: session.round + 1, roundData: { ...state, currentIndex: nextIdx } } }
  },
}
