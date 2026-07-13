import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../../hooks/useSound'
import { wheelAngleAt, segmentUnderPointer } from './spinMath'
import type { WheelSpin } from './types'

export interface WheelPlayback {
  angle: number
  progress: number
  done: boolean
  segmentIndex: number
}

/** Anime le spin en cours (~30 fps pour l'UI React ; la 3D interpole en 60 fps de son côté) et
 * joue le "tic" du cliquet chaque fois qu'une frontière de segment passe sous le pointeur. */
export function useWheelSpin(spin: WheelSpin | null, restAngle: number): WheelPlayback {
  const { play } = useSound()
  const [state, setState] = useState<WheelPlayback>(() => ({
    angle: restAngle,
    progress: 1,
    done: true,
    segmentIndex: segmentUnderPointer(restAngle),
  }))
  const lastSegment = useRef(-1)

  useEffect(() => {
    if (!spin) {
      setState({ angle: restAngle, progress: 1, done: true, segmentIndex: segmentUnderPointer(restAngle) })
      return
    }
    lastSegment.current = segmentUnderPointer(spin.fromAngle)
    const interval = setInterval(() => {
      const { angle, progress, done } = wheelAngleAt(spin, Date.now())
      const segmentIndex = segmentUnderPointer(angle)
      if (segmentIndex !== lastSegment.current) {
        lastSegment.current = segmentIndex
        play('tick')
      }
      setState({ angle, progress, done, segmentIndex })
      if (done) clearInterval(interval)
    }, 33)
    return () => clearInterval(interval)
  }, [spin, restAngle, play])

  return state
}
