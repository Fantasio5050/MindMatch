import { useEffect, useState } from 'react'
import type { PmuRaceEvent } from './types'
import { computePlayback, raceElapsed, type PlaybackState } from './timeline'

/** Rejoue la course côté React à ~12 images/s (les vraies interpolations 60fps se font dans la
 * scène 3D ; ici on ne pilote que le HUD/l'UI, inutile de re-rendre plus vite). */
export function usePmuPlayback(events: PmuRaceEvent[] | null, raceStartedAt: number | null): PlaybackState | null {
  const [playback, setPlayback] = useState<PlaybackState | null>(null)

  useEffect(() => {
    if (!events || events.length === 0 || raceStartedAt === null) {
      setPlayback(null)
      return
    }
    const update = () => setPlayback(computePlayback(events, raceElapsed(raceStartedAt)))
    update()
    const interval = setInterval(update, 85)
    return () => clearInterval(interval)
  }, [events, raceStartedAt])

  return playback
}
