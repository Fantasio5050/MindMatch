import type { Archetype, TraitKey } from '../types'

export const ARCHETYPES: Record<TraitKey, Archetype> = {
  creativity: {
    id: 'creativity',
    name: "L'Explorateur Créatif",
    emoji: '🎨',
    tagline: "Voit des possibilités là où d'autres voient des règles",
    description:
      "Tu perçois le monde comme un terrain de jeu infini. Ton imagination trouve des chemins que personne n'avait envisagés, et tu préfères souvent inventer une solution plutôt que copier celle qui existe déjà.",
  },
  logic: {
    id: 'logic',
    name: 'Le Stratège',
    emoji: '🧠',
    tagline: 'Analyse avant d\'agir, décide avec la tête froide',
    description:
      "Tu abordes la vie comme un système à comprendre. Les faits et la cohérence te rassurent, et tu es souvent celui ou celle qui pose la question qui remet tout en perspective.",
  },
  ambition: {
    id: 'ambition',
    name: 'Le Conquérant',
    emoji: '🚀',
    tagline: 'Toujours un objectif d\'avance',
    description:
      "Tu avances avec un moteur intérieur difficile à éteindre. Stagner te pèse plus que l'échec lui-même, et tu préfères viser haut quitte à recommencer plutôt que de ne jamais essayer.",
  },
  empathy: {
    id: 'empathy',
    name: 'Le Cœur Sincère',
    emoji: '💛',
    tagline: 'Comprend les gens avant qu\'ils ne parlent',
    description:
      "Tu ressens ce que vivent les autres presque comme si c'était toi. Cette sensibilité fait de toi un pilier pour ton entourage, celui ou celle vers qui on se tourne dans les moments importants.",
  },
  independence: {
    id: 'independence',
    name: 'Le Franc-Tireur',
    emoji: '🦅',
    tagline: 'Trace sa route, sans demander la permission',
    description:
      "Ta liberté n'est pas négociable. Tu avances à ton rythme, selon tes propres règles, et tu préfères une vérité inconfortable à un confort qui t'enferme.",
  },
  sociability: {
    id: 'sociability',
    name: 'Le Fédérateur',
    emoji: '✨',
    tagline: 'Le groupe s\'anime dès que tu arrives',
    description:
      "Tu te ressources dans le lien avec les autres. Ton énergie sociale rassemble, apaise les tensions et donne à chaque groupe l'impression d'être un peu plus vivant.",
  },
  organization: {
    id: 'organization',
    name: "L'Architecte",
    emoji: '📐',
    tagline: 'Construit calmement ce que les autres improvisent',
    description:
      "Tu transformes le chaos en plan clair. La rigueur n'est pas une contrainte pour toi, c'est ce qui te permet d'aller loin sans jamais perdre le fil.",
  },
}

export const SECONDARY_CLAUSES: Record<TraitKey, string> = {
  creativity: "avec un vrai grain de folie créative qui surprend ton entourage",
  logic: "que tu tempères toujours d'une bonne dose de logique",
  ambition: "porté par une ambition qui ne demande qu'à s'exprimer",
  empathy: "adouci par une empathie sincère envers les autres",
  independence: "avec un besoin d'indépendance qui structure tes choix",
  sociability: "et une aisance sociale qui met les autres à l'aise",
  organization: "appuyé par un sens de l'organisation qui rassure ton entourage",
}

export const GROWTH_CLAUSES: Record<TraitKey, string> = {
  creativity: "t'autoriser un peu plus de spontanéité pourrait t'ouvrir de nouvelles portes",
  logic: "prendre parfois plus de recul analytique t'éviterait certains détours",
  ambition: "te fixer des objectifs plus ambitieux pourrait libérer un potentiel que tu sous-estimes",
  empathy: "prendre le temps d'écouter davantage les émotions des autres enrichirait tes relations",
  independence: "apprendre à lâcher un peu de contrôle pourrait t'alléger",
  sociability: "t'ouvrir un peu plus aux autres pourrait multiplier tes opportunités",
  organization: "un peu plus de structure dans ton quotidien t'aiderait à concrétiser tes idées",
}
