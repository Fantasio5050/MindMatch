import type { Member, TraitKey } from '../types'
import { TRAITS, TRAIT_MAP } from '../data/traits'

export function finishedMembers(members: Member[]): Member[] {
  return members.filter((m) => !!m.scores)
}

export interface TraitStat {
  trait: TraitKey
  avg: number
  spread: number
  min: { member: Member; value: number }
  max: { member: Member; value: number }
}

export function computeTraitStats(members: Member[]): TraitStat[] {
  return TRAITS.map((t) => {
    const values = members.map((m) => ({ member: m, value: m.scores![t.key] }))
    const avg = values.reduce((sum, v) => sum + v.value, 0) / values.length
    const variance = values.reduce((sum, v) => sum + (v.value - avg) ** 2, 0) / values.length
    const spread = Math.sqrt(variance)
    const min = values.reduce((a, b) => (b.value < a.value ? b : a))
    const max = values.reduce((a, b) => (b.value > a.value ? b : a))
    return { trait: t.key, avg, spread, min, max }
  })
}

export function topSimilarities(members: Member[], count = 2): TraitStat[] {
  return [...computeTraitStats(members)].sort((a, b) => a.spread - b.spread).slice(0, count)
}

export function topDifferences(members: Member[], count = 2): TraitStat[] {
  return [...computeTraitStats(members)]
    .sort((a, b) => b.spread - a.spread)
    .filter((s) => s.spread > 4)
    .slice(0, count)
}

export interface Ranking {
  id: string
  title: string
  emoji: string
  member: Member
  value: number
}

interface RankingDef {
  id: string
  title: string
  emoji: string
  score: (m: Member) => number
}

const RANKING_DEFS: RankingDef[] = [
  { id: 'creative', title: 'Le/la plus créatif·ve', emoji: '🎨', score: (m) => m.scores!.creativity },
  { id: 'organized', title: 'Le/la plus organisé·e', emoji: '📐', score: (m) => m.scores!.organization },
  {
    id: 'adventurous',
    title: 'Le/la plus aventurier·ère',
    emoji: '🧭',
    score: (m) => (m.scores!.creativity + m.scores!.independence) / 2,
  },
  { id: 'empathetic', title: 'Le/la plus empathique', emoji: '💛', score: (m) => m.scores!.empathy },
  { id: 'ambitious', title: 'Le/la plus ambitieux·se', emoji: '🚀', score: (m) => m.scores!.ambition },
  { id: 'social', title: 'Le/la plus sociable', emoji: '🎉', score: (m) => m.scores!.sociability },
  { id: 'strategic', title: 'Le/la plus stratège', emoji: '🧠', score: (m) => m.scores!.logic },
  { id: 'independent', title: 'Le/la plus indépendant·e', emoji: '🦅', score: (m) => m.scores!.independence },
]

export function computeRankings(members: Member[]): Ranking[] {
  return RANKING_DEFS.map((def) => {
    const winner = [...members].sort((a, b) => def.score(b) - def.score(a))[0]
    return { id: def.id, title: def.title, emoji: def.emoji, member: winner, value: Math.round(def.score(winner)) }
  })
}

export function traitLabel(trait: TraitKey): string {
  return TRAIT_MAP[trait].label
}
