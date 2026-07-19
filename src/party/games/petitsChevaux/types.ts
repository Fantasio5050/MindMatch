/** État client des Petits Chevaux — miroir direct de l'état serveur (aucun champ n'est transformé
 * par la sanitization : tout est public sur le plateau). */

export interface PCRoll {
  playerId: string
  die: number
  from: number
  to: number
  text: string
  captured: string[]
}

export interface PetitsChevauxClientState {
  order: string[]
  currentIndex: number
  positions: Record<string, number>
  lastRoll: PCRoll | null
  totalSips: Record<string, number>
  finishOrder: string[]
  turnsPlayed: number
  winnerId: string | null
  horseColors: Record<string, string>
}
