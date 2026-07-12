import type { TraitKey } from '../types'

export interface PartyQuestion {
  id: string
  text: string
  trait: TraitKey
  emoji: string
}

export const WHO_IS_MOST_LIKELY_QUESTIONS: PartyQuestion[] = [
  { id: 'wml-1', trait: 'creativity', emoji: '🎨', text: "le/la plus susceptible d'inventer une excuse complètement absurde ?" },
  { id: 'wml-2', trait: 'creativity', emoji: '🖌️', text: 'le/la plus susceptible de devenir artiste ou créateur·rice un jour ?' },
  { id: 'wml-3', trait: 'creativity', emoji: '💡', text: 'le/la plus susceptible d\'avoir une idée de génie à 3h du matin ?' },

  { id: 'wml-4', trait: 'logic', emoji: '🧩', text: 'le/la plus susceptible de gagner à un jeu de logique ?' },
  { id: 'wml-5', trait: 'logic', emoji: '🧮', text: "le/la plus susceptible de repérer l'erreur dans l'addition au restaurant ?" },
  { id: 'wml-6', trait: 'logic', emoji: '⚖️', text: 'le/la plus susceptible de convaincre tout le monde avec un argument imparable ?' },

  { id: 'wml-7', trait: 'ambition', emoji: '🌟', text: 'le/la plus susceptible de devenir célèbre ?' },
  { id: 'wml-8', trait: 'ambition', emoji: '💼', text: 'le/la plus susceptible de devenir patron·ne un jour ?' },
  { id: 'wml-9', trait: 'ambition', emoji: '💰', text: 'le/la plus susceptible de finir millionnaire ?' },

  { id: 'wml-10', trait: 'empathy', emoji: '💛', text: 'le/la plus susceptible de consoler quelqu\'un en pleine soirée ?' },
  { id: 'wml-11', trait: 'empathy', emoji: '🫂', text: 'le/la plus susceptible de deviner que tu ne vas pas bien avant même que tu le dises ?' },
  { id: 'wml-12', trait: 'empathy', emoji: '🐾', text: 'le/la plus susceptible d\'adopter tous les animaux perdus du quartier ?' },

  { id: 'wml-13', trait: 'independence', emoji: '🦅', text: "le/la plus susceptible de partir vivre à l'étranger du jour au lendemain ?" },
  { id: 'wml-14', trait: 'independence', emoji: '🚪', text: 'le/la plus susceptible de quitter la soirée sans prévenir personne ?' },
  { id: 'wml-15', trait: 'independence', emoji: '🏔️', text: 'le/la plus susceptible de vivre reclus·e dans une cabane un jour ?' },

  { id: 'wml-16', trait: 'sociability', emoji: '🎉', text: 'le/la plus susceptible de connaître tout le monde à la soirée ?' },
  { id: 'wml-17', trait: 'sociability', emoji: '📅', text: 'le/la plus susceptible d\'organiser la prochaine sortie de groupe ?' },
  { id: 'wml-18', trait: 'sociability', emoji: '🗣️', text: 'le/la plus susceptible de parler à des inconnus toute la soirée ?' },

  { id: 'wml-19', trait: 'organization', emoji: '⏰', text: 'le/la plus susceptible d\'arriver en avance à tout ?' },
  { id: 'wml-20', trait: 'organization', emoji: '📋', text: 'le/la plus susceptible d\'avoir un plan B, C et D ?' },
  { id: 'wml-21', trait: 'organization', emoji: '🧹', text: 'le/la plus susceptible de ranger la maison des autres par réflexe ?' },
]
