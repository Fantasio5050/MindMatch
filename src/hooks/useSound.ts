import { useCallback, useSyncExternalStore } from 'react'
import { getAudioContext } from '../lib/audioContext'
import { sfxMutedStore } from '../lib/audioPrefs'

type SoundName = 'vote' | 'reveal' | 'win' | 'tick' | 'pop' | 'lose' | 'start' | 'join' | 'emote'

function beep(freq: number, duration: number, delay = 0, type: OscillatorType = 'sine', peak = 0.15): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const start = ctx.currentTime + delay
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

/** A short pitch slide (freq -> freq2) — richer than a flat beep for "movement" sounds. */
function sweep(from: number, to: number, duration: number, delay = 0, type: OscillatorType = 'sine', peak = 0.12): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  const start = ctx.currentTime + delay
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
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
    case 'pop':
      // Soft UI tap — low, short, unobtrusive.
      sweep(300, 480, 0.06, 0, 'triangle', 0.1)
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
    case 'lose':
      // Descending "wah-wah" — you drink.
      sweep(320, 180, 0.22, 0, 'sawtooth', 0.06)
      sweep(240, 130, 0.3, 0.18, 'sawtooth', 0.06)
      break
    case 'start':
      // Rising sweep + confirmation note — a game is launching.
      sweep(220, 880, 0.35, 0, 'triangle', 0.1)
      beep(880, 0.15, 0.32)
      break
    case 'join':
      // Cheerful two-note "someone arrived".
      beep(587, 0.09, 0, 'triangle')
      beep(880, 0.14, 0.09, 'triangle')
      break
    case 'emote':
      // Tiny cute blip for a floating reaction.
      sweep(700, 1100, 0.09, 0, 'triangle', 0.07)
      break
  }
}

export function useSound() {
  const muted = useSyncExternalStore(sfxMutedStore.subscribe, sfxMutedStore.get)

  const play = useCallback((sound: SoundName) => !sfxMutedStore.get() && playSound(sound), [])
  const toggleMuted = useCallback(() => sfxMutedStore.set(!sfxMutedStore.get()), [])

  return { play, muted, toggleMuted }
}
