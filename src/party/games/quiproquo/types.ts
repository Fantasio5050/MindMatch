export type QuiproquoPhase = 'intro' | 'reveal-constraints' | 'discussion' | 'guessing' | 'results' | 'ended'

export interface QuiproquoClientState {
  phase: QuiproquoPhase
  topic: string | null
  yourConstraint: { id: string; text: string; description: string } | null
  guesses: Record<string, string | null>
  allGuesses: Record<string, Record<string, string>>  // voterId -> { targetId -> constraintId }
  scores: Record<string, number>
  timeLeft: number
  allConstraints: { id: string; text: string }[]
  round: number
  totalRounds: number
  results: { memberId: string; constraintId: string; guessedBy: string[]; guessedCorrectly: boolean }[]
}

export const PHASE_LABELS: Record<QuiproquoPhase, string> = {
  'intro': 'Préparation',
  'reveal-constraints': 'Découvre ta contrainte',
  'discussion': 'Discussion en cours',
  'guessing': 'Devine les contraintes',
  'results': 'Résultats',
  'ended': 'Partie terminée',
}