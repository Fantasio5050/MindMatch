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
}
