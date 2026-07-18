import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { CHAMBER_COUNT, BANG_CULSEC_SIPS, CLICK_SIPS, RUSSIAN_ROULETTE_GAGES } from '../../src/data/russianRoulette'
import { pickWithoutRepeat } from './pickHelpers'

/** Roulette russe (18+). Chacun son tour appuie sur la détente. La position de la balle est tirée
 * ICI et cachée dans `secrets` (supprimé avant d'atteindre les clients — impossible de tricher ou
 * d'anticiper). Les chances de BANG montent à chaque clic ; au coup fatal, gage hardcore ou cul
 * sec, puis on recharge un barillet neuf. Rythmé par les joueurs (clic = tour suivant auto) et par
 * l'hôte (relance après un BANG). */

const NERVE_XP = 1
const GAGE_XP = 5
const SURVIVOR_XP = 15

export interface LastPull {
  pullerId: string
  bang: boolean
  /** Index de la chambre tirée (0-based), pour l'affichage. */
  chamber: number
  /** Probabilité de BANG au moment du tir (1 / chambres restantes), pour la tension à l'écran. */
  oddsDenom: number
  gageText: string | null
  /** null tant que le perdant n'a pas tranché ; true = relevé, false = refusé (cul sec). */
  gageDone: boolean | null
}

interface RussianRouletteState {
  order: string[]
  currentIndex: number
  /** Nombre de détentes déjà pressées sur le barillet courant = index de la prochaine chambre. */
  chamber: number
  /** Position de la balle (0..CHAMBER_COUNT-1), masquée à tous les clients via la convention secrets. */
  secrets: { bulletPos: number }
  lastPull: LastPull | null
  totalSips: Record<string, number>
  bangs: Record<string, number>
  survivedPulls: Record<string, number>
  pullsDone: number
  barrelsUsed: number
  /** Gages déjà tirés cette partie — anti-répétition (voir pickWithoutRepeat). */
  usedGages: string[]
}

function freshBarrel(): { bulletPos: number } {
  return { bulletPos: Math.floor(Math.random() * CHAMBER_COUNT) }
}

function getState(session: PartySession): RussianRouletteState {
  return (
    (session.roundData as RussianRouletteState | null) ?? {
      order: [],
      currentIndex: 0,
      chamber: 0,
      secrets: freshBarrel(),
      lastPull: null,
      totalSips: {},
      bangs: {},
      survivedPulls: {},
      pullsDone: 0,
      barrelsUsed: 1,
      usedGages: [],
    }
  )
}

function add(totals: Record<string, number>, memberId: string, amount: number): Record<string, number> {
  if (amount <= 0) return totals
  return { ...totals, [memberId]: (totals[memberId] ?? 0) + amount }
}

export const russianRoulette: GameModule = {
  id: 'russian-roulette',
  name: 'Roulette russe',
  icon: '🔫',
  minPlayers: 2,

  initRound(_group, session) {
    const state = getState(session)

    // 1) Tout premier appel : barillet chargé, ordre de passage figé.
    if (session.round === 0 && session.phase === null) {
      const newState: RussianRouletteState = {
        order: [...session.participantIds],
        currentIndex: 0,
        chamber: 0,
        secrets: freshBarrel(),
        lastPull: null,
        totalSips: {},
        bangs: {},
        survivedPulls: {},
        pullsDone: 0,
        barrelsUsed: 1,
        usedGages: [],
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    // 2) Fin des règles -> premier tour.
    if (session.phase === 'intro') {
      return { session: { ...session, phase: 'turn', round: 1, roundData: { ...state, lastPull: null } } }
    }

    // 3) Pendant un tour, l'avance de l'hôte SAUTE le joueur (AFK).
    if (session.phase === 'turn') {
      const next = (state.currentIndex + 1) % state.order.length
      return {
        session: { ...session, round: session.round + 1, roundData: { ...state, currentIndex: next, lastPull: null } },
      }
    }

    // 4) Après un BANG (phase result), l'hôte relance : barillet neuf, joueur suivant.
    if (session.phase === 'result') {
      const next = (state.currentIndex + 1) % state.order.length
      return {
        session: {
          ...session,
          phase: 'turn',
          round: session.round + 1,
          roundData: { ...state, currentIndex: next, chamber: 0, secrets: freshBarrel(), lastPull: null, barrelsUsed: state.barrelsUsed + 1 },
        },
      }
    }

    return { session }
  },

  handleAction(_group, session, memberId, action: GameAction) {
    const state = getState(session)

    // Le joueur dont c'est le tour presse la détente.
    if (action.type === 'pull' && session.phase === 'turn') {
      if (state.order[state.currentIndex] !== memberId) return { session }

      const bang = state.chamber === state.secrets.bulletPos
      const oddsDenom = Math.max(1, CHAMBER_COUNT - state.chamber)
      const pullsDone = state.pullsDone + 1
      const survivedPulls = bang ? state.survivedPulls : add(state.survivedPulls, memberId, 1)

      if (!bang) {
        // Clic : petit shot de tension, puis tour suivant automatiquement.
        const next = (state.currentIndex + 1) % state.order.length
        const lastPull: LastPull = { pullerId: memberId, bang: false, chamber: state.chamber, oddsDenom, gageText: null, gageDone: null }
        return {
          session: {
            ...session,
            round: session.round + 1,
            roundData: {
              ...state,
              chamber: state.chamber + 1,
              currentIndex: next,
              lastPull,
              totalSips: add(state.totalSips, memberId, CLICK_SIPS),
              survivedPulls,
              pullsDone,
            },
          },
          xpAwards: [
            { memberId, amount: NERVE_XP, statIncrements: { 'russianRoulette.pullsSurvived': 1 }, reason: 'A survécu à un tour de roulette russe' },
          ],
        }
      }

      // BANG : gage hardcore, on fige sur la phase result le temps que le perdant tranche.
      const gageText = pickWithoutRepeat(RUSSIAN_ROULETTE_GAGES, state.usedGages)
      const lastPull: LastPull = { pullerId: memberId, bang: true, chamber: state.chamber, oddsDenom, gageText, gageDone: null }
      return {
        session: {
          ...session,
          phase: 'result',
          roundData: { ...state, lastPull, bangs: add(state.bangs, memberId, 1), pullsDone, usedGages: [...state.usedGages, gageText] },
        },
      }
    }

    // Verdict du gage après un BANG : relevé (XP) ou refusé (cul sec).
    if (action.type === 'gageResult' && session.phase === 'result') {
      const lp = state.lastPull
      if (!lp || !lp.bang || lp.pullerId !== memberId || lp.gageDone !== null) return { session }
      const payload = action.payload as { done?: boolean } | null
      const done = !!payload?.done

      const totals = done ? state.totalSips : add(state.totalSips, memberId, BANG_CULSEC_SIPS)
      const xpAwards: XpAward[] = done
        ? [{ memberId, amount: GAGE_XP, statIncrements: { 'russianRoulette.gagesDone': 1 }, reason: 'A relevé un gage de roulette russe' }]
        : []
      return {
        session: { ...session, roundData: { ...state, lastPull: { ...lp, gageDone: done }, totalSips: totals } },
        xpAwards,
      }
    }

    // L'hôte clôt la partie -> podium (le moins de gorgées bues survit le mieux).
    if (action.type === 'finish' && (session.phase === 'turn' || session.phase === 'result')) {
      if (session.hostMemberId !== memberId) return { session }
      const entries = state.order.map((id) => ({ id, sips: state.totalSips[id] ?? 0 }))
      const minSips = entries.length > 0 ? Math.min(...entries.map((e) => e.sips)) : 0
      const xpAwards: XpAward[] = entries
        .filter((e) => e.sips === minSips)
        .map((e) => ({
          memberId: e.id,
          amount: SURVIVOR_XP,
          statIncrements: { 'russianRoulette.gamesSurvived': 1 },
          reason: 'A le mieux survécu à la roulette russe',
        }))
      return { session: { ...session, status: 'ended', phase: 'ended' }, xpAwards }
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
