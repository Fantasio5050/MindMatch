
/** Une carte de poker (52 cartes du deck) */
export interface PokerCard {
  id: string
  rank: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 // 11=J, 12=Q, 13=K, 14=A
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
}

/** Phase de jeu côté serveur */
export type PokerPhase = 'betting' | 'dealing' | 'showdown' | 'ended'

/** Tour d'enchères */
export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river'

/** Niveau de force de main pour le mode assisté */
export type HandStrengthLevel = 'weak' | 'medium' | 'strong'

/** Force de main (mode assisté) */
export interface HandStrength {
  level: HandStrengthLevel
  description: string
}

/** Suggestion d'action (mode assisté) */
export interface ActionSuggestion {
  action: string
  reason: string
}

/** Pot odds (mode assisté) */
export interface PotOdds {
  toCall: number
  potSize: number
  ratio: string
}

/** Outs — cartes qui améliorent la main (mode assisté) */
export interface PokerOuts {
  description: string
  count: number
}

/** Joueur dont c'est le tour */
export interface CurrentPlayerInfo {
  memberId: string
  pseudo: string
  color: string
}

/** Gagnant de la main */
export interface WinnerInfo {
  memberId: string
  handDescription: string
}

/** Dernière action effectuée */
export interface LastActionInfo {
  playerId: string
  playerName: string
  action: string
  amount: number
}

/** État client non-secret pour Poker Texas Hold'em */
export interface PokerClientState {
  /** Tes 2 cartes privées */
  yourCards: PokerCard[]
  /** Cartes communes (0-5) */
  communityCards: PokerCard[]
  /** Pot actuel */
  pot: number
  /** Mise actuelle à suivre (mise la plus haute du tour) */
  currentBet: number
  /** Tes jetons restants */
  yourChips: number
  /** Ce que tu as déjà misé ce tour */
  yourBet: number
  /** Joueur dont c'est le tour */
  currentPlayer: CurrentPlayerInfo | null
  /** Phase de jeu */
  phase: PokerPhase
  /** Tour d'enchères */
  bettingRound: BettingRound
  /** Joueurs couchés */
  foldedPlayers: string[]
  /** Jetons par joueur (memberId -> chips) */
  handCounts: Record<string, number>
  /** Gagnant de la main */
  winner: WinnerInfo | null
  /** Ton mode de jeu */
  assistedMode: boolean
  /** Force de ta main (mode assisté) */
  handStrength: HandStrength | null
  /** Suggestion d'action (mode assisté) */
  suggestion: ActionSuggestion | null
  /** Pot odds (mode assisté) */
  potOdds: PotOdds | null
  /** Outs (mode assisté) */
  outs: PokerOuts | null
  /** Si c'est ton tour */
  isYourTurn: boolean
  /** Si tu peux checker */
  canCheck: boolean
  /** Mise minimale pour relancer */
  minRaise: number
  /** Dernière action effectuée */
  lastAction: LastActionInfo | null
  /** Si tous les joueurs ont choisi leur mode */
  modesChosen: boolean
  /** Liste des joueurs qui ont déjà choisi leur mode */
  playersWhoChoseMode: string[]
}

/** Configuration optionnelle pour démarrer la partie */
export interface PokerConfig {
  /** Jetons de départ par joueur (défaut: 1000) */
  startingChips?: number
  /** Small blind (défaut: 10) */
  smallBlind?: number
  /** Big blind (défaut: 20) */
  bigBlind?: number
}

/** Définitions du glossaire pour le mode assisté */
export const POKER_GLOSSARY: Record<string, string> = {
  fold: 'Se coucher — abandonner la main et perdre tes mises.',
  call: 'Suivre — miser le montant égal à la mise actuelle pour rester dans le coup.',
  raise: 'Relancer — miser plus que la mise actuelle pour faire pression sur les autres.',
  check: 'Checker — passer son tour sans miser (possible si personne n\'a misé).',
  'all-in': 'Tapis — miser tous tes jetons restants.',
  flop: 'Flop — 3 premières cartes communes révélées.',
  turn: 'Turn — 4ème carte commune révélée.',
  river: 'River — 5ème et dernière carte commune révélée.',
  blinds: 'Blinds — mises forcées tournantes (small blind + big blind) pour forcer l\'action.',
  'pot-odds': 'Pot odds — ratio entre ce que tu dois payer et ce que tu peux gagner. T\'aide à décider si suivre est rentable.',
  outs: 'Outs — cartes restantes dans le deck qui amélioreraient ta main.',
  'hole-cards': 'Hole cards — tes 2 cartes privées, visibles uniquement par toi.',
  'community-cards': 'Cartes communes — les 5 cartes au centre partagées par tous les joueurs.',
}

/** Labels des actions */
export const ACTION_LABELS: Record<string, string> = {
  check: 'Checker',
  call: 'Suivre',
  raise: 'Relancer',
  fold: 'Se coucher',
  'all-in': 'Tapis',
}

/** Labels des tours d'enchères */
export const BETTING_ROUND_LABELS: Record<BettingRound, string> = {
  preflop: 'Pre-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
}

/** Noms des rangs de cartes */
export const RANK_LABELS: Record<number, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
}

/** Symboles des couleurs */
export const SUIT_SYMBOLS: Record<PokerCard['suit'], string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

/** Couleurs CSS pour les cartes selon la couleur */
export const SUIT_COLORS: Record<PokerCard['suit'], string> = {
  hearts: 'text-red-400',
  diamonds: 'text-red-400',
  clubs: 'text-chalk',
  spades: 'text-chalk',
}

/** Emoji pour le niveau de force de main */
export const STRENGTH_EMOJI: Record<HandStrengthLevel, string> = {
  weak: '🟡',
  medium: '🟠',
  strong: '🔴',
}

/** Labels pour le niveau de force */
export const STRENGTH_LABELS: Record<HandStrengthLevel, string> = {
  weak: 'Faible',
  medium: 'Moyen',
  strong: 'Fort',
}

/** Helper pour formater une carte en texte lisible */
export function cardLabel(card: PokerCard): string {
  return `${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]}`
}