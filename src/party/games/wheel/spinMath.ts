import { WHEEL_SEGMENT_DEG } from '../../../data/wheelSegments'
import type { WheelSpin } from './types'

/** Angle de la roue à l'instant t — même décélération (ease-out cubique) sur tous les écrans,
 * calée sur l'horodatage serveur `spunAt`, donc TV et téléphones sont parfaitement synchrones. */
export function wheelAngleAt(spin: WheelSpin, nowMs: number): { angle: number; progress: number; done: boolean } {
  const raw = (nowMs - spin.spunAt) / spin.durationMs
  const progress = Math.min(1, Math.max(0, raw))
  const eased = 1 - Math.pow(1 - progress, 3)
  return { angle: spin.fromAngle + spin.totalRotationDeg * eased, progress, done: raw >= 1 }
}

/** Index du segment sous le pointeur (en haut) — miroir exact de la formule serveur. */
export function segmentUnderPointer(angle: number): number {
  return Math.floor(((((360 - (angle % 360)) % 360) + 360) % 360) / WHEEL_SEGMENT_DEG)
}
