import type { TraitKey } from '../types'

export interface TraitMeta {
  key: TraitKey
  label: string
  emoji: string
  color: string
  gradient: string
}

export const TRAITS: TraitMeta[] = [
  { key: 'creativity', label: 'Créativité', emoji: '🎨', color: '#f472b6', gradient: 'from-pink-400 to-fuchsia-500' },
  { key: 'logic', label: 'Logique', emoji: '🧠', color: '#60a5fa', gradient: 'from-blue-400 to-indigo-500' },
  { key: 'ambition', label: 'Ambition', emoji: '🚀', color: '#fb923c', gradient: 'from-orange-400 to-red-500' },
  { key: 'empathy', label: 'Empathie', emoji: '💛', color: '#fbbf24', gradient: 'from-amber-300 to-yellow-500' },
  { key: 'independence', label: 'Indépendance', emoji: '🦅', color: '#34d399', gradient: 'from-emerald-400 to-teal-500' },
  { key: 'sociability', label: 'Sociabilité', emoji: '✨', color: '#a78bfa', gradient: 'from-violet-400 to-purple-500' },
  { key: 'organization', label: 'Organisation', emoji: '📐', color: '#38bdf8', gradient: 'from-sky-400 to-cyan-500' },
]

export const TRAIT_MAP: Record<TraitKey, TraitMeta> = TRAITS.reduce(
  (acc, t) => ({ ...acc, [t.key]: t }),
  {} as Record<TraitKey, TraitMeta>,
)

export const emptyScores = (): Record<TraitKey, number> =>
  TRAITS.reduce((acc, t) => ({ ...acc, [t.key]: 0 }), {} as Record<TraitKey, number>)
