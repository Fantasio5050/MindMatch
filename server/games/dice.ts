import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

/** Lancer de dés (18+). Chacun son tour lance un dé et boit le nombre de gorgées qu'il indique.
 * C'est tout — la mise en scène fait le reste : le dé roule en 3D sur la TV, et en 3D CSS sur les
 * téléphones quand il n'y a pas de TV.
 *
 * Le résultat est tiré ICI : un téléphone ne peut ni le choisir ni le prévoir. Chaque lancer porte
 * un numéro croissant (`n`) et une graine de trajectoire (`seed`) : la TV rejoue l'animation à
 * chaque nouveau numéro, et deux écrans qui regardent le même lancer voient le même roulé.
 * Rythmé par les joueurs (un lancer = tour suivant) et par l'hôte (passer un absent, finir). */

/** Délai minimal entre deux lancers : le temps que le dé précédent finisse de rouler à l'écran.
 * Volontairement plus court que l'animation côté client, qui verrouille déjà le bouton : il ne
 * sert qu'à empêcher un téléphone pressé (ou malveillant) d'enchaîner les lancers. */
export const DICE_COOLDOWN_MS = 1800
const HISTORY = 12
const ROLL_XP = 1
const SIX_XP = 2

export interface DiceRoll {
  /** Numéro du lancer dans la partie (1, 2, 3…). */
  n: number
  memberId: string
  value: number
  /** Graine de la trajectoire 3D. */
  seed: number
  at: number
}

interface DiceState {
  order: string[]
  currentIndex: number
  lastRoll: DiceRoll | null
  /** Les derniers lancers, du plus ancien au plus récent. */
  history: DiceRoll[]
  totalSips: Record<string, number>
  rollCount: Record<string, number>
  rolls: number
}

function getState(session: PartySession): DiceState {
  return (
    (session.roundData as DiceState | null) ?? {
      order: [],
      currentIndex: 0,
      lastRoll: null,
      history: [],
      totalSips: {},
      rollCount: {},
      rolls: 0,
    }
  )
}

function bump(totals: Record<string, number>, memberId: string, amount: number): Record<string, number> {
  return { ...totals, [memberId]: (totals[memberId] ?? 0) + amount }
}

export const dice: GameModule = {
  id: 'lancer-de-des',
  name: 'Lancer de dés',
  icon: '🎲',
  minPlayers: 2,
  adult: true,

  initRound(_group, session) {
    const state = getState(session)

    // Premier appel : ordre de passage figé, règles à l'écran.
    if (session.round === 0 && session.phase === null) {
      const fresh: DiceState = { order: [...session.participantIds], currentIndex: 0, lastRoll: null, history: [], totalSips: {}, rollCount: {}, rolls: 0 }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: fresh } }
    }

    if (session.phase === 'intro') {
      return { session: { ...session, phase: 'turn', round: 1, roundData: state } }
    }

    // Pendant un tour, l'avance de l'hôte passe le joueur absent.
    if (session.phase === 'turn' && state.order.length > 0) {
      return {
        session: { ...session, round: session.round + 1, roundData: { ...state, currentIndex: (state.currentIndex + 1) % state.order.length } },
      }
    }

    return { session }
  },

  handleAction(_group, session, memberId, action: GameAction) {
    const state = getState(session)

    if (action.type === 'roll' && session.phase === 'turn') {
      if (state.order[state.currentIndex] !== memberId) return { session }
      const now = Date.now()
      if (state.lastRoll && now - state.lastRoll.at < DICE_COOLDOWN_MS) return { session }

      const value = 1 + Math.floor(Math.random() * 6)
      const roll: DiceRoll = { n: state.rolls + 1, memberId, value, seed: Math.floor(Math.random() * 2 ** 31), at: now }
      const xpAwards: XpAward[] = [
        {
          memberId,
          amount: value === 6 ? SIX_XP : ROLL_XP,
          statIncrements: value === 6 ? { 'dice.rolls': 1, 'dice.sixes': 1 } : { 'dice.rolls': 1 },
          reason: 'A lancé le dé',
        },
      ]
      return {
        session: {
          ...session,
          round: session.round + 1,
          roundData: {
            ...state,
            currentIndex: (state.currentIndex + 1) % state.order.length,
            lastRoll: roll,
            history: [...state.history, roll].slice(-HISTORY),
            totalSips: bump(state.totalSips, memberId, value),
            rollCount: bump(state.rollCount, memberId, 1),
            rolls: roll.n,
          },
        },
        xpAwards,
      }
    }

    // L'hôte clôt la partie : classement des gorgées.
    if (action.type === 'finish' && session.phase === 'turn') {
      if (session.hostMemberId !== memberId) return { session }
      return { session: { ...session, status: 'ended', phase: 'ended' } }
    }

    return { session }
  },

  // Entièrement rythmé par les joueurs et l'hôte.
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
