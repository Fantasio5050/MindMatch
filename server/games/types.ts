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
  /**
   * Ce que VOIT un joueur (ou la TV, `memberId === null`) de l'état du jeu.
   *
   * Sans ce hook, `roundData` part tel quel, filtré seulement par les conventions génériques de
   * `sanitizeParty` (`votes`, `hands`, `secrets`…). Ça suffit aux jeux dont le secret tient dans
   * une de ces clés ; pas aux jeux à information cachée riche (rôles du Loup-Garou, main et
   * pioche d'UNO, cartes fermées du Poker) ni à ceux dont l'écran dépend de QUI regarde
   * (« c'est ton tour », « ta contrainte »).
   *
   * Avec ce hook, la vue retournée REMPLACE `roundData` pour ce destinataire : tout ce qu'elle
   * ne contient pas ne quitte jamais le serveur. C'est une liste blanche, pas une liste noire —
   * un champ secret ajouté plus tard à l'état reste privé par défaut.
   */
  viewFor?(group: Group, session: PartySession, memberId: string | null): unknown
}
