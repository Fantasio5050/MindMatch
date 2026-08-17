/**
 * One Word Story — Configuration et constantes
 *
 * Jeu d'histoire collaborative où chaque joueur ajoute 1 mot à tour de rôle.
 */

export const ONE_WORD_STORY_DEFAULTS = {
  /** Nombre total de mots pour terminer l'histoire (paramétrable) */
  totalWords: 30,
  /** Temps par tour en millisecondes */
  turnTimeMs: 15_000,
  /** XP gagnée par mot contribué */
  xpPerWord: 1,
  /** Longueur max d'un mot */
  maxWordLength: 30,
  /** Nombre minimum de joueurs */
  minPlayers: 3,
} as const

export type OneWordStoryConfig = {
  /** Nombre total de mots (10-100, défaut: 30) */
  totalWords?: number
}

/** Valide et normalise la configuration */
export function validateConfig(config?: OneWordStoryConfig): Required<OneWordStoryConfig> {
  return {
    totalWords: Math.max(10, Math.min(100, config?.totalWords ?? ONE_WORD_STORY_DEFAULTS.totalWords)),
  }
}

/** Métadonnées du jeu pour l'affichage dans le lobby */
export const ONE_WORD_STORY_META = {
  id: 'one-word-story',
  name: 'Histoire à un mot',
  icon: '📖',
  description:
    'Chacun son tour, ajoutez un seul mot pour construire une histoire collective. 15 secondes par mot, 30 mots au total.',
  minPlayers: ONE_WORD_STORY_DEFAULTS.minPlayers,
  maxPlayers: 12,
  estimatedDurationMinutes: 5,
  tags: ['créatif', 'collaboratif', 'rapide', 'sans-alcool', 'tout-public'],
  needsTV: false, // Recommandée mais pas obligatoire
  tvRecommended: true,
} as const