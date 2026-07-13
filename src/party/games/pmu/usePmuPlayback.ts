import { useEffect, useState } from 'react'
import type { PmuRaceEvent } from './types'
import { computePlayback, raceElapsed, type PlaybackState } from './timeline'

/** Suit la lecture de la course pour l'UI React. Le poll interne est fréquent (85 ms) mais un
 * re-render n'est déclenché QUE quand quelque chose de visible change (nouvel événement, seconde
 * du compte à rebours, fin) — l'ancienne version re-rendait tout l'arbre 12×/s pendant toute la
 * course, ce qui chauffait les téléphones. Les interpolations 60 fps vivent dans la scène 3D. */
export function usePmuPlayback(events: PmuRaceEvent[] | null, raceStartedAt: number | null): PlaybackState | null {
  const [playback, setPlayback] = useState<PlaybackState | null>(null)

  useEffect(() => {
    if (!events || events.length === 0 || raceStartedAt === null) {
      setPlayback(null)
      return
    }
    const update = () => {
      const next = computePlayback(events, raceElapsed(raceStartedAt))
      setPlayback((prev) =>
        prev && prev.index === next.index && prev.done === next.done && prev.countdownSeconds === next.countdownSeconds
          ? prev
          : next,
      )
    }
    update()
    const interval = setInterval(update, 85)
    return () => clearInterval(interval)
  }, [events, raceStartedAt])

  return playback
}
