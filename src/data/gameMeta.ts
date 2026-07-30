export interface GameMeta {
  id: string
  name: string
  icon: string
}

export const GAME_META: Record<string, GameMeta> = {
  'who-is-most-likely': { id: 'who-is-most-likely', name: 'Qui est le plus ?', icon: '🎯' },
  dilemmas: { id: 'dilemmas', name: 'Dilemmes & Débats', icon: '⚖️' },
  pyramid: { id: 'pyramid', name: 'Pyramide', icon: '🍻' },
  'secret-profile': { id: 'secret-profile', name: 'Profil secret', icon: '🔍' },
  'guess-my-answer': { id: 'guess-my-answer', name: 'Devine ma réponse', icon: '🕵️' },
  'who-wrote-it': { id: 'who-wrote-it', name: 'Qui a écrit ça ?', icon: '✍️' },
  'party-cards': { id: 'party-cards', name: 'Cartes de soirée', icon: '🃏' },
  palmier: { id: 'palmier', name: 'Palmier', icon: '🌴' },
  autoroute: { id: 'autoroute', name: 'Autoroute', icon: '🛣️' },
  pmu: { id: 'pmu', name: 'PMU', icon: '🏇' },
  wheel: { id: 'wheel', name: 'Roue Infernale', icon: '🎡' },
  'russian-roulette': { id: 'russian-roulette', name: 'Roulette russe', icon: '🔫' },
  blackjack: { id: 'blackjack', name: 'Blackjack', icon: '🃏' },
  blanc: { id: 'blanc', name: 'Le Grand Blanc', icon: '🖊️' },
  'petits-chevaux': { id: 'petits-chevaux', name: 'Petits Chevaux', icon: '🐴' },
  'coup-de-crayon': { id: 'coup-de-crayon', name: 'Coup de Crayon', icon: '🖍️' },
  intrus: { id: 'intrus', name: "L'Intrus", icon: '🕵️' },
}
