import type { PmuRaceEvent } from './types'

/** Rejoue le journal d'événements de course à partir du temps écoulé depuis `raceStartedAt`.
 * Téléphones (barres 2D) et TV (scène 3D) utilisent exactement la même horloge, donc tous les
 * écrans de la pièce voient la même chose au même moment, sans aucun trafic réseau en plus. */

export const COUNTDOWN_MS = 3200 // "3, 2, 1, Partez !" avant le premier tirage
const DRAW_MS = 1150
const SETBACK_MS = 1700
const FINISH_MS = 2600

export function eventDuration(event: PmuRaceEvent): number {
  if (event.type === 'draw') return DRAW_MS
  if (event.type === 'setback') return SETBACK_MS
  return FINISH_MS
}

export interface PlaybackState {
  /** Encore dans le compte à rebours de départ. */
  countdown: boolean
  countdownSeconds: number
  /** Positions "en dur" une fois tous les événements passés appliqués (0..TRACK_LEN). */
  positions: number[]
  /** L'événement en cours d'animation, s'il y en a un. */
  current: PmuRaceEvent | null
  /** Avancement 0..1 dans l'événement en cours. */
  progress: number
  /** Index de l'événement courant (pour les clés d'animation UI). */
  index: number
  done: boolean
}

export function computePlayback(events: PmuRaceEvent[], elapsedMs: number): PlaybackState {
  const positions = [0, 0, 0, 0]

  if (elapsedMs < COUNTDOWN_MS) {
    return {
      countdown: true,
      countdownSeconds: Math.ceil((COUNTDOWN_MS - elapsedMs) / 1000),
      positions,
      current: null,
      progress: 0,
      index: -1,
      done: false,
    }
  }

  let t = elapsedMs - COUNTDOWN_MS
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const duration = eventDuration(event)
    if (t < duration) {
      return { countdown: false, countdownSeconds: 0, positions, current: event, progress: t / duration, index: i, done: false }
    }
    if (event.type !== 'finish') positions[event.suit] = event.newPosition
    t -= duration
  }

  return { countdown: false, countdownSeconds: 0, positions, current: null, progress: 1, index: events.length, done: true }
}

/** Position visuelle interpolée d'un cheval (avec easing) pendant l'événement en cours. */
export function horseVisualPosition(playback: PlaybackState, suit: number): number {
  const base = playback.positions[suit]
  const { current, progress } = playback
  if (!current || current.type === 'finish' || current.suit !== suit) return base
  const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
  return base + (current.newPosition - base) * eased
}
