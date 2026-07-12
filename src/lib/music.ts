/** Background music player built on real audio files (public/audio/*.mp3), one per ambiance:
 * "menu" for home/lobby/menus and "game" during an active party game. Tracks loop forever and
 * switching ambiance crossfades between two <audio> elements instead of hard-cutting. */

export type MusicTrack = 'menu' | 'game'

const TRACK_SRC: Record<MusicTrack, string> = {
  menu: '/audio/menu.mp3',
  game: '/audio/ingame.mp3',
}

const FADE_MS = 900
const FADE_STEP_MS = 50

const elements: Partial<Record<MusicTrack, HTMLAudioElement>> = {}
const fadeTimers: Partial<Record<MusicTrack, ReturnType<typeof setInterval>>> = {}

let currentTrack: MusicTrack = 'menu'
let playing = false
let targetVolume = 0.45

function getElement(track: MusicTrack): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  let el = elements[track]
  if (!el) {
    el = new Audio(TRACK_SRC[track])
    el.loop = true
    el.preload = 'auto'
    el.volume = 0
    elements[track] = el
  }
  return el
}

/** Ramps one element's volume to `to`, pausing it at the end of a fade-out. Replaces any fade
 * already running on that element so rapid track flips don't fight each other. */
function fadeTo(track: MusicTrack, to: number): void {
  const el = elements[track]
  if (!el) return
  const existing = fadeTimers[track]
  if (existing) clearInterval(existing)

  const from = el.volume
  const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS))
  let step = 0
  fadeTimers[track] = setInterval(() => {
    step++
    el.volume = Math.min(1, Math.max(0, from + (to - from) * (step / steps)))
    if (step >= steps) {
      clearInterval(fadeTimers[track])
      delete fadeTimers[track]
      if (to === 0) el.pause()
    }
  }, FADE_STEP_MS)
}

function playCurrent(): void {
  const el = getElement(currentTrack)
  if (!el) return
  // play() can reject (autoplay policy, file missing) — music is decorative, never crash for it.
  el.play().catch(() => {})
  fadeTo(currentTrack, targetVolume)
}

export function startMusic(volume: number): void {
  targetVolume = Math.min(1, Math.max(0, volume))
  if (playing) return
  playing = true
  playCurrent()
}

export function stopMusic(): void {
  playing = false
  for (const track of Object.keys(elements) as MusicTrack[]) fadeTo(track, 0)
}

export function isMusicPlaying(): boolean {
  return playing
}

export function setMusicVolume(volume: number): void {
  targetVolume = Math.min(1, Math.max(0, volume))
  if (!playing) return
  const el = elements[currentTrack]
  // Only adjust if no fade is in flight — an active fade already targets the right destination
  // via playCurrent/fadeTo, and volume-slider drags shouldn't restart a long ramp each tick.
  if (el && !fadeTimers[currentTrack]) el.volume = targetVolume
  else if (el) fadeTo(currentTrack, targetVolume)
}

/** Switches ambiance (menu ↔ in-game). If music is playing, crossfades; otherwise just records
 * the choice so the next startMusic() picks the right file. */
export function setMusicTrack(track: MusicTrack): void {
  if (track === currentTrack) return
  const previous = currentTrack
  currentTrack = track
  if (!playing) return
  fadeTo(previous, 0)
  playCurrent()
}
