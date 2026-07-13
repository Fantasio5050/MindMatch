import type { WheelSegment } from '../../../data/wheelSegments'

export interface WheelSpinOutcome {
  segment: WheelSegment
  sips: Record<string, number>
  immunityUsedBy: string[]
  gageText: string | null
  gageDone: boolean | null
  giveTotal: number
  giveRemaining: number
  given: Record<string, number>
}

export interface WheelSpin {
  id: number
  spinnerId: string
  targetIndex: number
  fromAngle: number
  totalRotationDeg: number
  durationMs: number
  spunAt: number
  outcome: WheelSpinOutcome
}

export interface WheelClientState {
  segments: WheelSegment[]
  spinnerOrder: string[]
  currentSpinnerIndex: number
  wheelAngle: number
  spin: WheelSpin | null
  immunities: Record<string, boolean>
  totalSips: Record<string, number>
  spinsDone: number
}
