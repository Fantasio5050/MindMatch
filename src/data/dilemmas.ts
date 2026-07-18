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
  { id: 'dc-13', pack: 'classic', emojiA: '✈️', textA: 'Voyager partout mais jamais deux fois au même endroit', emojiB: '🏡', textB: 'Rester dans un seul lieu que tu adores' },
  { id: 'dc-14', pack: 'classic', emojiA: '🦸', textA: 'Pouvoir voler', emojiB: '🕶️', textB: 'Être invisible à volonté' },
  { id: 'dc-15', pack: 'classic', emojiA: '🎸', textA: 'Maîtriser tous les instruments', emojiB: '🗣️', textB: 'Parler toutes les langues' },
  { id: 'dc-16', pack: 'classic', emojiA: '☀️', textA: 'Un été éternel', emojiB: '❄️', textB: 'Un hiver éternel' },
  { id: 'dc-17', pack: 'classic', emojiA: '🐶', textA: 'Comprendre les animaux', emojiB: '🌍', textB: 'Comprendre toutes les cultures humaines' },
  { id: 'dc-18', pack: 'classic', emojiA: '📚', textA: 'Lire dans les pensées', emojiB: '🔮', textB: 'Prédire l\'avenir à un jour près' },
  { id: 'dc-19', pack: 'classic', emojiA: '🍕', textA: 'Manger ce que tu veux sans conséquence', emojiB: '💤', textB: 'Ne plus jamais avoir besoin de dormir' },
  { id: 'dc-20', pack: 'classic', emojiA: '🎬', textA: 'Vivre dans ton film préféré', emojiB: '📖', textB: 'Vivre dans ton livre préféré' },
  { id: 'dc-21', pack: 'classic', emojiA: '🏅', textA: 'Être le/la meilleur·e dans un domaine', emojiB: '🌈', textB: 'Être bon·ne dans absolument tout' },
  { id: 'dc-22', pack: 'classic', emojiA: '🤖', textA: 'Un robot qui fait toutes tes corvées', emojiB: '🧑‍🍳', textB: 'Un chef privé pour tous tes repas' },
  { id: 'dc-23', pack: 'classic', emojiA: '🎢', textA: 'Une vie pleine d\'aventures et d\'imprévus', emojiB: '🛋️', textB: 'Une vie calme et parfaitement stable' },
  { id: 'dc-24', pack: 'classic', emojiA: '⭐', textA: 'Être admiré·e par des inconnus', emojiB: '💞', textB: 'Être profondément aimé·e par quelques proches' },
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
  { id: 'dt-15', pack: 'trash', emojiA: '📖', textA: 'Que ton journal intime soit lu à voix haute', emojiB: '🎥', textB: 'Que tes recherches privées passent à la télé' },
  { id: 'dt-16', pack: 'trash', emojiA: '💋', textA: 'Embrasser la personne à ta gauche', emojiB: '🍺', textB: 'Enchaîner 3 culs secs d\'affilée' },
  { id: 'dt-17', pack: 'trash', emojiA: '📱', textA: 'Prêter ton téléphone déverrouillé 1h à la table', emojiB: '👕', textB: 'Finir la soirée avec un vêtement en moins' },
  { id: 'dt-18', pack: 'trash', emojiA: '😳', textA: 'Raconter ton pire moment gênant en détail', emojiB: '🎤', textB: 'Laisser la table inventer une rumeur sur toi' },
  { id: 'dt-19', pack: 'trash', emojiA: '💸', textA: 'Rembourser toutes tes dettes mais avouer un secret', emojiB: '🤐', textB: 'Garder tes dettes ET ton secret' },
  { id: 'dt-20', pack: 'trash', emojiA: '📵', textA: 'Ne plus jamais liker personne en ligne', emojiB: '👀', textB: 'Que tout le monde voie chaque profil que tu consultes' },
  { id: 'dt-21', pack: 'trash', emojiA: '🥴', textA: 'Être toujours la personne la plus ivre de la soirée', emojiB: '😴', textB: 'Être toujours celle qui rentre en premier' },
  { id: 'dt-22', pack: 'trash', emojiA: '🗨️', textA: 'Dire tout haut ce que tu penses des gens ici', emojiB: '🎭', textB: 'Sourire et faire semblant toute la soirée' },
  { id: 'dt-23', pack: 'trash', emojiA: '🔥', textA: 'Un ex qui revient toutes les semaines', emojiB: '📵', textB: 'Ne plus jamais recroiser aucun de tes ex' },
  { id: 'dt-24', pack: 'trash', emojiA: '📷', textA: 'Que ta pire photo devienne ta photo de profil un mois', emojiB: '💬', textB: 'Que ton dernier message vocal soit posté en story' },
  { id: 'dt-25', pack: 'trash', emojiA: '🤥', textA: 'Ne plus jamais pouvoir mentir', emojiB: '🙉', textB: 'Ne plus jamais entendre la vérité' },
  { id: 'dt-26', pack: 'trash', emojiA: '🍑', textA: 'Un fond d\'écran gênant imposé par la table pendant un mois', emojiB: '📞', textB: 'Un message vocal chanté à ton crush' },
]

export function dilemmasForPack(pack: 'classic' | 'trash' | 'mixed'): Dilemma[] {
  if (pack === 'classic') return CLASSIC_DILEMMAS
  if (pack === 'trash') return TRASH_DILEMMAS
  return [...CLASSIC_DILEMMAS, ...TRASH_DILEMMAS]
}
