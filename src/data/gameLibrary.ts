/** Catalogue des jeux pour l'UI « console » du salon : jaquette (icône + teinte), pitch, pré-requis
 * et options de config. La logique de jeu vit côté serveur (server/games/registry.ts) — ici c'est
 * uniquement la vitrine. `tvOptimized` = l'affichage TV est fortement conseillé (le jeu est pensé
 * pour), mais JAMAIS obligatoire : tous les jeux restent jouables téléphone seul. */

export interface GameLibraryEntry {
  id: string
  icon: string
  name: string
  tagline: string
  /** Teinte de la jaquette (couleur de base du dégradé). */
  hue: string
  minPlayers: number
  /** Nombre de joueurs ayant terminé le test de personnalité requis. */
  quizFinishedNeed?: number
  adult?: boolean
  tvOptimized?: boolean
  /** Petit label spécial affiché sur la jaquette (ex. HARDCORE, 3D TV). */
  badge?: string
  /** Options à afficher avant lancement. */
  config?: 'pack' | 'autoroute'
}

export const GAME_LIBRARY: GameLibraryEntry[] = [
  // --- Pour tout le monde ---
  { id: 'who-is-most-likely', icon: '🎯', name: 'Qui est le plus ?', tagline: 'Votes anonymes, révélations en direct', hue: '#a855f7', minPlayers: 3 },
  { id: 'blackjack', icon: '🃏', name: 'Blackjack', tagline: 'Battez le croupier — jetons ou gorgées en 18+', hue: '#10b981', minPlayers: 2 },
  { id: 'dilemmas', icon: '⚖️', name: 'Dilemmes & Débats', tagline: 'Le groupe vote, on regarde qui penche où', hue: '#f59e0b', minPlayers: 2, config: 'pack' },
  { id: 'party-cards', icon: '🎴', name: 'Cartes de soirée', tagline: 'Action, vérité, défi — à tour de rôle', hue: '#fb7185', minPlayers: 2, config: 'pack' },
  { id: 'who-wrote-it', icon: '✍️', name: 'Qui a écrit ça ?', tagline: 'Écrivez, mélangez, démasquez les auteurs', hue: '#38bdf8', minPlayers: 3 },
  { id: 'guess-my-answer', icon: '🕵️', name: 'Devine ma réponse', tagline: "Devinez ce qu'un·e ami·e a répondu au test", hue: '#2dd4bf', minPlayers: 3, quizFinishedNeed: 1 },
  { id: 'secret-profile', icon: '🔍', name: 'Profil secret', tagline: 'Des indices sur les traits, devinez qui c\'est', hue: '#818cf8', minPlayers: 3, quizFinishedNeed: 2 },
  // --- 18+ ---
  { id: 'blanc', icon: '🖊️', name: 'Le Grand Blanc', tagline: 'Cartes à trous trash — votez la plus drôle', hue: '#e2e8f0', minPlayers: 3, adult: true, tvOptimized: true },
  { id: 'petits-chevaux', icon: '🐴', name: 'Petits Chevaux', tagline: 'Dé, captures, cases à boire et gages', hue: '#ca8a04', minPlayers: 2, adult: true, tvOptimized: true },
  { id: 'pyramid', icon: '🍻', name: 'Pyramide', tagline: 'Bluff, cartes et cul sec au sommet', hue: '#d946ef', minPlayers: 2, adult: true, tvOptimized: true },
  { id: 'palmier', icon: '🌴', name: 'Palmier', tagline: 'Le Cercle — 52 cartes, verre central', hue: '#84cc16', minPlayers: 2, adult: true, tvOptimized: true },
  { id: 'autoroute', icon: '🛣️', name: 'Autoroute', tagline: 'Plus haut/bas, rouge/noir… et des péages', hue: '#f97316', minPlayers: 2, adult: true, config: 'autoroute' },
  { id: 'pmu', icon: '🏇', name: 'PMU', tagline: 'Pariez vos gorgées, la course se joue en 3D', hue: '#22c55e', minPlayers: 2, adult: true, tvOptimized: true, badge: '3D TV' },
  { id: 'wheel', icon: '🎡', name: 'Roue Infernale', tagline: 'Swipe, gages, gorgées, immunités', hue: '#8b5cf6', minPlayers: 2, adult: true, tvOptimized: true, badge: '3D TV' },
  { id: 'russian-roulette', icon: '🔫', name: 'Roulette russe', tagline: 'Barillet, probas qui montent, gages hardcore', hue: '#ef4444', minPlayers: 2, adult: true, badge: 'HARDCORE' },
]
