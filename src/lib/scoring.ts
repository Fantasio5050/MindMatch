import { questions } from '../data/questions'
import { TRAITS } from '../data/traits'
import { ARCHETYPES, SECONDARY_CLAUSES, GROWTH_CLAUSES } from '../data/archetypes'
import type { TraitKey, TraitScores } from '../types'

export function computeScores(answers: Record<string, string>): TraitScores {
  const raw: Record<TraitKey, number> = {} as Record<TraitKey, number>
  const min: Record<TraitKey, number> = {} as Record<TraitKey, number>
  const max: Record<TraitKey, number> = {} as Record<TraitKey, number>
  for (const t of TRAITS) {
    raw[t.key] = 0
    min[t.key] = 0
    max[t.key] = 0
  }

  for (const q of questions) {
    for (const t of TRAITS) {
      const weightsForTrait = q.options.map((o) => o.weights[t.key] ?? 0)
      min[t.key] += Math.min(0, ...weightsForTrait)
      max[t.key] += Math.max(0, ...weightsForTrait)
    }
    const chosenId = answers[q.id]
    const chosen = q.options.find((o) => o.id === chosenId)
    if (chosen) {
      for (const t of TRAITS) {
        raw[t.key] += chosen.weights[t.key] ?? 0
      }
    }
  }

  const scores: TraitScores = {} as TraitScores
  for (const t of TRAITS) {
    const range = max[t.key] - min[t.key]
    if (range <= 0) {
      scores[t.key] = 50
    } else {
      const pct = ((raw[t.key] - min[t.key]) / range) * 100
      scores[t.key] = Math.round(Math.max(0, Math.min(100, pct)))
    }
  }
  return scores
}

export function sortedTraits(scores: TraitScores): TraitKey[] {
  return [...TRAITS.map((t) => t.key)].sort((a, b) => scores[b] - scores[a])
}

export function getArchetypeId(scores: TraitScores): TraitKey {
  return sortedTraits(scores)[0]
}

export function generateDescription(scores: TraitScores, pseudo: string): string {
  const [primary, secondary] = sortedTraits(scores)
  const lowest = sortedTraits(scores)[sortedTraits(scores).length - 1]
  const archetype = ARCHETYPES[primary]
  const secondaryClause = SECONDARY_CLAUSES[secondary]
  const growthClause = GROWTH_CLAUSES[lowest]
  const lowerDescription = archetype.description.charAt(0).toLowerCase() + archetype.description.slice(1)
  return `${pseudo}, ${lowerDescription} Tu avances ${secondaryClause}. Pour continuer à grandir, ${growthClause}.`
}

export function answeredCount(answers: Record<string, string>): number {
  return Object.keys(answers).length
}

export const TOTAL_QUESTIONS = questions.length
