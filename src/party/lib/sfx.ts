import { getAudioContext } from '../../lib/audioContext'
import { sfxMutedStore } from '../../lib/audioPrefs'

/**
 * Bruitages des scènes 3D de la TV, synthétisés à la volée (aucun fichier à télécharger).
 *
 * Les bips de `useSound` suffisent à une interface ; une scène physique a besoin de MATIÈRE : un dé
 * qui claque sur le bois n'a pas le son d'un dé qui s'écrase dans la feutrine, des pièces tintent,
 * un verre fait glouglou. Tout part de deux briques — un souffle de bruit blanc filtré (impacts,
 * frottements) et une note glissée (résonances, carillons) — passées par un compresseur commun
 * pour qu'une rafale d'impacts ne sature pas.
 *
 * Réservé à la scène : les téléphones n'importent jamais ce module.
 */

let noiseBuffer: AudioBuffer | null = null
let bus: GainNode | null = null

function context(): AudioContext | null {
  if (sfxMutedStore.get()) return null
  const ctx = getAudioContext()
  if (!ctx) return null
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function output(ctx: AudioContext): GainNode {
  if (!bus || bus.context !== ctx) {
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 6
    bus = ctx.createGain()
    bus.gain.value = 0.85
    bus.connect(comp)
    comp.connect(ctx.destination)
  }
  return bus
}

function noise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

interface BurstOptions {
  at: number
  dur: number
  freq: number
  q?: number
  gain: number
  filter?: BiquadFilterType
  /** Fréquence d'arrivée du filtre (balayage). */
  freqTo?: number
  attack?: number
}

function burst(ctx: AudioContext, o: BurstOptions) {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  const f = ctx.createBiquadFilter()
  f.type = o.filter ?? 'bandpass'
  f.frequency.setValueAtTime(o.freq, o.at)
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, o.at + o.dur)
  f.Q.value = o.q ?? 1
  const g = ctx.createGain()
  const attack = o.attack ?? 0.002
  g.gain.setValueAtTime(0.0001, o.at)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), o.at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur)
  // En boucle : un souffle plus long que la seconde de bruit (fanfare, tambour) ne s'arrête pas net,
  // et le point de départ aléatoire évite d'entendre deux fois le même grain.
  src.loop = true
  src.connect(f).connect(g).connect(output(ctx))
  src.start(o.at, Math.random() * 0.8)
  src.stop(o.at + o.dur + 0.05)
}

interface ToneOptions {
  at: number
  dur: number
  freq: number
  freqTo?: number
  gain: number
  type?: OscillatorType
  attack?: number
}

function tone(ctx: AudioContext, o: ToneOptions) {
  const osc = ctx.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, o.at)
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo, o.at + o.dur)
  const g = ctx.createGain()
  const attack = o.attack ?? 0.004
  g.gain.setValueAtTime(0.0001, o.at)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), o.at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur)
  osc.connect(g).connect(output(ctx))
  osc.start(o.at)
  osc.stop(o.at + o.dur + 0.05)
}

const jitter = (v: number, amount = 0.12) => v * (1 + (Math.random() * 2 - 1) * amount)

export type Surface = 'wood' | 'felt' | 'board'

export const sfx = {
  /** Un dé, un pion ou une carte heurte une surface. `strength` de 0 à 1. */
  clack(strength: number, surface: Surface = 'wood', delay = 0) {
    const ctx = context()
    if (!ctx) return
    const s = Math.max(0.05, Math.min(1, strength))
    const at = ctx.currentTime + delay
    if (surface === 'felt') {
      burst(ctx, { at, dur: 0.07 + s * 0.05, freq: jitter(650), q: 0.9, gain: 0.55 * s, filter: 'lowpass' })
      tone(ctx, { at, dur: 0.06, freq: jitter(190), freqTo: 110, gain: 0.22 * s })
    } else if (surface === 'board') {
      burst(ctx, { at, dur: 0.05 + s * 0.04, freq: jitter(1700), q: 1.4, gain: 0.5 * s })
      tone(ctx, { at, dur: 0.05, freq: jitter(520), freqTo: 380, gain: 0.16 * s, type: 'triangle' })
    } else {
      burst(ctx, { at, dur: 0.045 + s * 0.04, freq: jitter(2900), q: 2.6, gain: 0.75 * s })
      tone(ctx, { at, dur: 0.07, freq: jitter(1250, 0.2), freqTo: 900, gain: 0.14 * s, type: 'triangle' })
    }
  },

  /** Les dés secoués dans la main avant le lancer. */
  rattle(duration = 0.55, delay = 0) {
    const ctx = context()
    if (!ctx) return
    const hits = Math.round(duration * 22)
    for (let i = 0; i < hits; i++) {
      const at = ctx.currentTime + delay + (i / hits) * duration + Math.random() * 0.02
      burst(ctx, { at, dur: 0.03, freq: jitter(3300, 0.2), q: 3, gain: 0.18 + Math.random() * 0.2 })
    }
  },

  /** Un objet qui fend l'air. */
  whoosh(delay = 0, duration = 0.32) {
    const ctx = context()
    if (!ctx) return
    const at = ctx.currentTime + delay
    burst(ctx, { at, dur: duration, freq: 380, freqTo: 2600, q: 1.1, gain: 0.32, attack: duration * 0.55 })
  },

  /** Choc sourd (un pion qui tombe, une porte de prison). */
  thud(delay = 0, strength = 1) {
    const ctx = context()
    if (!ctx) return
    const at = ctx.currentTime + delay
    tone(ctx, { at, dur: 0.28, freq: 130, freqTo: 52, gain: 0.5 * strength })
    burst(ctx, { at, dur: 0.12, freq: 320, gain: 0.35 * strength, filter: 'lowpass' })
  },

  /** Petit carillon clair (gain, bonne nouvelle). */
  chime(delay = 0) {
    const ctx = context()
    if (!ctx) return
    const at = ctx.currentTime + delay
    tone(ctx, { at, dur: 0.9, freq: 1046.5, gain: 0.16 })
    tone(ctx, { at: at + 0.09, dur: 1.1, freq: 1568, gain: 0.12 })
    tone(ctx, { at: at + 0.09, dur: 0.5, freq: 3136, gain: 0.03 })
  },

  /** Fanfare de victoire. */
  fanfare(delay = 0) {
    const ctx = context()
    if (!ctx) return
    const at = ctx.currentTime + delay
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => tone(ctx, { at: at + i * 0.11, dur: 0.22, freq: f, gain: 0.16, type: 'triangle' }))
    for (const f of [523.25, 659.25, 783.99, 1046.5]) tone(ctx, { at: at + 0.46, dur: 1.1, freq: f, gain: 0.08, type: 'triangle', attack: 0.02 })
    burst(ctx, { at: at + 0.46, dur: 0.9, freq: 7000, q: 0.6, gain: 0.05, filter: 'highpass' })
  },

  /** Glouglou : `count` gorgées avalées, une par une. */
  gulp(count = 1, delay = 0, spacing = 0.3) {
    const ctx = context()
    if (!ctx) return
    for (let i = 0; i < count; i++) {
      const at = ctx.currentTime + delay + i * spacing
      tone(ctx, { at, dur: 0.11, freq: jitter(260, 0.08), freqTo: jitter(520, 0.08), gain: 0.28 })
      tone(ctx, { at: at + 0.05, dur: 0.09, freq: jitter(180, 0.08), freqTo: 120, gain: 0.18 })
      burst(ctx, { at, dur: 0.06, freq: 900, gain: 0.07, filter: 'lowpass' })
    }
  },

  /** Pièces qui tintent. */
  coins(delay = 0, count = 7) {
    const ctx = context()
    if (!ctx) return
    for (let i = 0; i < count; i++) {
      const at = ctx.currentTime + delay + i * 0.045 + Math.random() * 0.03
      const f = 2200 + Math.random() * 2600
      tone(ctx, { at, dur: 0.18 + Math.random() * 0.2, freq: f, gain: 0.07, type: 'triangle' })
      tone(ctx, { at, dur: 0.12, freq: f * 1.5, gain: 0.03 })
    }
  },

  /** Caisse enregistreuse : « ka-ching ». */
  cash(delay = 0) {
    const ctx = context()
    if (!ctx) return
    const at = ctx.currentTime + delay
    burst(ctx, { at, dur: 0.05, freq: 2400, q: 2, gain: 0.4 })
    burst(ctx, { at: at + 0.07, dur: 0.06, freq: 1800, q: 2, gain: 0.3 })
    tone(ctx, { at: at + 0.14, dur: 0.7, freq: 2637, gain: 0.13 })
    tone(ctx, { at: at + 0.14, dur: 0.8, freq: 3520, gain: 0.08 })
    sfx.coins(delay + 0.18, 5)
  },

  /** Un pas de pion d'une case à la suivante. */
  step(delay = 0, pitch = 1) {
    const ctx = context()
    if (!ctx) return
    const at = ctx.currentTime + delay
    tone(ctx, { at, dur: 0.07, freq: 640 * pitch, freqTo: 520 * pitch, gain: 0.12, type: 'triangle' })
    burst(ctx, { at, dur: 0.035, freq: 2000, q: 2, gain: 0.1 })
  },

  /** Mauvaise nouvelle (prison, taxe). */
  buzzer(delay = 0) {
    const ctx = context()
    if (!ctx) return
    const at = ctx.currentTime + delay
    tone(ctx, { at, dur: 0.45, freq: 146, freqTo: 98, gain: 0.12, type: 'sawtooth' })
    tone(ctx, { at, dur: 0.45, freq: 155, freqTo: 104, gain: 0.08, type: 'square' })
  },

  /** Roulement de tambour qui monte, pour faire durer le suspense. */
  drumroll(duration = 1.2, delay = 0) {
    const ctx = context()
    if (!ctx) return
    const hits = Math.round(duration * 26)
    for (let i = 0; i < hits; i++) {
      const k = i / hits
      const at = ctx.currentTime + delay + k * duration
      burst(ctx, { at, dur: 0.05, freq: jitter(240, 0.2), q: 0.8, gain: 0.06 + k * 0.22, filter: 'lowpass' })
    }
  },

  /** Petite bulle (apparition, sélection). */
  pop(delay = 0, pitch = 1) {
    const ctx = context()
    if (!ctx) return
    const at = ctx.currentTime + delay
    tone(ctx, { at, dur: 0.09, freq: 420 * pitch, freqTo: 900 * pitch, gain: 0.14, type: 'triangle' })
  },
}
