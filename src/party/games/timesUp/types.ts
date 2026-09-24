import type { TimesUpCard } from '../../../data/timesUp'

export type TimesUpPhase = 'intro' | 'round1' | 'round2' | 'round3' | 'ended'
export type TimesUpRound = 1 | 2 | 3

export interface TimesUpClientState {
  phase: TimesUpPhase
  round: TimesUpRound
  /** La carte à faire deviner — présente SEULEMENT sur le téléphone de celui qui décrit */
  currentCard: TimesUpCard | null
  /** Joueur désigné (tour lancé ou non) */
  currentDescriber: { memberId: string; pseudo: string; color: string } | null
  isYourTurn: boolean
  /** Le chrono tourne */
  turnActive: boolean
  /** Identité du tour (jointe aux « temps écoulé » pour ignorer les doublons) */
  turnSeq: number
  /** Pause entre deux manches */
  betweenRounds: boolean
  /** Temps restant, en millisecondes */
  timeLeft: number
  turnTotal: number
  cardsRemaining: number
  totalCards: number
  foundCount: number
  /** Cartes trouvées pendant ce tour (déjà devinées : publiques) */
  foundThisTurn: string[]
  passedThisTurn: number
  lastFound: string | null
  scores: Record<string, number>
  turnOrder: string[]
  roundResults: { round: TimesUpRound; found: TimesUpCard[]; missed: TimesUpCard[] }[]
}

export const ROUND_LABELS: Record<TimesUpRound, string> = {
  1: 'Round 1 — Décris librement',
  2: 'Round 2 — Un seul mot',
  3: 'Round 3 — Mime uniquement',
}

export const ROUND_DESCS: Record<TimesUpRound, string> = {
  1: 'Décris avec autant de mots que tu veux. Pas le droit de dire le nom !',
  2: 'Un seul mot par carte. Pas de bruitage, pas de mime !',
  3: 'Aucun mot, aucun bruit. Mime uniquement !',
}