import { useCallback, useRef, useSyncExternalStore } from 'react'
import { resumeAudioContext } from '../lib/audioContext'
import { startMusic, stopMusic, setMusicVolume } from '../lib/music'
import { musicMutedStore, musicVolumeStore } from '../lib/audioPrefs'

export function useMusic() {
  const muted = useSyncExternalStore(musicMutedStore.subscribe, musicMutedStore.get)
  const volume = useSyncExternalStore(musicVolumeStore.subscribe, musicVolumeStore.get)
  const startedRef = useRef(false)

  /** Browsers block audio until a user gesture — call this from any click/touch handler. Safe to
   * call repeatedly; only actually starts playback once (and only if not muted). */
  const requestStart = useCallback(() => {
    resumeAudioContext()
    if (startedRef.current) return
    startedRef.current = true
    if (!musicMutedStore.get()) startMusic(musicVolumeStore.get())
  }, [])

  const setMuted = useCallback((next: boolean) => {
    musicMutedStore.set(next)
    if (next) stopMusic()
    else if (startedRef.current) startMusic(musicVolumeStore.get())
  }, [])

  const toggleMuted = useCallback(() => setMuted(!musicMutedStore.get()), [setMuted])

  const setVolume = useCallback((next: number) => {
    musicVolumeStore.set(next)
    setMusicVolume(next)
  }, [])

  return { muted, toggleMuted, setMuted, volume, setVolume, requestStart }
}
