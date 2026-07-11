export type TraitKey =
  | 'creativity'
  | 'logic'
  | 'ambition'
  | 'empathy'
  | 'independence'
  | 'sociability'
  | 'organization'

export type TraitScores = Record<TraitKey, number>

export interface QuestionOption {
  id: string
  label: string
  emoji?: string
  weights: Partial<Record<TraitKey, number>>
}

export type QuestionCategory = 'personality' | 'values' | 'dilemma' | 'preference'

export interface Question {
  id: string
  category: QuestionCategory
  prompt: string
  options: QuestionOption[]
}

export interface Archetype {
  id: string
  name: string
  emoji: string
  tagline: string
  description: string
}

export interface Member {
  id: string
  pseudo: string
  color: string
  answers: Record<string, string>
  scores: TraitScores | null
  archetypeId: string | null
  finishedAt: number | null
}

export interface Group {
  id: string
  code: string
  name: string
  createdAt: number
  members: Member[]
}
