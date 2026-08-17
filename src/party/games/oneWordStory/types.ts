
/** Un tour joué dans l'historique (diffusé à tous les clients) */
export interface OneWordStoryTurn {
  memberId: string
  word: string
  timestamp: number
}

/** Joueur courant dont c'est le tour */
export interface CurrentTurnInfo {
  memberId: string
  pseudo: string
  color: string
}

/** État client non-secret pour One Word Story */
export interface OneWordStoryClientState {
  /** Tous les mots de l'histoire, dans l'ordre */
  story: string[]
  /** Infos sur le joueur dont c'est le tour (null si phase 'ended') */
  currentTurn: CurrentTurnInfo | null
  /** Index du tour actuel (0-based) */
  turnIndex: number
  /** Nombre total de mots visés */
  totalWords: number
  /** Temps restant en millisecondes pour le tour actuel */
  timeLeft: number
  /** Phase actuelle du jeu */
  phase: 'intro' | 'writing' | 'ended'
  /** Si c'est le tour du joueur qui reçoit cet état */
  myTurn: boolean
  /** Historique des tours (pour l'affichage détaillé si nécessaire) */
  history: OneWordStoryTurn[]
  /** Si l'histoire est complète */
  completed: boolean
}

/** Configuration optionnelle pour démarrer la partie */
export interface OneWordStoryConfig {
  /** Nombre total de mots (défaut: 30, min: 10, max: 100) */
  totalWords?: number
}