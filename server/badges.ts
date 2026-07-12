import type { Member, TraitKey } from '../src/types'

const TRAIT_KEYS: TraitKey[] = [
  'creativity',
  'logic',
  'ambition',
  'empathy',
  'independence',
  'sociability',
  'organization',
]

interface BadgeCriterion {
  id: string
  check: (stats: Record<string, number>) => boolean
}

// Only badges reachable by games shipped so far have a real criterion wired up.
// The rest (strategist, diplomat, bluffer) unlock as their source games ship.
const CRITERIA: BadgeCriterion[] = [
  { id: 'creative', check: (s) => (s['mostLikely.wins.creativity'] ?? 0) >= 3 },
  { id: 'leader', check: (s) => (s['mostLikely.votesReceived'] ?? 0) >= 10 },
  {
    id: 'chaos',
    check: (s) => TRAIT_KEYS.filter((t) => (s[`mostLikely.wins.${t}`] ?? 0) > 0).length >= 4,
  },
]

export function evaluateBadges(member: Member): string[] {
  const earned = new Set(member.badges)
  for (const criterion of CRITERIA) {
    if (criterion.check(member.gameStats)) earned.add(criterion.id)
  }
  return Array.from(earned)
}
