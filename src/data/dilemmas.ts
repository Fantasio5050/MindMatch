export type DilemmaPack = 'classic' | 'trash'

export interface Dilemma {
  id: string
  pack: DilemmaPack
  emojiA: string
  textA: string
  emojiB: string
  textB: string
}

export const CLASSIC_DILEMMAS: Dilemma[] = [
  { id: 'dc-1', pack: 'classic', emojiA: '🔮', textA: 'Connaître ton futur', emojiB: '⏪', textB: 'Pouvoir changer ton passé' },
  { id: 'dc-2', pack: 'classic', emojiA: '🗣️', textA: 'Toujours dire la vérité, quitte à être détesté·e', emojiB: '🎭', textB: 'Mentir en étant aimé·e de tous' },
  { id: 'dc-3', pack: 'classic', emojiA: '🧠', textA: 'Perdre tous tes souvenirs', emojiB: '🚫', textB: 'Ne plus jamais en créer de nouveaux' },
  { id: 'dc-4', pack: 'classic', emojiA: '🏝️', textA: 'Vivre 1000 ans seul·e', emojiB: '👨‍👩‍👧', textB: 'Vivre 60 ans entouré·e' },
  { id: 'dc-5', pack: 'classic', emojiA: '💰', textA: 'Être riche et seul·e', emojiB: '🤝', textB: 'Être pauvre et entouré·e' },
  { id: 'dc-6', pack: 'classic', emojiA: '🔁', textA: 'Revivre ta vie en sachant tout', emojiB: '🌱', textB: 'Découvrir une toute nouvelle vie' },
  { id: 'dc-7', pack: 'classic', emojiA: '🧭', textA: 'Tout savoir sur tout', emojiB: '🕊️', textB: "Pouvoir tout oublier à volonté" },
  { id: 'dc-8', pack: 'classic', emojiA: '😐', textA: 'Un ami loyal mais sans humour', emojiB: '😂', textB: 'Un ami drôle mais peu fiable' },
  { id: 'dc-9', pack: 'classic', emojiA: '💼', textA: 'Sacrifier ta carrière pour l\'amour', emojiB: '❤️', textB: 'Sacrifier l\'amour pour ta carrière' },
  { id: 'dc-10', pack: 'classic', emojiA: '🏙️', textA: 'Vivre en ville toute ta vie', emojiB: '🌲', textB: 'Vivre isolé·e en pleine nature' },
  { id: 'dc-11', pack: 'classic', emojiA: '🎯', textA: 'Réussir seul·e, sans reconnaissance', emojiB: '👥', textB: 'Réussir en équipe, sans en avoir le mérite' },
  { id: 'dc-12', pack: 'classic', emojiA: '🕰️', textA: 'Avoir plus de temps libre', emojiB: '💶', textB: 'Avoir plus d\'argent' },
]

export const TRASH_DILEMMAS: Dilemma[] = [
  { id: 'dt-1', pack: 'trash', emojiA: '💔', textA: "Coucher avec le pire ex de ton/ta meilleur·e ami·e", emojiB: '🔒', textB: 'Rester célibataire à vie' },
  { id: 'dt-2', pack: 'trash', emojiA: '🔍', textA: 'Que tout le monde voie ton historique de recherche', emojiB: '💬', textB: 'Que tout le monde lise tes messages privés' },
  { id: 'dt-3', pack: 'trash', emojiA: '🤑', textA: 'Trahir ton/ta meilleur·e ami·e pour 1 million d\'euros, anonymement', emojiB: '🙅', textB: 'Rester fauché·e mais loyal·e' },
  { id: 'dt-4', pack: 'trash', emojiA: '🖋️', textA: 'Un tatouage raté et visible à vie', emojiB: '🤡', textB: 'Un surnom ridicule à vie, partout' },
  { id: 'dt-5', pack: 'trash', emojiA: '🌟', textA: 'Être ruiné·e mais célèbre', emojiB: '👻', textB: 'Être riche mais oublié·e de tous' },
  { id: 'dt-6', pack: 'trash', emojiA: '🎯', textA: 'Entendre la vérité brutale de chaque ami·e sur toi, une fois', emojiB: '🤐', textB: 'Ne jamais savoir ce qu\'ils pensent vraiment' },
  { id: 'dt-7', pack: 'trash', emojiA: '🚫', textA: 'Ne plus jamais avoir de vie intime', emojiB: '🍽️', textB: 'Ne plus jamais manger ton plat préféré' },
  { id: 'dt-8', pack: 'trash', emojiA: '😬', textA: 'Dire le fond de ta pensée à chaque personne ici, une seule fois', emojiB: '🎭', textB: 'Rester poli·e pour toujours, même en mentant' },
  { id: 'dt-9', pack: 'trash', emojiA: '📢', textA: 'Revivre ton pire souvenir en boucle mais seul·e à t\'en souvenir', emojiB: '🌐', textB: 'L\'oublier, mais que tout le monde d\'autre s\'en souvienne' },
  { id: 'dt-10', pack: 'trash', emojiA: '🤪', textA: 'Perdre toute dignité pour un fou rire général', emojiB: '🗿', textB: 'Rester digne et invisible toute la soirée' },
  { id: 'dt-11', pack: 'trash', emojiA: '📝', textA: 'Avouer ton plus gros mensonge à la personne concernée, maintenant', emojiB: '🔐', textB: 'Le garder secret pour toujours' },
  { id: 'dt-12', pack: 'trash', emojiA: '🔄', textA: 'Échanger de vie avec ton/ta voisin·e de droite pendant une semaine', emojiB: '🙋', textB: 'Rester toi-même, quoi qu\'il arrive' },
  { id: 'dt-13', pack: 'trash', emojiA: '📸', textA: 'Que ton pire selfie devienne viral', emojiB: '📵', textB: 'Perdre tous tes souvenirs en photo' },
  { id: 'dt-14', pack: 'trash', emojiA: '🍾', textA: "Faire le pire karaoké de ta vie devant tout le monde", emojiB: '🤫', textB: 'Ne plus jamais chanter, même sous la douche' },
]

export function dilemmasForPack(pack: 'classic' | 'trash' | 'mixed'): Dilemma[] {
  if (pack === 'classic') return CLASSIC_DILEMMAS
  if (pack === 'trash') return TRASH_DILEMMAS
  return [...CLASSIC_DILEMMAS, ...TRASH_DILEMMAS]
}
