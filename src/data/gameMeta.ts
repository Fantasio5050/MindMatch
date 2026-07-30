export interface GameMeta {
  id: string
  name: string
}

export const GAME_META: Record<string, GameMeta> = {
  'who-is-most-likely': { id: 'who-is-most-likely', name: 'Qui est le plus ?' },
  dilemmas: { id: 'dilemmas', name: 'Dilemmes & Débats' },
  pyramid: { id: 'pyramid', name: 'Pyramide' },
  'secret-profile': { id: 'secret-profile', name: 'Profil secret' },
  'guess-my-answer': { id: 'guess-my-answer', name: 'Devine ma réponse' },
  'who-wrote-it': { id: 'who-wrote-it', name: 'Qui a écrit ça ?' },
  'party-cards': { id: 'party-cards', name: 'Cartes de soirée' },
  palmier: { id: 'palmier', name: 'Palmier' },
  autoroute: { id: 'autoroute', name: 'Autoroute' },
  pmu: { id: 'pmu', name: 'PMU' },
  wheel: { id: 'wheel', name: 'Roue Infernale' },
  'russian-roulette': { id: 'russian-roulette', name: 'Roulette russe' },
  blackjack: { id: 'blackjack', name: 'Blackjack' },
  blanc: { id: 'blanc', name: 'Le Grand Blanc' },
  'petits-chevaux': { id: 'petits-chevaux', name: 'Petits Chevaux' },
  'coup-de-crayon': { id: 'coup-de-crayon', name: 'Coup de Crayon' },
  intrus: { id: 'intrus', name: "L'Intrus" },
}
