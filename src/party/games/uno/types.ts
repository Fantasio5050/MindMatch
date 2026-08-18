/** Une carte UNO */
export interface UnoCard {
  id: string
  color: 'red' | 'yellow' | 'green' | 'blue' | 'wild'
  value: number | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'
}

/** Joueur courant dont c'est le tour */
export interface CurrentPlayerInfo {
  memberId: string
  pseudo: string
  color: string
}

/** État client non-secret pour UNO */
export interface UnoClientState {
  /** Tes cartes en main */
  hand: UnoCard[]
  /** Carte sur la défausse */
  topCard: UnoCard | null
  /** Couleur active (importante pour les jokers) */
  currentColor: 'red' | 'yellow' | 'green' | 'blue'
  /** Infos sur le joueur dont c'est le tour */
  currentPlayer: CurrentPlayerInfo | null
  /** Sens du jeu (1 = horaire, -1 = anti-horaire) */
  direction: 1 | -1
  /** Nombre de cartes par joueur */
  handCounts: Record<string, number>
  /** ID du gagnant (null si la partie continue) */
  winner: string | null
  /** Phase actuelle */
  phase: 'playing' | 'ended'
  /** Si tu peux jouer au moins une carte */
  canPlay: boolean
  /** Si c'est ton tour */
  myTurn: boolean
  /** Si tu dois appeler UNO (1 carte restante et pas encore appelé) */
  mustCallUno: boolean
  /** Si tu as appelé UNO */
  unoCalled: boolean
  /** Nombre de cartes dans la pioche */
  deckCount: number
  /** Dernier événement (pour animations) */
  lastEvent: { type: 'play' | 'draw' | 'uno' | 'penalty' | 'win'; memberId: string; cardId?: string } | null
}

/** Libellés des couleurs */
export const COLOR_LABELS: Record<string, string> = {
  red: 'Rouge',
  yellow: 'Jaune',
  green: 'Vert',
  blue: 'Bleu',
}

/** Emoji des couleurs */
export const COLOR_EMOJI: Record<string, string> = {
  red: '🔴',
  yellow: '🟡',
  green: '🟢',
  blue: '🔵',
}

/** Classes Tailwind pour les couleurs de cartes */
export const COLOR_CLASSES: Record<string, string> = {
  red: 'bg-red-500 border-red-400',
  yellow: 'bg-yellow-500 border-yellow-400',
  green: 'bg-green-500 border-green-400',
  blue: 'bg-blue-500 border-blue-400',
  wild: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 border-white/50',
}

/** Texte pour les valeurs de cartes spéciales */
export const VALUE_LABELS: Record<string, string> = {
  skip: '🚫',
  reverse: '🔄',
  draw2: '+2',
  wild: '🎨',
  wild4: '+4',
}

/** Couleurs jouables pour les jokers */
export const PLAYABLE_COLORS: Array<'red' | 'yellow' | 'green' | 'blue'> = [
  'red',
  'yellow',
  'green',
  'blue',
]