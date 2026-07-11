import type { TraitKey } from '../types'

export interface DebateTemplate {
  theme: string
  question: string
  poleHigh: string
  poleLow: string
}

export const DEBATE_TEMPLATES: Record<TraitKey, DebateTemplate> = {
  independence: {
    theme: 'la réussite',
    question: 'Vaut-il mieux chercher la stabilité ou la liberté ?',
    poleHigh: 'la liberté',
    poleLow: 'la stabilité',
  },
  organization: {
    theme: "l'équilibre de vie",
    question: "Vaut-il mieux tout planifier ou se laisser porter par l'imprévu ?",
    poleHigh: 'la planification',
    poleLow: "l'improvisation",
  },
  ambition: {
    theme: 'la réussite personnelle',
    question: 'Vaut-il mieux viser toujours plus haut ou savourer ce que l\'on a déjà ?',
    poleHigh: 'viser plus haut',
    poleLow: 'apprécier l\'instant',
  },
  empathy: {
    theme: 'les relations',
    question: 'Vaut-il mieux dire la vérité quitte à blesser, ou protéger les sentiments des autres ?',
    poleHigh: 'protéger les sentiments',
    poleLow: 'dire la vérité',
  },
  creativity: {
    theme: 'les choix de vie',
    question: 'Vaut-il mieux suivre sa passion, même risquée, ou choisir la voie la plus sûre ?',
    poleHigh: 'suivre sa passion',
    poleLow: 'choisir la sécurité',
  },
  sociability: {
    theme: "l'énergie sociale",
    question: 'Vaut-il mieux se ressourcer seul ou entouré des autres ?',
    poleHigh: 'entouré des autres',
    poleLow: 'seul',
  },
  logic: {
    theme: 'les décisions',
    question: 'Vaut-il mieux décider avec la tête ou avec le cœur ?',
    poleHigh: 'avec la tête',
    poleLow: 'avec le cœur',
  },
}
