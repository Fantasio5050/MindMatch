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
  { id: 'dt-1', pack: 'trash', emojiA: '💼', textA: 'Coucher avec ton/ta boss pour une grosse promotion', emojiB: '🪑', textB: 'Croupir au même poste pendant 10 ans' },
  { id: 'dt-2', pack: 'trash', emojiA: '🍆', textA: 'Envoyer un nude au groupe WhatsApp de la famille', emojiB: '💼', textB: 'Envoyer « je vous emmerde tous » à ton boss' },
  { id: 'dt-3', pack: 'trash', emojiA: '👯', textA: 'Un plan à trois avec deux inconnus', emojiB: '🔒', textB: 'Le célibat total et forcé, à vie' },
  { id: 'dt-4', pack: 'trash', emojiA: '🥤', textA: 'Boire le fond de verre (bien tiède) de toute la table', emojiB: '🚽', textB: 'Lécher la lunette des chiottes du bar' },
  { id: 'dt-5', pack: 'trash', emojiA: '🔞', textA: 'Que la table regarde ta dernière recherche porno', emojiB: '📱', textB: 'Que ta mère lise tous tes DM' },
  { id: 'dt-6', pack: 'trash', emojiA: '🍑', textA: 'Te faire tatouer une bite sur la fesse à vie', emojiB: '💔', textB: 'Te faire tatouer le prénom de ton ex dans le cou' },
  { id: 'dt-7', pack: 'trash', emojiA: '🎥', textA: 'Rendre ta sextape publique', emojiB: '🎙️', textB: 'Rendre publics tous tes messages vocaux bourré·e' },
  { id: 'dt-8', pack: 'trash', emojiA: '😈', textA: "Passer une nuit avec l'ex que tu détestes le plus", emojiB: '🚱', textB: 'Ne plus jamais coucher de ta vie' },
  { id: 'dt-9', pack: 'trash', emojiA: '💨', textA: 'Péter bruyamment à chaque date pendant un an', emojiB: '🤢', textB: 'Roter au visage à chaque bisou pendant un an' },
  { id: 'dt-10', pack: 'trash', emojiA: '👅', textA: 'Rouler une pelle baveuse à la personne à ta droite', emojiB: '🥃', textB: "Enchaîner 4 culs secs d'affilée" },
  { id: 'dt-11', pack: 'trash', emojiA: '🗣️', textA: 'Avouer ton fantasme le plus honteux à voix haute', emojiB: '🎭', textB: 'Le mimer devant toute la table' },
  { id: 'dt-12', pack: 'trash', emojiA: '💋', textA: 'Coucher une seule fois avec quelqu\'un de cette table', emojiB: '🚫', textB: 'Ne plus jamais boire une goutte d\'alcool' },
  { id: 'dt-13', pack: 'trash', emojiA: '🩲', textA: 'Garder le même slip pendant une semaine entière', emojiB: '🔁', textB: 'Porter le slip déjà usagé de ton voisin une journée' },
  { id: 'dt-14', pack: 'trash', emojiA: '🤮', textA: 'Te faire vomir dessus par un parfait inconnu', emojiB: '💚', textB: 'Vomir toi-même sur la personne qui te plaît le plus' },
  { id: 'dt-15', pack: 'trash', emojiA: '📊', textA: 'Que la table note tes performances au lit sur 10', emojiB: '🍑', textB: 'Que la table classe ton physique de 1 à 10' },
  { id: 'dt-16', pack: 'trash', emojiA: '📞', textA: 'Envoyer « t\'es chaud·e ? » à TOUS tes contacts', emojiB: '✅', textB: 'Répondre « oui, carrément » à tous ceux qui te l\'envoient' },
  { id: 'dt-17', pack: 'trash', emojiA: '🖥️', textA: 'Que ton historique Pornhub s\'affiche au boulot', emojiB: '📺', textB: 'Que ta recherche Google du jour passe au JT de 20h' },
  { id: 'dt-18', pack: 'trash', emojiA: '🍆', textA: 'Un suçon énorme dans le cou le jour d\'un mariage', emojiB: '🤢', textB: 'Une belle trace de gerbe sur ta tenue au même mariage' },
  { id: 'dt-19', pack: 'trash', emojiA: '🗒️', textA: 'Raconter ton pire plan cul dans les moindres détails', emojiB: '🎤', textB: 'Laisser ton ex le raconter à ta place' },
  { id: 'dt-20', pack: 'trash', emojiA: '🥵', textA: 'Prendre 5 kg uniquement au bide', emojiB: '🧴', textB: 'Perdre toute pilosité, partout, définitivement' },
  { id: 'dt-21', pack: 'trash', emojiA: '🚓', textA: 'Finir la nuit à poil dans la rue', emojiB: '🔗', textB: 'Finir la nuit menotté·e au poste' },
  { id: 'dt-22', pack: 'trash', emojiA: '👀', textA: 'Que ton crush voie combien de fois tu as stalké son profil', emojiB: '❤️', textB: 'Que ton ex voie toute ta liste de « j\'aime » cachée' },
  { id: 'dt-23', pack: 'trash', emojiA: '😷', textA: 'Choper une chtouille mais sans le dire', emojiB: '🗣️', textB: 'Le dire à tout le monde mais ne rien avoir' },
  { id: 'dt-24', pack: 'trash', emojiA: '🍌', textA: 'Manger une banane de façon très gênante devant belle-maman', emojiB: '💃', textB: 'Faire un twerk pour ton beau-père au repas de famille' },
]

export function dilemmasForPack(pack: 'classic' | 'trash' | 'mixed'): Dilemma[] {
  if (pack === 'classic') return CLASSIC_DILEMMAS
  if (pack === 'trash') return TRASH_DILEMMAS
  return [...CLASSIC_DILEMMAS, ...TRASH_DILEMMAS]
}
