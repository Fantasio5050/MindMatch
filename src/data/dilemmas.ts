export type DilemmaPack = 'classic' | 'trash' | 'spicy'

export interface Dilemma {
  id: string
  pack: DilemmaPack
  emojiA: string
  textA: string
  emojiB: string
  textB: string
}

// Les packs « classique » et « trash » sont les textes d'origine du jeu : un passage automatisé les
// avait remplacés par des gages « simulés » (sic) — hors sujet pour un jeu de vote « tu préfères ».
export const classicDilemmas: Dilemma[] = [
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

export const trashDilemmas: Dilemma[] = [
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
  { id: 'dt-25', pack: 'trash', emojiA: '🌬️', textA: 'Une puff goût paff', emojiB: '💨', textB: 'Un paff goût puff' },
]

// Pack « spicy » (18+, servi uniquement en mixte) : suggestif sans être trash.
export const spicyDilemmas: Dilemma[] = [
  { id: 'ds-1', pack: 'spicy', emojiA: '👄', textA: 'Embrasser quelqu\'un dans le cou', emojiB: '👃', textB: 'Sentir le cou de quelqu\'un et complimenter son odeur' },
  { id: 'ds-2', pack: 'spicy', emojiA: '👙', textA: 'Montrer ton maillot de bain préféré', emojiB: '👖', textB: 'Montrer tes sous-vêtements préférés (par-dessus le pantalon)' },
  { id: 'ds-3', pack: 'spicy', emojiA: '💃', textA: 'Faire un lap dance sur une chaise', emojiB: '🕺', textB: 'Danser lentement avec quelqu\'un du même sexe' },
  { id: 'ds-4', pack: 'spicy', emojiA: '👀', textA: 'Mater discrètement le décolleté de quelqu\'un', emojiB: '👃', textB: 'Sentir discrètement dans le cou de quelqu\'un' },
  { id: 'ds-5', pack: 'spicy', emojiA: '🤲', textA: 'Donner un massage des épaules de 30 secondes', emojiB: '👣', textB: 'Masser les pieds de quelqu\'un avec tes mains' },
  { id: 'ds-6', pack: 'spicy', emojiA: '👄', textA: 'Donner un bisou sur la joue à quelqu\'un', emojiB: '👅', textB: 'Lécher légèrement la joue de quelqu\'un' },
  { id: 'ds-7', pack: 'spicy', emojiA: '👙', textA: 'Essayer de ne pas rire en voyant quelqu\'un en sous-vêtements', emojiB: '👖', textB: 'Essayer de ne pas bander en voyant quelque chose de sexy' },
  { id: 'ds-8', pack: 'spicy', emojiA: '📱', textA: 'Envoyer un message légèrement suggestif à quelqu\'un', emojiB: '📸', textB: 'Prendre une photo suggestive (mais habillée) avec quelqu\'un' },
  { id: 'ds-9', pack: 'spicy', emojiA: '💃', textA: 'Danser comme si tu étais dans un clip vidéo sexy', emojiB: '🕺', textB: 'Imiter un mouvement de danse que tu considères sexy' },
  { id: 'ds-10', pack: 'spicy', emojiA: '👄', textA: 'Chuchoter quelque chose de cochon à l\'oreille de quelqu\'un', emojiB: '👂', textB: 'Laisser quelqu\'un chuchoter quelque chose à ton oreille et deviner' },
  { id: 'ds-11', pack: 'spicy', emojiA: '👀', textA: 'Dire ce que tu trouverais physiquement attirant chez quelqu\'un présent', emojiB: '💭', textB: 'Dire quel serait ton fantasme soft avec quelqu\'un présent' },
  { id: 'ds-12', pack: 'spicy', emojiA: '👕', textA: 'Enlever un vêtement (chaussette, chapeau, etc.)', emojiB: '👖', textB: 'Essayer de deviner la couleur des sous-vêtements de quelqu\'un' },
  { id: 'ds-13', pack: 'spicy', emojiA: '👃', textA: 'Complimenter l\'odeur du parfum/aftershave de quelqu\'un', emojiB: '👄', textB: 'Embrasser rapidement quelqu\'un sur la joue après un compliment' },
  { id: 'ds-14', pack: 'spicy', emojiA: '👣', textA: 'Laisser quelqu\'un te regarder enlever ta chaussure lentement', emojiB: '👄', textB: 'Embrasser le creux de la main de quelqu\'un' },
  { id: 'ds-15', pack: 'spicy', emojiA: '👙', textA: 'Montrer ton ventre et dire ce que tu aimes chez lui', emojiB: '💪', textB: 'Montrer un muscle et dire ce que tu aimes chez lui' },
  { id: 'ds-17', pack: 'spicy', emojiA: '👀', textA: 'Regarder dans les yeux de quelqu\'un pendant 20 secondes sans sourire', emojiB: '😳', textB: 'Rougir et expliquer pourquoi' },
  { id: 'ds-18', pack: 'spicy', emojiA: '👙', textA: 'Essayer de tenir un objet entre tes genoux', emojiB: '👃', textB: 'Faire croire que tu sens quelque chose d\'intéressant' },
  { id: 'ds-19', pack: 'spicy', emojiA: '👄', textA: 'Donner un baiser rapide sur les lèvres à quelqu\'un', emojiB: '🤲', textB: 'Donner un câlin amical de 5 secondes' },
  { id: 'ds-20', pack: 'spicy', emojiA: '📝', textA: 'Écrire un mot doux sur un bout de papier et le donner', emojiB: '👃', textB: 'Sentir discrètement dans les cheveux de quelqu\'un' },
  { id: 'ds-21', pack: 'spicy', emojiA: '👃', textA: 'Renifler subtilement dans le cou de quelqu\'un après un câlin', emojiB: '👄', textB: 'Embrasser quelqu\'un rapidement après qu\'il a ri' },
  { id: 'ds-22', pack: 'spicy', emojiA: '👙', textA: 'Ajuster ton vêtement de manière légèrement suggestive', emojiB: '👃', textB: 'Sentir ton propre cou et demander si ça sent bon' },
  { id: 'ds-23', pack: 'spicy', emojiA: '👄', textA: 'Proposer un jeu de regard soutenu pendant 10 secondes', emojiB: '👃', textB: 'Sentir derrière l\'oreille de quelqu\'un et complimenter' },
  { id: 'ds-24', pack: 'spicy', emojiA: '👀', textA: 'Dire quelle partie du corps tu trouves la plus sexy chez quelqu\'un', emojiB: '💭', textB: 'Décrire ton idéal de personne en 3 mots' },
  { id: 'ds-25', pack: 'spicy', emojiA: '👃', textA: 'Sentir l\'odeur de la peau de quelqu\'un après qu\'il a transpiré légèrement', emojiB: '👄', textB: 'Embrasser le front de quelqu\'un après un effort' },
  { id: 'ds-27', pack: 'spicy', emojiA: '👄', textA: 'Donner un bisou papillon (cils qui touchent la peau)', emojiB: '👃', textB: 'Sentir doucement derrière l\'oreille de quelqu\'un' },
  { id: 'ds-28', pack: 'spicy', emojiA: '👃', textA: 'Complimenter quelqu\'un sur son odeur naturelle', emojiB: '👄', textB: 'Donner un petit bisou sec sur la joue' },
  { id: 'ds-29', pack: 'spicy', emojiA: '👀', textA: 'Faire croire que tu as vu quelque chose de suggestif dans les vêtements de quelqu\'un', emojiB: '😳', textB: 'Rougir sans raison apparente et en rire' },
  { id: 'ds-30', pack: 'spicy', emojiA: '👄', textA: 'Proposer un échange de compliments physiques de 2 phrases chacun', emojiB: '👃', textB: 'Sentir discrètement dans le creux du cou de quelqu\'un' },
]

export const allDilemmas: Dilemma[] = [...classicDilemmas, ...trashDilemmas, ...spicyDilemmas]

export function dilemmasForPack(pack: DilemmaPack | 'mixed'): Dilemma[] {
  if (pack === 'mixed') return allDilemmas
  return allDilemmas.filter((dilemma) => dilemma.pack === pack)
}
