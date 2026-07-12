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
  /** Extra game-specific eligibility check beyond minPlayers (e.g. "needs 2 players with a
   * finished MindMatch profile"). Return an error message to block starting, or null/undefined
   * to allow it. */
  canStart?(group: Group): string | null
  /**
   * Starts a fresh round (or the first round) — called on game start and on host "next round".
   * `config` is only meaningful on the very first call (e.g. a chosen content pack); later calls
   * pass `undefined` and the game should keep whatever it already stored in `session.roundData`.
   */
  initRound(group: Group, session: PartySession, config?: unknown): RoundResult
  /** Applies a player action (e.g. a vote) to the current round. */
  handleAction(group: Group, session: PartySession, memberId: string, action: GameAction): RoundResult
  /** Whether the current round has enough input to resolve automatically (e.g. everyone voted). */
  isRoundComplete(group: Group, session: PartySession): boolean
  /** Whether the round is still collecting player input (true) or already resolved/showing a reveal (false).
   * Drives what host "advance" does: resolve the round early, or move on to the next one. */
  isAwaitingInput(group: Group, session: PartySession): boolean
  /** Tallies the round, computes XP/score awards, and moves the phase to reveal. */
  resolveRound(group: Group, session: PartySession): RoundResult
}
