import type { TimesUpCard } from '../../../data/timesUp'

export type TimesUpPhase = 'intro' | 'round1' | 'round2' | 'round3' | 'ended'
export type TimesUpRound = 1 | 2 | 3

export interface TimesUpClientState {
  phase: TimesUpPhase
  round: TimesUpRound
  currentCard: TimesUpCard | null
  currentDescriber: { memberId: string; pseudo: string; color: string } | null
  scores: Record<string, number>
  cardsRemaining: number
  totalCards: number
  timeLeft: number
  isYourTurn: boolean
  lastFound: string | null
  foundCards: TimesUpCard[]
  passedCards: TimesUpCard[]
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