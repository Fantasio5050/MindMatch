import type { Member } from '../types'
import { topDifferences } from './groupAnalysis'
import { DEBATE_TEMPLATES } from '../data/debateTemplates'

export interface DebateCard {
  id: string
  theme: string
  question: string
  memberA: Member
  poleA: string
  memberB: Member
  poleB: string
}

export function generateDebates(members: Member[], count = 4): DebateCard[] {
  const differences = topDifferences(members, count)
  return differences.map((d) => {
    const template = DEBATE_TEMPLATES[d.trait]
    return {
      id: d.trait,
      theme: template.theme,
      question: template.question,
      memberA: d.max.member,
      poleA: template.poleHigh,
      memberB: d.min.member,
      poleB: template.poleLow,
    }
  })
}
