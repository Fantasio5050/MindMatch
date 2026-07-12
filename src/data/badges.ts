export interface BadgeDef {
  id: string
  name: string
  emoji: string
  description: string
}

export const BADGES: BadgeDef[] = [
  {
    id: 'strategist',
    name: 'Le Stratège',
    emoji: '🧠',
    description: 'Gagne des débats et des choix difficiles grâce à sa logique.',
  },
  {
    id: 'creative',
    name: 'Le Créatif',
    emoji: '🎨',
    description: 'Élu·e la personne la plus créative du groupe, encore et encore.',
  },
  {
    id: 'diplomat',
    name: 'Le Diplomate',
    emoji: '🕊️',
    description: 'Sait désamorcer les tensions et rassembler les votes de tout le monde.',
  },
  {
    id: 'leader',
    name: 'Le Leader',
    emoji: '👑',
    description: 'La personne vers qui le groupe se tourne le plus souvent.',
  },
  {
    id: 'chaos',
    name: 'Le Chaos Ambulant',
    emoji: '🌪️',
    description: 'Totalement imprévisible — personne ne sait jamais ce qui va sortir.',
  },
  {
    id: 'bluffer',
    name: 'Le Bluffeur',
    emoji: '🎭',
    description: 'Trompe le groupe avec un aplomb redoutable.',
  },
]

export const BADGE_MAP: Record<string, BadgeDef> = BADGES.reduce(
  (acc, b) => ({ ...acc, [b.id]: b }),
  {} as Record<string, BadgeDef>,
)
