import { useCallback, useSyncExternalStore } from 'react'
import { getAudioContext } from '../lib/audioContext'
import { sfxMutedStore } from '../lib/audioPrefs'

type SoundName = 'vote' | 'reveal' | 'win' | 'tick'

function beep(freq: number, duration: number, delay = 0): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const start = ctx.currentTime + delay
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

function playSound(sound: SoundName): void {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  switch (sound) {
    case 'vote':
      beep(660, 0.08)
      break
    case 'tick':
      beep(440, 0.05)
      break
    case 'reveal':
      beep(523, 0.1)
      beep(659, 0.12, 0.1)
      beep(784, 0.16, 0.2)
      break
    case 'win':
      beep(784, 0.1)
      beep(988, 0.12, 0.1)
      beep(1175, 0.2, 0.2)
      break
  }
}

export function useSound() {
  const muted = useSyncExternalStore(sfxMutedStore.subscribe, sfxMutedStore.get)

  const play = useCallback((sound: SoundName) => !sfxMutedStore.get() && playSound(sound), [])
  const toggleMuted = useCallback(() => sfxMutedStore.set(!sfxMutedStore.get()), [])

  return { play, muted, toggleMuted }
}
