export interface RRLastPull {
  pullerId: string
  bang: boolean
  chamber: number
  /** Probabilité de BANG au moment du tir = 1 / oddsDenom. */
  oddsDenom: number
  gageText: string | null
  gageDone: boolean | null
}

/** État client de la Roulette russe — miroir de l'état serveur, la position de la balle
 * (`secrets.bulletPos`) ayant été retirée par la sanitization. */
export interface RussianRouletteClientState {
  order: string[]
  currentIndex: number
  chamber: number
  lastPull: RRLastPull | null
  totalSips: Record<string, number>
  bangs: Record<string, number>
  survivedPulls: Record<string, number>
  pullsDone: number
  barrelsUsed: number
}
