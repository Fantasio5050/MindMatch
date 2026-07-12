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
  xp: number
  badges: string[]
  gameStats: Record<string, number>
}

export type PartyStatus = 'lobby' | 'playing' | 'ended'

export interface PartySession {
  status: PartyStatus
  hostMemberId: string
  currentGameId: string | null
  phase: string | null
  round: number
  roundData: unknown
  /** Snapshot of member ids present when the current game started. Anyone who joins the group
   * while this list is non-empty (i.e. a game is active) is not in it, and the client shows them
   * a waiting screen instead of the live game UI — cleaner than teaching every game module how to
   * cope with a player appearing mid-round. Reset to the full roster on each new game start. */
  participantIds: string[]
}

export interface Group {
  id: string
  code: string
  name: string
  createdAt: number
  members: Member[]
  party: PartySession
  /** Host-controlled setting unlocking 18+ content packs and drinking games for the whole room. */
  adultModeEnabled: boolean
}

/** A durable record of one completed mini-game, independent of the live (and overwritten-on-next-game)
 * `party.roundData` — this is what powers a "parties précédentes" history for a group. */
export interface GameHistoryEntry {
  id: number
  groupId: string
  gameId: string
  gameName: string
  endedAt: number
  roundsPlayed: number
}
