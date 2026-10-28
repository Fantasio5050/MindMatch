/**
 * Monopoly — le plateau parisien, les cartes et les pions. Partagé par le serveur (règles) et par
 * les écrans (plateau 3D de la TV, titres de propriété des téléphones).
 */

export type ColorGroup = 'brown' | 'lightblue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkblue'

export type Square =
  | { kind: 'go'; name: string }
  | { kind: 'property'; name: string; group: ColorGroup; price: number; rents: [number, number, number, number, number, number]; houseCost: number }
  | { kind: 'station'; name: string; price: number }
  | { kind: 'utility'; name: string; price: number }
  | { kind: 'tax'; name: string; amount: number }
  | { kind: 'chance'; name: string }
  | { kind: 'chest'; name: string }
  | { kind: 'jail'; name: string }
  | { kind: 'parking'; name: string }
  | { kind: 'gotojail'; name: string }

export type BuyableSquare = Extract<Square, { price: number }>

export const START_CASH = 1500
export const GO_SALARY = 200
export const BAIL = 50
export const JAIL_SQUARE = 10
export const MAX_PLAYERS = 8

const P = (name: string, group: ColorGroup, price: number, rents: [number, number, number, number, number, number], houseCost: number): Square => ({
  kind: 'property',
  name,
  group,
  price,
  rents,
  houseCost,
})

export const BOARD: Square[] = [
  { kind: 'go', name: 'Départ' },
  P('Boulevard de Belleville', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { kind: 'chest', name: 'Caisse de communauté' },
  P('Rue Lecourbe', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { kind: 'tax', name: 'Impôts sur le revenu', amount: 200 },
  { kind: 'station', name: 'Gare Montparnasse', price: 200 },
  P('Rue de Vaugirard', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  { kind: 'chance', name: 'Chance' },
  P('Rue de Courcelles', 'lightblue', 100, [6, 30, 90, 270, 400, 550], 50),
  P('Avenue de la République', 'lightblue', 120, [8, 40, 100, 300, 450, 600], 50),
  { kind: 'jail', name: 'Prison' },
  P('Boulevard de la Villette', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  { kind: 'utility', name: "Compagnie d'électricité", price: 150 },
  P('Avenue de Neuilly', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  P('Rue de Paradis', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { kind: 'station', name: 'Gare de Lyon', price: 200 },
  P('Avenue Mozart', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { kind: 'chest', name: 'Caisse de communauté' },
  P('Boulevard Saint-Michel', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  P('Place Pigalle', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { kind: 'parking', name: 'Parc gratuit' },
  P('Avenue Matignon', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { kind: 'chance', name: 'Chance' },
  P('Boulevard Malesherbes', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  P('Avenue Henri-Martin', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { kind: 'station', name: 'Gare du Nord', price: 200 },
  P('Faubourg Saint-Honoré', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  P('Place de la Bourse', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  { kind: 'utility', name: 'Compagnie des eaux', price: 150 },
  P('Rue La Fayette', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { kind: 'gotojail', name: 'Allez en prison' },
  P('Avenue de Breteuil', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  P('Avenue Foch', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { kind: 'chest', name: 'Caisse de communauté' },
  P('Boulevard des Capucines', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { kind: 'station', name: 'Gare Saint-Lazare', price: 200 },
  { kind: 'chance', name: 'Chance' },
  P('Avenue des Champs-Élysées', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { kind: 'tax', name: 'Taxe de luxe', amount: 100 },
  P('Rue de la Paix', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
]

export const GROUP_COLORS: Record<ColorGroup, string> = {
  brown: '#8a4b2a',
  lightblue: '#8fd3f4',
  pink: '#d63c8f',
  orange: '#f28c28',
  red: '#e2262f',
  yellow: '#f6d523',
  green: '#1f9e57',
  darkblue: '#1d5fb4',
}

export const GROUP_SQUARES: Record<ColorGroup, number[]> = BOARD.reduce(
  (acc, sq, i) => {
    if (sq.kind === 'property') acc[sq.group].push(i)
    return acc
  },
  { brown: [], lightblue: [], pink: [], orange: [], red: [], yellow: [], green: [], darkblue: [] } as Record<ColorGroup, number[]>,
)

export const STATIONS = BOARD.flatMap((s, i) => (s.kind === 'station' ? [i] : []))
export const UTILITIES = BOARD.flatMap((s, i) => (s.kind === 'utility' ? [i] : []))

export function isBuyable(sq: Square): sq is BuyableSquare {
  return sq.kind === 'property' || sq.kind === 'station' || sq.kind === 'utility'
}

// ─── Cartes ─────────────────────────────────────────────────────────────────

export type CardEffect =
  | { type: 'move'; to: number }
  | { type: 'back'; steps: number }
  | { type: 'nearest'; kind: 'station' | 'utility' }
  | { type: 'money'; amount: number }
  | { type: 'jail' }
  | { type: 'jailFree' }
  | { type: 'repairs'; house: number; hotel: number }
  | { type: 'payEach'; amount: number }
  | { type: 'collectEach'; amount: number }

export interface MonopolyCard {
  text: string
  effect: CardEffect
}

export const CHANCE_CARDS: MonopolyCard[] = [
  { text: 'Avancez jusqu’à la case Départ.', effect: { type: 'move', to: 0 } },
  { text: 'Rendez-vous à l’Avenue Henri-Martin. Si vous passez par la case Départ, recevez 200 €.', effect: { type: 'move', to: 24 } },
  { text: 'Avancez au Boulevard de la Villette. Si vous passez par la case Départ, recevez 200 €.', effect: { type: 'move', to: 11 } },
  { text: 'Avancez jusqu’à la gare la plus proche. Si elle appartient à un joueur, payez-lui le double du loyer.', effect: { type: 'nearest', kind: 'station' } },
  { text: 'Avancez jusqu’à la gare la plus proche. Si elle appartient à un joueur, payez-lui le double du loyer.', effect: { type: 'nearest', kind: 'station' } },
  { text: 'Avancez jusqu’à la compagnie la plus proche. Si elle appartient à un joueur, lancez les dés et payez dix fois le résultat.', effect: { type: 'nearest', kind: 'utility' } },
  { text: 'La banque vous verse un dividende de 50 €.', effect: { type: 'money', amount: 50 } },
  { text: 'Vous êtes libéré de prison. Cette carte peut être conservée.', effect: { type: 'jailFree' } },
  { text: 'Reculez de trois cases.', effect: { type: 'back', steps: 3 } },
  { text: 'Allez en prison. Ne passez pas par la case Départ, ne recevez pas 200 €.', effect: { type: 'jail' } },
  { text: 'Faites des réparations dans toutes vos maisons : 25 € par maison, 100 € par hôtel.', effect: { type: 'repairs', house: 25, hotel: 100 } },
  { text: 'Amende pour excès de vitesse : 15 €.', effect: { type: 'money', amount: -15 } },
  { text: 'Rendez-vous à la Gare de Lyon. Si vous passez par la case Départ, recevez 200 €.', effect: { type: 'move', to: 15 } },
  { text: 'Rendez-vous Rue de la Paix.', effect: { type: 'move', to: 39 } },
  { text: 'Vous êtes élu président du conseil d’administration. Versez 50 € à chaque joueur.', effect: { type: 'payEach', amount: 50 } },
  { text: 'Votre immeuble et votre prêt rapportent. Recevez 150 €.', effect: { type: 'money', amount: 150 } },
]

export const CHEST_CARDS: MonopolyCard[] = [
  { text: 'Avancez jusqu’à la case Départ.', effect: { type: 'move', to: 0 } },
  { text: 'Erreur de la banque en votre faveur. Recevez 200 €.', effect: { type: 'money', amount: 200 } },
  { text: 'Payez la note du médecin : 50 €.', effect: { type: 'money', amount: -50 } },
  { text: 'La vente de votre stock vous rapporte 50 €.', effect: { type: 'money', amount: 50 } },
  { text: 'Vous êtes libéré de prison. Cette carte peut être conservée.', effect: { type: 'jailFree' } },
  { text: 'Allez en prison. Ne passez pas par la case Départ, ne recevez pas 200 €.', effect: { type: 'jail' } },
  { text: 'Recevez votre revenu annuel : 100 €.', effect: { type: 'money', amount: 100 } },
  { text: 'Les contributions vous remboursent la somme de 20 €.', effect: { type: 'money', amount: 20 } },
  { text: 'C’est votre anniversaire : chaque joueur vous donne 10 €.', effect: { type: 'collectEach', amount: 10 } },
  { text: 'Votre assurance-vie vous rapporte 100 €.', effect: { type: 'money', amount: 100 } },
  { text: 'Payez les frais d’hospitalisation : 100 €.', effect: { type: 'money', amount: -100 } },
  { text: 'Payez votre scolarité : 50 €.', effect: { type: 'money', amount: -50 } },
  { text: 'Recevez votre intérêt sur l’emprunt à 7 % : 25 €.', effect: { type: 'money', amount: 25 } },
  { text: 'Vous êtes imposé pour les réparations de voirie : 40 € par maison, 115 € par hôtel.', effect: { type: 'repairs', house: 40, hotel: 115 } },
  { text: 'Vous avez gagné le deuxième prix de beauté : recevez 10 €.', effect: { type: 'money', amount: 10 } },
  { text: 'Vous héritez de 100 €.', effect: { type: 'money', amount: 100 } },
]

// ─── Pions ──────────────────────────────────────────────────────────────────

export const TOKENS = ['Chapeau', 'Voiture', 'Bateau', 'Chien', 'Dé à coudre', 'Fer à repasser', 'Botte', 'Brouette'] as const
export type TokenName = (typeof TOKENS)[number]

export const formatMoney = (n: number) => `${n.toLocaleString('fr-FR')} €`
