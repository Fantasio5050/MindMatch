import { WHEEL_SEGMENT_DEG } from '../../../data/wheelSegments'
import type { WheelSpin } from './types'

/** L'horodatage serveur `spunAt` n'est fiable que si l'horloge locale est d'accord avec celle du
 * serveur. Sur un vrai déploiement (TV, box, vieux PC), elle peut dériver de plusieurs secondes —
 * la roue semblait alors figée (déjà "finie") ou démarrait en retard. Si l'écart apparent dépasse
 * la latence réseau plausible, on re-base le départ sur l'horloge LOCALE au moment où le spin
 * arrive : tous les appareils le reçoivent à ~100 ms près, donc la salle reste synchrone. */
const CLOCK_SKEW_TOLERANCE_MS = 1500
const rebasedStarts = new Map<string, number>()

function effectiveSpunAt(spin: WheelSpin): number {
  const key = `${spin.id}-${spin.spunAt}`
  const cached = rebasedStarts.get(key)
  if (cached !== undefined) return cached
  const now = Date.now()
  const start = Math.abs(now - spin.spunAt) > CLOCK_SKEW_TOLERANCE_MS ? now : spin.spunAt
  if (rebasedStarts.size > 30) rebasedStarts.clear()
  rebasedStarts.set(key, start)
  return start
}

/** Angle de la roue à l'instant t — même décélération (ease-out cubique) sur tous les écrans. */
export function wheelAngleAt(spin: WheelSpin, nowMs: number): { angle: number; progress: number; done: boolean } {
  const raw = (nowMs - effectiveSpunAt(spin)) / spin.durationMs
  const progress = Math.min(1, Math.max(0, raw))
  const eased = 1 - Math.pow(1 - progress, 3)
  return { angle: spin.fromAngle + spin.totalRotationDeg * eased, progress, done: raw >= 1 }
}

/** Index du segment sous le pointeur (en haut) — miroir exact de la formule serveur. */
export function segmentUnderPointer(angle: number): number {
  return Math.floor(((((360 - (angle % 360)) % 360) + 360) % 360) / WHEEL_SEGMENT_DEG)
}
