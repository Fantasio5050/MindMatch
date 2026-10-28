export interface DiceRoll {
  /** Numéro du lancer dans la partie : un nouveau numéro = une nouvelle animation. */
  n: number
  memberId: string
  value: number
  /** Graine de la trajectoire 3D. */
  seed: number
  at: number
}

export interface DiceClientState {
  order: string[]
  currentIndex: number
  lastRoll: DiceRoll | null
  history: DiceRoll[]
  totalSips: Record<string, number>
  rollCount: Record<string, number>
  rolls: number
}

/** Durée de l'animation d'un lancer côté téléphone (et du verrou du bouton qui va avec). */
export const ROLL_ANIM_MS = 2600
