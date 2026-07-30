import type { TraitKey } from '../../../types'

export interface SecretProfileHistoryEntry {
  mysteryMemberId: string
  clueTraits: TraitKey[]
  tally: Record<string, number>
  correctGuesserIds: string[]
}

export interface SecretProfileClientState {
  clueTraits: TraitKey[]
  totalRounds: number
  history: SecretProfileHistoryEntry[]
  votedCount: number
  votedMemberIds: string[]
  yourVote: string | null
}

export const CLUE_PHRASES: Record<TraitKey, string> = {
  creativity: 'a une imagination débordante',
  logic: 'a un esprit affûté et très logique',
  ambition: 'vise toujours plus haut',
  empathy: 'capte les émotions des autres en un instant',
  independence: "trace sa route, peu importe le reste",
  sociability: 'est à l\'aise avec absolument tout le monde',
  organization: 'a toujours un plan, même pour l\'imprévu',
}
