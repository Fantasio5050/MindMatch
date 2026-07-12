import { getAudioContext } from './audioContext'

/** A tasteful, purely-generative ambient loop (no audio files, no licensing to worry about) —
 * four sustained pad chords with a soft pulsing bass note, in A minor. Built the same way as the
 * SFX beeps in useSound.ts: raw oscillators + gain envelopes, nothing external to load. */

interface Chord {
  pad: number[] // Hz, played together as a soft sustained pad
  bass: number // Hz, one octave down from the root
}

const CHORDS: Chord[] = [
  { pad: [220.0, 261.63, 329.63], bass: 110.0 }, // A minor
  { pad: [174.61, 220.0, 261.63], bass: 87.31 }, // F major
  { pad: [261.63, 329.63, 392.0], bass: 130.81 }, // C major
  { pad: [196.0, 246.94, 293.66], bass: 98.0 }, // G major
]

const CHORD_DURATION = 3.2
const LOOP_DURATION = CHORDS.length * CHORD_DURATION
const LOOKAHEAD_MS = 300

let masterGain: GainNode | null = null
let filter: BiquadFilterNode | null = null
let loopTimer: ReturnType<typeof setTimeout> | null = null
let nextLoopStart = 0
let targetVolume = 0.45

function ensureGraph(): { ctx: AudioContext; gain: GainNode; filter: BiquadFilterNode } | null {
  const ctx = getAudioContext()
  if (!ctx) return null
  if (!masterGain || !filter) {
    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1400
    masterGain = ctx.createGain()
    masterGain.gain.value = targetVolume * 0.35
    filter.connect(masterGain)
    masterGain.connect(ctx.destination)
  }
  return { ctx, gain: masterGain, filter }
}

function schedulePad(ctx: AudioContext, destination: AudioNode, freq: number, start: number, duration: number): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = freq
  const attack = 0.7
  const release = 0.6
  const peak = 0.16
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peak, start + attack)
  gain.gain.setValueAtTime(peak, start + duration - release)
  gain.gain.linearRampToValueAtTime(0, start + duration)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

function scheduleBass(ctx: AudioContext, destination: AudioNode, freq: number, start: number): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.3, start + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.6)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(start)
  osc.stop(start + 1.7)
}

function scheduleLoopIteration(startAt: number): void {
  const graph = ensureGraph()
  if (!graph) return
  const { ctx, filter: dest } = graph

  CHORDS.forEach((chord, i) => {
    const chordStart = startAt + i * CHORD_DURATION
    for (const freq of chord.pad) schedulePad(ctx, dest, freq, chordStart, CHORD_DURATION)
    scheduleBass(ctx, dest, chord.bass, chordStart)
    scheduleBass(ctx, dest, chord.bass, chordStart + CHORD_DURATION / 2)
  })
}

function tick(): void {
  const graph = ensureGraph()
  if (!graph) return
  const { ctx } = graph
  while (nextLoopStart < ctx.currentTime + LOOKAHEAD_MS / 1000) {
    scheduleLoopIteration(nextLoopStart)
    nextLoopStart += LOOP_DURATION
  }
  loopTimer = setTimeout(tick, LOOKAHEAD_MS)
}

export function startMusic(volume: number): void {
  const graph = ensureGraph()
  if (!graph || loopTimer) return
  targetVolume = volume
  const now = graph.ctx.currentTime
  graph.gain.gain.cancelScheduledValues(now)
  graph.gain.gain.setValueAtTime(0, now)
  graph.gain.gain.linearRampToValueAtTime(targetVolume * 0.35, now + 1.2)
  nextLoopStart = now + 0.1
  tick()
}

export function stopMusic(): void {
  if (loopTimer) {
    clearTimeout(loopTimer)
    loopTimer = null
  }
  if (masterGain) {
    const ctx = getAudioContext()
    if (ctx) {
      const now = ctx.currentTime
      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setValueAtTime(masterGain.gain.value, now)
      masterGain.gain.linearRampToValueAtTime(0, now + 0.4)
    }
  }
}

export function isMusicPlaying(): boolean {
  return loopTimer !== null
}

export function setMusicVolume(volume: number): void {
  targetVolume = volume
  if (masterGain) {
    const ctx = getAudioContext()
    const now = ctx?.currentTime ?? 0
    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.linearRampToValueAtTime(targetVolume * 0.35, now + 0.2)
  }
}
