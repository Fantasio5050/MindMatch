import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../../hooks/useSound'
import { wheelAngleAt, segmentUnderPointer } from './spinMath'
import type { WheelSpin } from './types'

export interface WheelSpinStatus {
  done: boolean
  segmentIndex: number
}

/** Suit l'état DISCRET du spin pour l'UI React (fini ? segment sous le pointeur ?) et joue le
 * "tic" du cliquet à chaque frontière. Un re-render n'est déclenché que quand l'une de ces deux
 * valeurs change (quelques fois par seconde) — la rotation continue, elle, est animée par la
 * scène 3D (TV) et par WheelSVG (téléphones) directement en rAF, sans passer par React. */
export function useWheelSpin(spin: WheelSpin | null, restAngle: number): WheelSpinStatus {
  const { play } = useSound()
  const [status, setStatus] = useState<WheelSpinStatus>(() => ({
    done: true,
    segmentIndex: segmentUnderPointer(restAngle),
  }))
  const lastSegment = useRef(-1)

  useEffect(() => {
    if (!spin) {
      const segmentIndex = segmentUnderPointer(restAngle)
      setStatus((prev) => (prev.done && prev.segmentIndex === segmentIndex ? prev : { done: true, segmentIndex }))
      return
    }
    lastSegment.current = segmentUnderPointer(spin.fromAngle)
    const interval = setInterval(() => {
      const { angle, done } = wheelAngleAt(spin, Date.now())
      const segmentIndex = segmentUnderPointer(angle)
      if (segmentIndex !== lastSegment.current) {
        lastSegment.current = segmentIndex
        play('tick')
      }
      setStatus((prev) => (prev.done === done && prev.segmentIndex === segmentIndex ? prev : { done, segmentIndex }))
      if (done) clearInterval(interval)
    }, 50)
    return () => clearInterval(interval)
  }, [spin, restAngle, play])

  return status
}
