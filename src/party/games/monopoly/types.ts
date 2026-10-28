/** État public d'une partie de Monopoly (le serveur y ajoute seulement l'ordre caché des paquets). */

export interface MonoPlayer {
  id: string
  /** Index du pion dans `TOKENS`. */
  token: number
  cash: number
  pos: number
  inJail: boolean
  /** Tours déjà passés en prison (3 → on sort en payant). */
  jailTurns: number
  /** Cartes « Libéré de prison » en main. */
  jailCards: number
  bankrupt: boolean
}

/** Où en est le tour du joueur courant. */
export type MonoStep = 'roll' | 'buy' | 'auction' | 'card' | 'jail' | 'debt' | 'done'

export interface MonoAuction {
  square: number
  high: { id: string; amount: number } | null
  passed: string[]
}

export interface MonoDebt {
  memberId: string
  amount: number
  /** Créanciers (vide = la banque). */
  to: { id: string; amount: number }[]
  /** Étape à reprendre une fois la dette réglée. */
  resume: MonoStep
  /** Ce que la TV montrera au paiement (loyer, taxe…). */
  event?: MonoEventInput
  /** Cases à avancer une fois payé (caution forcée au troisième échec en prison). */
  move?: number
}

export interface MonoOffer {
  cash: number
  squares: number[]
  jailCards: number
}

export interface MonoTrade {
  id: number
  from: string
  to: string
  give: MonoOffer
  get: MonoOffer
}

export type MonoEvent = { seq: number; cash: Record<string, number> } & (
  | { type: 'start' }
  | { type: 'roll'; who: string; dice: [number, number]; seed: number }
  | { type: 'move'; who: string; from: number; to: number; mode: 'walk' | 'back' | 'jump' }
  | { type: 'go'; who: string; amount: number }
  | { type: 'buy'; who: string; square: number; price: number }
  | { type: 'rent'; who: string; to: string; square: number; amount: number }
  | { type: 'tax'; who: string; square: number; amount: number }
  | { type: 'card'; who: string; deck: 'chance' | 'chest'; text: string }
  | { type: 'money'; who: string; amount: number; reason: string }
  | { type: 'pot'; who: string; amount: number }
  | { type: 'jail'; who: string }
  | { type: 'free'; who: string; how: 'bail' | 'card' | 'doubles' | 'forced' }
  | { type: 'build'; who: string; square: number; houses: number }
  | { type: 'sell'; who: string; square: number; houses: number }
  | { type: 'mortgage'; who: string; square: number; on: boolean }
  | { type: 'auction'; square: number }
  | { type: 'bid'; who: string; amount: number }
  | { type: 'won'; who: string | null; square: number; amount: number }
  | { type: 'trade'; from: string; to: string }
  | { type: 'bankrupt'; who: string; to: string | null }
  | { type: 'end'; winner: string | null }
)

/** Un événement tel que le serveur le crée, avant numérotation. */
export type MonoEventInput = MonoEvent extends infer E ? (E extends unknown ? Omit<E, 'seq' | 'cash'> : never) : never

export interface MonoState {
  players: MonoPlayer[]
  turn: number
  step: MonoStep
  dice: [number, number] | null
  doubles: number
  /** Le joueur a fait un double : il rejoue une fois son tour résolu. */
  again: boolean
  owners: Record<number, string>
  houses: Record<number, number>
  mortgaged: Record<number, boolean>
  /** Cagnotte du Parc gratuit (taxes et amendes). */
  pot: number
  card: { deck: 'chance' | 'chest'; index: number; text: string } | null
  auction: MonoAuction | null
  debt: MonoDebt | null
  trade: MonoTrade | null
  events: MonoEvent[]
  seq: number
  winner: string | null
}

/** Ce que reçoivent les écrans : tout l'état, sauf l'ordre des paquets. */
export type MonoClientState = MonoState
