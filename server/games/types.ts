import type { Group, PartySession, TraitKey } from '../../src/types'

export interface XpAward {
  memberId: string
  amount: number
  trait?: TraitKey
  /** gameStats counters to increment, namespaced by game (e.g. { 'mostLikely.wins': 1 }). */
  statIncrements?: Record<string, number>
  reason: string
}

export interface RoundResult {
  session: PartySession
  xpAwards?: XpAward[]
}

export interface GameAction {
  type: string
  payload: unknown
}

export interface GameModule {
  id: string
  name: string
  icon: string
  minPlayers: number
  /** Starts a fresh round (or the first round) — called on game start and on host "next round". */
  initRound(group: Group, session: PartySession): RoundResult
  /** Applies a player action (e.g. a vote) to the current round. */
  handleAction(group: Group, session: PartySession, memberId: string, action: GameAction): RoundResult
  /** Whether the current round has enough input to resolve automatically (e.g. everyone voted). */
  isRoundComplete(group: Group, session: PartySession): boolean
  /** Tallies the round, computes XP/score awards, and moves the phase to reveal. */
  resolveRound(group: Group, session: PartySession): RoundResult
}
