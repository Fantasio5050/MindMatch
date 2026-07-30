import { getAudioContext } from './audioContext'
import { sfxMutedStore } from './audioPrefs'

/**
 * Les cues d'un Moment — le son et le mouvement comme une seule chose.
 *
 * ## Le défaut qu'on corrige
 * Jusqu'ici les jeux déclenchaient `play('reveal')` sur le changement de phase, tandis que la
 * primitive `Moment` faisait sa suspension de 600 ms avant de basculer. Le son de l'impact tombait
 * donc **600 ms avant l'impact visuel**. Ça ne s'entend pas comme une erreur, ça s'entend comme
 * une révélation molle — et c'est précisément le moment que le produit doit réussir.
 *
 * Ici la séquence sonore est jouée PAR la primitive, aux mêmes instants que le mouvement. Le
 * calage n'est plus quelque chose qu'on essaie de maintenir : il est structurel.
 *
 * ## La séquence
 *   1. `cueSuspense(ms)`  — deux pulsations sourdes qui montent : la pièce se tait.
 *   2. `cueImpact(tone)`  — la bascule. Un seul coup, franc.
 *   3. (silence)          — le temps mort du verdict n'a pas de son. C'est le silence qui laisse
 *                           la place aux réactions ; y ajouter une fanfare les couvrirait.
 *
 * ## Pourquoi c'est réservé à la TV
 * Huit téléphones qui jouent le même impact à 40 ms d'écart, ce n'est pas de la dramaturgie, c'est
 * du bruit. La scène porte le son, les téléphones restent calmes — application directe du socle
 * (« le téléphone peut être calme, il ne doit jamais être mort » : calme, donc, pour le son).
 */

export type CueTone = 'neutral' | 'win' | 'lose'

/** Enveloppe commune : attaque courte, extinction exponentielle. Rien ne claque, rien ne traîne. */
function voice(
  opts: {
    from: number
    to?: number
    duration: number
    delay?: number
    type?: OscillatorType
    peak?: number
  },
): void {
  const ctx = getAudioContext()
  if (!ctx) return
  const { from, to, duration, delay = 0, type = 'sine', peak = 0.12 } = opts
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  const start = ctx.currentTime + delay
  osc.frequency.setValueAtTime(from, start)
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.018)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

function ready(): boolean {
  if (sfxMutedStore.get()) return false
  const ctx = getAudioContext()
  if (!ctx) return false
  if (ctx.state === 'suspended') void ctx.resume()
  return true
}

/**
 * La suspension. Deux pulsations graves calées pour finir JUSTE avant la bascule — la seconde
 * arrive plus vite et plus haut que la première, ce qui suffit à créer l'attente sans mélodie.
 *
 * @param suspenseSeconds durée de la suspension, telle que la primitive va réellement l'appliquer.
 */
export function cueSuspense(suspenseSeconds: number): void {
  if (!ready()) return
  // Sous ~300 ms il n'y a pas de place pour une montée : on laisse le silence faire le travail.
  if (suspenseSeconds < 0.3) return
  const second = Math.max(0.12, suspenseSeconds - 0.24)
  voice({ from: 118, to: 96, duration: 0.2, delay: 0, type: 'sine', peak: 0.055 })
  voice({ from: 142, to: 112, duration: 0.22, delay: second, type: 'sine', peak: 0.075 })
}

/**
 * La bascule. Un corps grave qui donne le poids, une pointe claire qui donne la lecture. Les trois
 * tons partagent la même attaque : c'est ce qui fait qu'une élimination et une victoire ont le
 * même IMPACT, et ne se distinguent que par ce qui suit.
 */
export function cueImpact(tone: CueTone = 'neutral'): void {
  if (!ready()) return
  // Le corps — commun aux trois tons.
  voice({ from: 190, to: 90, duration: 0.34, type: 'triangle', peak: 0.13 })

  if (tone === 'win') {
    voice({ from: 784, duration: 0.1, delay: 0.02, type: 'sine', peak: 0.1 })
    voice({ from: 988, duration: 0.12, delay: 0.11, type: 'sine', peak: 0.1 })
    voice({ from: 1319, duration: 0.28, delay: 0.21, type: 'sine', peak: 0.09 })
  } else if (tone === 'lose') {
    voice({ from: 330, to: 196, duration: 0.3, delay: 0.03, type: 'sawtooth', peak: 0.055 })
    voice({ from: 247, to: 147, duration: 0.38, delay: 0.2, type: 'sawtooth', peak: 0.05 })
  } else {
    voice({ from: 659, duration: 0.16, delay: 0.02, type: 'sine', peak: 0.095 })
  }
}
