import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import {
  WHEEL_SEGMENTS,
  WHEEL_SEGMENT_COUNT,
  WHEEL_SEGMENT_DEG,
  WHEEL_GAGES,
  CULSEC_SIPS,
  type WheelSegment,
} from '../../src/data/wheelSegments'

/** La Roue Infernale : chacun son tour, un swipe sur le téléphone lance la roue 3D de la TV.
 * Le résultat est tiré ICI (uniforme, impossible à tricher) — la force du swipe ne change que le
 * nombre de tours et la durée de l'animation, que tous les clients rejouent à l'identique. */

const GAGE_REFUSAL_SIPS = 3
const NEIGHBOR_SIPS = 2
const GAGE_XP = 5
const SURVIVOR_XP = 15

export interface SpinOutcome {
  segment: WheelSegment
  /** Gorgées réellement appliquées (après immunités), par joueur. */
  sips: Record<string, number>
  immunityUsedBy: string[]
  gageText: string | null
  /** null = pas un gage / en attente de réponse ; true/false = fait/refusé. */
  gageDone: boolean | null
  giveTotal: number
  giveRemaining: number
  given: Record<string, number>
}

export interface Spin {
  id: number
  spinnerId: string
  targetIndex: number
  fromAngle: number
  totalRotationDeg: number
  durationMs: number
  spunAt: number
  outcome: SpinOutcome
}

interface WheelState {
  segments: WheelSegment[]
  spinnerOrder: string[]
  currentSpinnerIndex: number
  wheelAngle: number
  spin: Spin | null
  immunities: Record<string, boolean>
  totalSips: Record<string, number>
  spinsDone: number
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Calcule la rotation à animer pour atterrir sur `targetIndex`. La force (0..1, issue de la
 * vitesse du swipe) module le nombre de tours complets et la durée — jamais le résultat. */
export function computeSpin(
  previousAngle: number,
  force: number,
  targetIndex: number,
  jitter01: number,
): { totalRotationDeg: number; durationMs: number } {
  const f = Math.min(1, Math.max(0.15, force))
  const fullTurns = 3 + Math.round(f * 4) // 3..7 tours
  // On vise l'intérieur du segment, jamais pile une frontière.
  const jitter = 4 + jitter01 * (WHEEL_SEGMENT_DEG - 8)
  const finalMod = (((360 - (targetIndex * WHEEL_SEGMENT_DEG + jitter)) % 360) + 360) % 360
  const prevMod = ((previousAngle % 360) + 360) % 360
  const delta = (finalMod - prevMod + 360) % 360
  return { totalRotationDeg: fullTurns * 360 + delta, durationMs: Math.round(3200 + f * 2600) }
}

/** Segment sous le pointeur (en haut) pour un angle de roue donné — la roue tourne dans le sens
 * horaire, segment 0 dessiné à partir du haut. Doit rester le miroir exact du rendu client. */
export function segmentUnderPointer(angle: number): number {
  return Math.floor(((((360 - (angle % 360)) % 360) + 360) % 360) / WHEEL_SEGMENT_DEG)
}

function getState(session: PartySession): WheelState {
  return (
    (session.roundData as WheelState | null) ?? {
      segments: WHEEL_SEGMENTS,
      spinnerOrder: [],
      currentSpinnerIndex: 0,
      wheelAngle: 0,
      spin: null,
      immunities: {},
      totalSips: {},
      spinsDone: 0,
    }
  )
}

function add(totals: Record<string, number>, memberId: string, amount: number): Record<string, number> {
  if (amount <= 0) return totals
  return { ...totals, [memberId]: (totals[memberId] ?? 0) + amount }
}

/** Applique `sips` gorgées imposées par la roue à un joueur, en consommant une immunité si
 * disponible. Mute les accumulateurs passés en paramètre (copies locales du handler). */
function applyWheelSips(
  memberId: string,
  sips: number,
  acc: { totals: Record<string, number>; immunities: Record<string, boolean>; outcomeSips: Record<string, number>; immunityUsedBy: string[] },
): void {
  if (acc.immunities[memberId]) {
    acc.immunities = { ...acc.immunities, [memberId]: false }
    delete acc.immunities[memberId]
    acc.immunityUsedBy.push(memberId)
    acc.outcomeSips[memberId] = 0
    return
  }
  acc.outcomeSips[memberId] = sips
  acc.totals = add(acc.totals, memberId, sips)
}

export const wheel: GameModule = {
  id: 'wheel',
  name: 'Roue Infernale',
  icon: '🎡',
  minPlayers: 2,

  initRound(_group, session) {
    const state = getState(session)

    // 1) Tout premier appel : construire la roue (ordre des segments mélangé à chaque partie).
    if (session.round === 0 && session.phase === null) {
      const newState: WheelState = {
        segments: shuffle(WHEEL_SEGMENTS),
        spinnerOrder: [...session.participantIds],
        currentSpinnerIndex: 0,
        wheelAngle: Math.floor(Math.random() * 360),
        spin: null,
        immunities: {},
        totalSips: {},
        spinsDone: 0,
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    // 2) Fin des règles -> premier tour.
    if (session.phase === 'intro') {
      return { session: { ...session, phase: 'turn', round: 1, roundData: state } }
    }

    // 3) Pendant un tour, l'avance de l'hôte SAUTE le lanceur (joueur AFK).
    if (session.phase === 'turn') {
      const next = (state.currentSpinnerIndex + 1) % state.spinnerOrder.length
      return {
        session: { ...session, round: session.round + 1, roundData: { ...state, currentSpinnerIndex: next } },
      }
    }

    // 4) Résultat encaissé -> tour suivant (le même joueur rejoue sur un segment "Rejoue !").
    if (session.phase === 'spinning') {
      const respin = state.spin?.outcome.segment.type === 'respin'
      const next = respin ? state.currentSpinnerIndex : (state.currentSpinnerIndex + 1) % state.spinnerOrder.length
      return {
        session: {
          ...session,
          phase: 'turn',
          round: session.round + 1,
          roundData: { ...state, spin: null, currentSpinnerIndex: next },
        },
      }
    }

    return { session }
  },

  handleAction(group, session, memberId, action: GameAction) {
    const state = getState(session)

    // Le lanceur du tour envoie la force de son swipe -> tout se décide ici.
    if (action.type === 'spin' && session.phase === 'turn') {
      if (state.spinnerOrder[state.currentSpinnerIndex] !== memberId) return { session }
      const payload = action.payload as { force?: number } | null
      const force = typeof payload?.force === 'number' && Number.isFinite(payload.force) ? payload.force : 0.5

      const targetIndex = Math.floor(Math.random() * WHEEL_SEGMENT_COUNT)
      const { totalRotationDeg, durationMs } = computeSpin(state.wheelAngle, force, targetIndex, Math.random())
      const segment = state.segments[targetIndex]

      const acc = {
        totals: state.totalSips,
        immunities: { ...state.immunities },
        outcomeSips: {} as Record<string, number>,
        immunityUsedBy: [] as string[],
      }
      let gageText: string | null = null
      let giveTotal = 0
      const xpAwards: XpAward[] = []

      if (segment.type === 'drink') applyWheelSips(memberId, segment.value ?? 1, acc)
      if (segment.type === 'culsec') applyWheelSips(memberId, CULSEC_SIPS, acc)
      if (segment.type === 'everyone') {
        for (const id of state.spinnerOrder) applyWheelSips(id, 1, acc)
      }
      if (segment.type === 'neighbors') {
        const n = state.spinnerOrder.length
        const i = state.currentSpinnerIndex
        const around = new Set([state.spinnerOrder[(i + 1) % n], state.spinnerOrder[(i - 1 + n) % n]])
        around.delete(memberId)
        for (const id of around) applyWheelSips(id, NEIGHBOR_SIPS, acc)
      }
      if (segment.type === 'gage') gageText = WHEEL_GAGES[Math.floor(Math.random() * WHEEL_GAGES.length)]
      if (segment.type === 'give') giveTotal = segment.value ?? 2
      if (segment.type === 'immunity') acc.immunities[memberId] = true

      const spin: Spin = {
        id: state.spinsDone + 1,
        spinnerId: memberId,
        targetIndex,
        fromAngle: state.wheelAngle,
        totalRotationDeg,
        durationMs,
        spunAt: Date.now(),
        outcome: {
          segment,
          sips: acc.outcomeSips,
          immunityUsedBy: acc.immunityUsedBy,
          gageText,
          gageDone: null,
          giveTotal,
          giveRemaining: giveTotal,
          given: {},
        },
      }

      return {
        session: {
          ...session,
          phase: 'spinning',
          roundData: {
            ...state,
            spin,
            wheelAngle: state.wheelAngle + totalRotationDeg,
            immunities: acc.immunities,
            totalSips: acc.totals,
            spinsDone: state.spinsDone + 1,
          },
        },
        xpAwards,
      }
    }

    // Distribution des gorgées gagnées, une par une (splittables).
    if (action.type === 'giveSip' && session.phase === 'spinning') {
      const spin = state.spin
      if (!spin || spin.spinnerId !== memberId || spin.outcome.giveRemaining <= 0) return { session }
      const payload = action.payload as { targetMemberId?: string } | null
      const targetMemberId = payload?.targetMemberId
      if (!targetMemberId || targetMemberId === memberId) return { session }
      if (!group.members.some((m) => m.id === targetMemberId)) return { session }

      const outcome: SpinOutcome = {
        ...spin.outcome,
        giveRemaining: spin.outcome.giveRemaining - 1,
        given: { ...spin.outcome.given, [targetMemberId]: (spin.outcome.given[targetMemberId] ?? 0) + 1 },
      }
      return {
        session: {
          ...session,
          roundData: { ...state, spin: { ...spin, outcome }, totalSips: add(state.totalSips, targetMemberId, 1) },
        },
      }
    }

    // Verdict du gage : fait (XP) ou refusé (3 gorgées, sans immunité — c'est un choix).
    if (action.type === 'gageResult' && session.phase === 'spinning') {
      const spin = state.spin
      if (!spin || spin.spinnerId !== memberId) return { session }
      if (spin.outcome.segment.type !== 'gage' || spin.outcome.gageDone !== null) return { session }
      const payload = action.payload as { done?: boolean } | null
      const done = !!payload?.done

      const xpAwards: XpAward[] = done
        ? [{ memberId, amount: GAGE_XP, statIncrements: { 'wheel.gagesDone': 1 }, reason: 'A relevé un gage de la Roue Infernale' }]
        : []
      const totals = done ? state.totalSips : add(state.totalSips, memberId, GAGE_REFUSAL_SIPS)
      const outcome: SpinOutcome = {
        ...spin.outcome,
        gageDone: done,
        sips: done ? spin.outcome.sips : { ...spin.outcome.sips, [memberId]: GAGE_REFUSAL_SIPS },
      }
      return {
        session: { ...session, roundData: { ...state, spin: { ...spin, outcome }, totalSips: totals } },
        xpAwards,
      }
    }

    // L'hôte clôt la roue -> podium.
    if (action.type === 'finish' && (session.phase === 'spinning' || session.phase === 'turn')) {
      if (session.hostMemberId !== memberId) return { session }
      const entries = session.participantIds.map((id) => ({ id, sips: state.totalSips[id] ?? 0 }))
      const minSips = entries.length > 0 ? Math.min(...entries.map((e) => e.sips)) : 0
      const xpAwards: XpAward[] = entries
        .filter((e) => e.sips === minSips)
        .map((e) => ({
          memberId: e.id,
          amount: SURVIVOR_XP,
          statIncrements: { 'wheel.gamesWon': 1 },
          reason: 'A le mieux survécu à la Roue Infernale',
        }))
      return { session: { ...session, status: 'ended', phase: 'ended' }, xpAwards }
    }

    return { session }
  },

  // Entièrement rythmé par les joueurs et l'hôte : rien ne se résout tout seul.
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
