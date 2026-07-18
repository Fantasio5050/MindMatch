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

  { id: 'wml-22', trait: 'creativity', emoji: '📖', text: "le/la plus susceptible d'écrire un livre un jour ?" },
  { id: 'wml-23', trait: 'creativity', emoji: '🎭', text: 'le/la plus susceptible de transformer une anecdote banale en histoire épique ?' },
  { id: 'wml-24', trait: 'creativity', emoji: '🛠️', text: 'le/la plus susceptible de bricoler un truc improbable qui marche quand même ?' },

  { id: 'wml-25', trait: 'logic', emoji: '🕵️', text: 'le/la plus susceptible de résoudre une énigme avant tout le monde ?' },
  { id: 'wml-26', trait: 'logic', emoji: '♟️', text: 'le/la plus susceptible de gagner une partie d\'échecs sans jamais y avoir joué ?' },
  { id: 'wml-27', trait: 'logic', emoji: '🤓', text: 'le/la plus susceptible de corriger tout le monde sur un détail technique ?' },

  { id: 'wml-28', trait: 'ambition', emoji: '🏆', text: 'le/la plus susceptible de tout faire pour gagner, même à un jeu de société ?' },
  { id: 'wml-29', trait: 'ambition', emoji: '🚀', text: 'le/la plus susceptible de lancer sa propre startup ?' },
  { id: 'wml-30', trait: 'ambition', emoji: '🎤', text: 'le/la plus susceptible de passer à la télé un jour ?' },

  { id: 'wml-31', trait: 'empathy', emoji: '🤝', text: 'le/la plus susceptible de se réconcilier deux amis fâchés ?' },
  { id: 'wml-32', trait: 'empathy', emoji: '☎️', text: "le/la plus susceptible de répondre au téléphone à 3h pour écouter un·e ami·e ?" },
  { id: 'wml-33', trait: 'empathy', emoji: '🎁', text: 'le/la plus susceptible de retenir la date d\'anniversaire de tout le monde ?' },

  { id: 'wml-34', trait: 'independence', emoji: '🧳', text: 'le/la plus susceptible de voyager seul·e à l\'autre bout du monde ?' },
  { id: 'wml-35', trait: 'independence', emoji: '🍽️', text: 'le/la plus susceptible d\'aller au restaurant ou au ciné tout·e seul·e sans gêne ?' },
  { id: 'wml-36', trait: 'independence', emoji: '🙅', text: 'le/la plus susceptible de dire non sans culpabiliser ?' },

  { id: 'wml-37', trait: 'sociability', emoji: '💃', text: 'le/la plus susceptible de lancer la piste de danse ?' },
  { id: 'wml-38', trait: 'sociability', emoji: '📸', text: 'le/la plus susceptible d\'apparaître dans les stories de tout le monde ?' },
  { id: 'wml-39', trait: 'sociability', emoji: '🍻', text: 'le/la plus susceptible de se faire un nouvel ami au bar en 5 minutes ?' },

  { id: 'wml-40', trait: 'organization', emoji: '🧾', text: 'le/la plus susceptible de gérer les comptes du groupe en voyage ?' },
  { id: 'wml-41', trait: 'organization', emoji: '📱', text: 'le/la plus susceptible d\'avoir un agenda partagé avec code couleur ?' },
  { id: 'wml-42', trait: 'organization', emoji: '🎒', text: 'le/la plus susceptible d\'avoir toujours un pansement ou un chargeur sur soi ?' },
]
