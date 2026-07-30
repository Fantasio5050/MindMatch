/**
 * Le pont entre les tokens de mouvement et framer-motion.
 *
 * `tokens.css` déclare `--dur-*` et `--ease-*`, et jusqu'ici le JavaScript les ignorait : chaque
 * animation redéclarait ses propres 0.46 s et ses propres courbes en dur. Résultat, le design
 * system disait une chose et le produit en faisait une autre — et la TV et le téléphone
 * respiraient à des rythmes légèrement différents sans que personne ne puisse le voir.
 *
 * Ici les valeurs sont LUES depuis le CSS au premier accès, avec les valeurs du socle en repli
 * (rendu serveur, test hors DOM). Changer une durée dans `tokens.css` change donc réellement le
 * mouvement partout, y compris dans les animations JavaScript.
 */

/** Durées en SECONDES — l'unité de framer-motion. Le CSS les exprime en millisecondes. */
export interface MotionDurations {
  /** Retour tactile. */
  quick: number
  /** Transition standard. */
  base: number
  /** Deal — distribution d'une carte, arrivée d'un élément. */
  deal: number
  /** Reveal — la suspension AVANT la bascule. */
  suspense: number
  /** Verdict — le temps mort assumé après l'impact. */
  verdict: number
}

export type Bezier = [number, number, number, number]

const FALLBACK_DUR: MotionDurations = { quick: 0.14, base: 0.26, deal: 0.42, suspense: 0.6, verdict: 0.9 }
const FALLBACK_EASE: Record<'soft' | 'impact' | 'exit', Bezier> = {
  soft: [0.22, 1, 0.36, 1],
  impact: [0.16, 1.02, 0.3, 1],
  exit: [0.4, 0, 1, 1],
}

let cache: { dur: MotionDurations; ease: typeof FALLBACK_EASE } | null = null

function rootStyle(): CSSStyleDeclaration | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  return getComputedStyle(document.documentElement)
}

/** `600ms` / `0.6s` -> 0.6 (secondes). */
function parseDuration(raw: string, fallback: number): number {
  const v = raw.trim()
  if (!v) return fallback
  const n = Number.parseFloat(v)
  if (!Number.isFinite(n)) return fallback
  return v.endsWith('ms') ? n / 1000 : n
}

/** `cubic-bezier(.22,1,.36,1)` -> [0.22, 1, 0.36, 1]. */
function parseBezier(raw: string, fallback: Bezier): Bezier {
  const m = raw.match(/cubic-bezier\(([^)]+)\)/)
  if (!m) return fallback
  const parts = m[1].split(',').map((x) => Number.parseFloat(x))
  return parts.length === 4 && parts.every(Number.isFinite) ? (parts as Bezier) : fallback
}

function read() {
  if (cache) return cache
  const s = rootStyle()
  if (!s) return { dur: FALLBACK_DUR, ease: FALLBACK_EASE }
  const d = (name: keyof MotionDurations) =>
    parseDuration(s.getPropertyValue(`--dur-${name}`), FALLBACK_DUR[name])
  const e = (name: keyof typeof FALLBACK_EASE) =>
    parseBezier(s.getPropertyValue(`--ease-${name}`), FALLBACK_EASE[name])
  cache = {
    dur: { quick: d('quick'), base: d('base'), deal: d('deal'), suspense: d('suspense'), verdict: d('verdict') },
    ease: { soft: e('soft'), impact: e('impact'), exit: e('exit') },
  }
  return cache
}

/** Durées du socle, en secondes. */
export const dur = new Proxy({} as MotionDurations, {
  get: (_t, k: string) => read().dur[k as keyof MotionDurations],
})

/** Courbes du socle, au format framer-motion. */
export const ease = new Proxy({} as typeof FALLBACK_EASE, {
  get: (_t, k: string) => read().ease[k as keyof typeof FALLBACK_EASE],
})
