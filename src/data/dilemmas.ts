export type DilemmaPack = 'classic' | 'trash' | 'spicy'
export interface Dilemma { id: string; pack: DilemmaPack; emojiA: string; textA: string; emojiB: string; textB: string }

// Classic dilemmas (dc-1 to dc-50)
export const classicDilemmas: Dilemma[] = [
  { id: 'dc-1', pack: 'classic', emojiA: '🍷', textA: 'Boire un verre d\'alcool fort d\'un coup', emojiB: '🍻', textB: 'Chugger une bière entière' },
  { id: 'dc-2', pack: 'classic', emojiA: '💋', textA: 'Embrasser quelqu\'un sur la bouche', emojiB: '🤲', textB: 'Donner un high-five à tout le monde' },
  { id: 'dc-3', pack: 'classic', emojiA: '📱', textA: 'Lire le dernier message de ton ex à voix haute', emojiB: '📞', textB: 'Appeler un numéro au hasard et raconter une blague' },
  { id: 'dc-4', pack: 'classic', emojiA: '🕺', textA: 'Faire un strip-tease de 10 secondes', emojiB: '💃', textB: 'Danser comme si personne ne regardait' },
  { id: 'dc-5', pack: 'classic', emojiA: '🍽️', textA: 'Manger quelque chose par terre (propre)', emojiB: '🤢', textB: 'Boire un mélange dégueulasse préparé par le groupe' },
  { id: 'dc-6', pack: 'classic', emojiA: '👗', textA: 'Porter un vêtement du sexe opposé pendant 10 min', emojiB: '👠', textB: 'Mettre des talons hauts et marcher dans la pièce' },
  { id: 'dc-7', pack: 'classic', emojiA: '🎤', textA: 'Chanter le refrain d\'une chanson d\'amour', emojiB: '😳', textB: 'Faire son plus gros complexe devant tout le monde' },
  { id: 'dc-8', pack: 'classic', emojiA: '👀', textA: 'Matéral quelqu\'un dans les yeux pendant 1 min sans rire', emojiB: '😴', textB: 'Faire semblant de dormir jusqu\'au prochain tour' },
  { id: 'dc-9', pack: 'classic', emojiA: '📸', textA: 'Prendre un selfie avec le téléphone de quelqu\'un d\'autre', emojiB: '👻', textB: 'Faire le fantôme derrière quelqu\'un pendant 15 sec' },
  { id: 'dc-10', pack: 'classic', emojiA: '🚫', textA: 'Ne pas parler pendant 3 tours consécutifs', emojiB: '🔊', textB: 'Dire tout ce qui te passe par la tête pendant 30 sec' },
  { id: 'dc-11', pack: 'classic', emojiA: '👣', textA: 'Marcher à quatre pattes jusqu\'à la salle de bain', emojiB: '🐒', textB: 'Imiter un singe pendant 20 secondes' },
  { id: 'dc-12', pack: 'classic', emojiA: '🧂', textA: 'Lécher de la sel du bras de quelqu\'un', emojiB: '🍯', textB: 'Mettre du miel sur le nez et attendre qu\'une mouche se pose' },
  { id: 'dc-13', pack: 'classic', emojiA: '🎭', textA: 'Faire une déclaration d\'amour à une plante', emojiB: '🤖', textB: 'Parler comme un robot pendant le prochain tour' },
  { id: 'dc-14', pack: 'classic', emojiA: '👃', textA: 'Sentir les chaussettes de quelqu\'un et donner ton avis', emojiB: '👂', textB: 'Ecouter attentivement quelqu\'un respirer pendant 30 sec' },
  { id: 'dc-15', pack: 'classic', emojiA: '🤪', textA: 'Faire le visage le plus bête possible', emojiB: '😘', textB: 'Envoyer un bisou volant à la personne de ton choix' },
  { id: 'dc-16', pack: 'classic', emojiA: '🧠', textA: 'Raconter ton plus gros échec honteux', emojiB: '💭', textB: 'Dire ce que tu penserais si tu étais invisible pendant 1h' },
  { id: 'dc-17', pack: 'classic', emojiA: '🥃', textA: 'Faire un cul-sec sans les mains', emojiB: '🥤', textB: 'Boire un verre avec une paille... dans le nez' },
  { id: 'dc-18', pack: 'classic', emojiA: '👯', textA: 'Faire un duo improvisé avec quelqu\'un', emojiB: '🎪', textB: 'Frer un numéro de cirque absolument inutile' },
  { id: 'dc-19', pack: 'classic', emojiA: '📝', textA: 'Écrire ton numéro de téléphone sur le front de quelqu\'un', emojiB: '🧼', textB: 'Se laver les mains avec de l\'eau pétillante' },
  { id: 'dc-20', pack: 'classic', emojiA: '🌶️', textA: 'Manger quelque chose de très épicé', emojiB: '❄️', textB: 'Mettre un glaçon dans ton slip pendant 1 min' },
  { id: 'dc-21', pack: 'classic', emojiA: '🚪', textA: 'Toquer chez les voisins et demander du sucre', emojiB: '🚨', textB: 'Faire croire qu\'il y a une fuite de gaz' },
  { id: 'dc-22', pack: 'classic', emojiA: '👑', textA: 'Se déclarer roi/reine de la soirée jusqu\'à la fin', emojiB: '🤡', textB: 'Devenir le bouffon officiel du groupe' },
  { id: 'dc-23', pack: 'classic', emojiA: '🔇', textA: 'Faire semblant d\'être muet jusqu\'au prochain dilemme', emojiB: '📢', textB: 'Crier comme un fou pendant 10 secondes' },
  { id: 'dc-24', pack: 'classic', emojiA: '🎲', textA: 'Lancer un défi à quelqu\'un de faire un vœu stupide', emojiB: '🤞', textB: 'Promettre quelque chose que tu ne feras jamais' },
  { id: 'dc-25', pack: 'classic', emojiA: '🎪', textA: 'Fréer comme un phoque pendant 15 secondes', emojiB: '🤸', textB: 'Faire une roue (ou essayer)' },
  { id: 'dc-26', pack: 'classic', emojiA: '🍌', textA: 'Éplucher une banane avec les pieds', emojiB: '👄', textB: 'Siffler sans utiliser tes mains' },
  { id: 'dc-27', pack: 'classic', emojiA: '👂', textA: 'Laisser quelqu\'un te couper une mèche de cheveux', emojiB: '🎨', textB: 'Se faire dessiner une moustache au marqueur' },
  { id: 'dc-28', pack: 'classic', emojiA: '🧃', textA: 'Boire un verre d\'eau salée', emojiB: '☕', textB: 'Boire ton café/thé avec une cuillère à soupe de sel' },
  { id: 'dc-29', pack: 'classic', emojiA: '🤝', textA: 'Faire un pacte bizarre avec quelqu\'un', emojiB: '🤷', textB: 'Shrugger comme si tu en avais rien à battre' },
  { id: 'dc-30', pack: 'classic', emojiA: '👻', textA: 'Faire croire que tu es possédé pendant 30 sec', emojiB: '😇', textB: 'Prétendre être un ange tombé du ciel' },
  { id: 'dc-31', pack: 'classic', emojiA: '👠', textA: 'Marcher comme un mannequin sur un podium imaginaire', emojiB: '🦶', textB: 'Marche sur les talons comme un canard' },
  { id: 'dc-32', pack: 'classic', emojiA: '📻', textA: 'Imiter la voix d\'un présentateur météo dramatique', emojiB: '📺', textB: 'Faire la publicité d\'un produit totalement inutile' },
  { id: 'dc-33', pack: 'classic', emojiA: '🧊', textA: 'Tenir un glaçon dans ta main fermée le plus longtemps possible', emojiB: '🔥', textB: 'Faire comme si tu avais extrêmement chaud' },
  { id: 'dc-34', pack: 'classic', emojiA: '🎯', textA: 'Lancer un doigt en l\'air et désigner quelqu\'un pour un gage', emojiB: '🤚', textB: 'Faire un high-five tout en tournant sur toi-même' },
  { id: 'dc-35', pack: 'classic', emojiA: '👅', textA: 'Goûter quelque chose que tu n\'as jamais goûté de la vie', emojiB: '👃', textB: 'Essayer de deviner quelque chose avec les yeux bandés juste en sentant' },
  { id: 'dc-36', pack: 'classic', emojiA: '📿', textA: 'Faire un voeux sérieux en touchant du bois', emojiB: '🤞', textB: 'Croiser les doigts pour quelque chose de totalement idiot' },
  { id: 'dc-37', pack: 'classic', emojiA: '👠', textA: 'Essayer de mettre une chaussette avec tes mains dans le dos', emojiB: '🤸', textB: 'Essayer de toucher tes orteils sans plier les genoux' },
  { id: 'dc-38', pack: 'classic', emojiA: '🍕', textA: 'Manger une part de pizza sans utiliser tes mains', emojiB: '🥪', textB: 'Faire un sandwich avec ce que tu trouves dans tes poches' },
  { id: 'dc-39', pack: 'classic', emojiA: '🧘', textA: 'Faire la position du lotus et réciter un mantra stupide', emojiB: '💃', textB: 'Danser le moonwalk jusqu\'au mur opposé' },
  { id: 'dc-40', pack: 'classic', emojiA: '👂', textA: 'Laisser quelqu\'un choisir une chanson pour toi que tu dois aimer', emojiB: '🚫', textB: 'Interdire à quelqu\'un de parler pendant 2 minutes' },
  { id: 'dc-41', pack: 'classic', emojiA: '🎭', textA: 'Jouer une scène où tu announces une mauvaise nouvelle dramatique', emojiB: '😂', textB: 'Rire de façon incontrôlable pendant 20 secondes sans raison' },
  { id: 'dc-42', pack: 'classic', emojiA: '👠', textA: 'Parler avec un accent étranger exagéré pendant 3 tours', emojiB: '🗣️', textB: 'Ne communiquer que par onomatopées pendant 2 minutes' },
  { id: 'dc-43', pack: 'classic', emojiA: '🍯', textA: 'Essayer de ne pas rire pendant que quelqu\'un te chatouille', emojiB: '🤭', textB: 'Essayer de faire rire quelqu\'un sans le toucher' },
  { id: 'dc-44', pack: 'classic', emojiA: '🧳', textA: 'Faire semblant de faire tes valises pour un voyage imprévu', emojiB: '🏃', textB: 'Sprint sur place pendant 10 secondes comme si tu étais poursuivi' },
  { id: 'dc-45', pack: 'classic', emojiA: '👑', textA: 'Donner un ordre complètement absurde à quelqu\'un qui doit l\'obéir', emojiB: '🙏', textB: 'Faire une prière improvisée pour quelque chose de futile' },
  { id: 'dc-46', pack: 'classic', emojiA: '📱', textA: 'Envoyer un message vocal dramatique à quelqu\'un du groupe', emojiB: '📵', textB: 'Faire semblant que ton téléphone est éteint pendant 5 minutes' },
  { id: 'dc-47', pack: 'classic', emojiA: '🔍', textA: 'Chercher quelque chose que tu as \"perdu\" en faisant exprès d\'être dramatique', emojiB: '🎪', textB: 'Faire croire que tu es un directeur de cirque inspectant sa tente' },
  { id: 'dc-48', pack: 'classic', emojiA: '🍴', textA: 'Manger quelque chose avec les ustensiles complètement à l\'envers', emojiB: '🤲', textB: 'Manger quelque chose avec uniquement tes mains derrière le dos' },
  { id: 'dc-49', pack: 'classic', emojiA: '🎪', textA: 'Essayer de vendre quelque chose de totalement inutile avec passion', emojiB: '👻', textB: 'Faire croire que tu es habité par l\'esprit d\'un comédien raté' },
  { id: 'dc-50', pack: 'classic', emojiA: '🤷', textA: 'Dire \"je sais pas\" à toutes les questions pendant 3 tours', emojiB: '💬', textB: 'Répondre à toutes les questions par une question pendant 3 tours' }
];

// Trash dilemmas (dt-1 to dt-25) - keeping existing style
export const trashDilemmas: Dilemma[] = [
  { id: 'dt-1', pack: 'trash', emojiA: '💩', textA: 'Lécher quelque chose qui est par terre', emojiB: '👃', textB: 'Sentir tes propres aisselles et décrire l\'odeur' },
  { id: 'dt-2', pack: 'trash', emojiA: '🤢', textA: 'Boire ton propre urine', emojiB: '🤮', textB: 'Vomir dans un seau et montrer le résultat' },
  { id: 'dt-3', pack: 'trash', emojiA: '👣', textA: 'Lécher tes propres pieds', emojiB: '👄', textB: 'Faire un bisou sur les lèvres de quelqu\'un après avoir mangé de l\'ail' },
  { id: 'dt-4', pack: 'trash', emojiA: '👂', textA: 'Manger un bouchon d\'oreille', emojiB: '👃', textB: 'Manger quelque chose qui est sorti de ton nez' },
  { id: 'dt-5', pack: 'trash', emojiA: '💩', textA: 'Ne pas utiliser les toilettes pendant toute la soirée', emojiB: '🚽', textB: 'Dire quand tu vas aux toilettes en détail' },
  { id: 'dt-6', pack: 'trash', emojiA: '🤢', textA: 'Boire le fond d\'un verre sale trouvé par terre', emojiB: '🥛', textB: 'Boire du lait périmé' },
  { id: 'dt-7', pack: 'trash', emojiA: '👃', textA: 'Sentir les pieds de quelqu\'un et noter sur 10', emojiB: '👅', textB: 'Lécher l\'intérieur de ton coude' },
  { id: 'dt-8', pack: 'trash', emojiA: '🤮', textA: 'Essayer de te faire vomir', emojiB: '😴', textB: 'Dormir la bouche ouverte et bavarder' },
  { id: 'dt-9', pack: 'trash', emojiA: '💦', textA: 'Ne pas te laver les mains après être allé aux toilettes', emojiB: '👏', textB: 'Applaudir avec des mains humides' },
  { id: 'dt-10', pack: 'trash', emojiA: '👃', textA: 'Sentir ton haleine et donner ton avis honnête', emojiB: '👄', textB: 'Embrasser quelqu\'un après avoir bu quelque chose de fort' },
  { id: 'dt-11', pack: 'trash', emojiA: '👣', textA: 'Marcher pieds nus dehors puis remonter sur le canapé', emojiB: '👄', textB: 'Partager ta brosse à dents avec quelqu\'un' },
  { id: 'dt-12', pack: 'trash', emojiA: '🤢', textA: 'Manger quelque chose trouvé dans une poubelle (propre)', emojiB: '👃', textB: 'Renifler profondément dans un vêtement sale' },
  { id: 'dt-13', pack: 'trash', emojiA: '💦', textA: 'Laisser quelqu\'un te mouiller les cheveux avec de l\'eau', emojiB: '😳', textB: 'Raconter ta dernière expérience gênante aux toilettes' },
  { id: 'dt-14', pack: 'trash', emojiA: '👂', textA: 'Manger un morceau de coton-tige utilisé', emojiB: '👄', textB: 'Lécher de la cire d\'oreille' },
  { id: 'dt-15', pack: 'trash', emojiA: '🤮', textA: 'Goûter quelque chose qui a tombé dans les toilettes', emojiB: '🚽', textB: 'Licher la cuvette des toilettes (propre)' },
  { id: 'dt-16', pack: 'trash', emojiA: '👃', textA: 'Renifler profondément dans les cheveux de quelqu\'un', emojiB: '👄', textB: 'Embrasser quelqu\'un dans le cou après un effort' },
  { id: 'dt-17', pack: 'trash', emojiA: '🤢', textA: 'Boire un mélange de 3 boissons différentes trouvées', emojiB: '🥚', textB: 'Manger un œuf cru' },
  { id: 'dt-18', pack: 'trash', emojiA: '👄', textA: 'Embrasser quelqu\'un qui vient de fumer', emojiB: '👃', textB: 'Renifler profondément dans les aisselles de quelqu\'un' },
  { id: 'dt-19', pack: 'trash', emojiA: '👃', textA: 'Sentir tes propres selles (via papier)', emojiB: '🤢', textB: 'Goûter de la transpiration' },
  { id: 'dt-20', pack: 'trash', emojiA: '💦', textA: 'Laisser quelqu\'un te cracher dessus (un peu)', emojiB: '😳', textB: 'Raconter ton pire moment de flatulence' },
  { id: 'dt-21', pack: 'trash', emojiA: '👂', textA: 'Manger quelque chose qui a trainé dans tes oreilles', emojiB: '👄', textB: 'Partager ta nourriture déjà entamée' },
  { id: 'dt-22', pack: 'trash', emojiA: '🤮', textA: 'Vomir dans ta main et montrer', emojiB: '😴', textB: 'Baver en dormant et ne pas t\'essuyer' },
  { id: 'dt-23', pack: 'trash', emojiA: '👃', textA: 'Sentir l\'intérieur de tes chaussures après une journée', emojiB: '👄', textB: 'Embrasser quelqu\'un après avoir mangé quelque chose de très épicé' },
  { id: 'dt-24', pack: 'trash', emojiA: '🤢', textA: 'Essayer de manger quelque chose de très amer sans faire la grimace', emojiB: '👃', textB: 'Renifler quelque chose de très fort et essayer de sourire' },
  { id: 'dt-25', pack: 'trash', emojiA: '🌬️', textA: 'Une puff goût paff', emojiB: '💨', textB: 'Un paff goût puff' }
];

// Spicy dilemmas (ds-1 to ds-30) - suggestif/osé mais pas dégoûtant
export const spicyDilemmas: Dilemma[] = [
  { id: 'ds-1', pack: 'spicy', emojiA: '👄', textA: 'Embrasser quelqu\'un dans le cou', emojiB: '👃', textB: 'Sentir le cou de quelqu\'un et complimenter son odeur' },
  { id: 'ds-2', pack: 'spicy', emojiA: '👙', textA: 'Montrer ton maillot de bain préféré', emojiB: '👖', textB: 'Montrer tes sous-vêtements préférés (par-dessus le pantalon)' },
  { id: 'ds-3', pack: 'spicy', emojiA: '💃', textA: 'Faire un lap dance sur une chaise', emojiB: '🕺', textB: 'Danser lentement avec quelqu\'un du même sexe' },
  { id: 'ds-4', pack: 'spicy', emojiA: '👀', textA: 'Matéral discrètement le décolleté de quelqu\'un', emojiB: '👃', textB: 'Sentir discrètement dans le cou de quelqu\'un' },
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
  { id: 'ds-16', pack: 'spicy', emojiA: '👄', textA: 'Faire un bisou dans le cou de quelqu\'un', emojiB: '👃', textB: 'Sentir le parfum dans le cou de quelqu\'un' },
  { id: 'ds-17', pack: 'spicy', emojiA: '👀', textA: 'Regarder dans les yeux de quelqu\'un pendant 20 secondes sans sourire', emojiB: '😳', textB: 'Rougir et expliquer pourquoi' },
  { id: 'ds-18', pack: 'spicy', emojiA: '👙', textA: 'Essayer de tenir un objet entre tes genoux', emojiB: '👃', textB: 'Faire croire que tu sens quelque chose d\'intéressant' },
  { id: 'ds-19', pack: 'spicy', emojiA: '👄', textA: 'Donner un baiser rapide sur les lèvres à quelqu\'un', emojiB: '🤲', textB: 'Donner un câlin amical de 5 secondes' },
  { id: 'ds-20', pack: 'spicy', emojiA: '📝', textA: 'Écrire un mot doux sur un bout de papier et le donner', emojiB: '👃', textB: 'Sentir discrètement dans les cheveux de quelqu\'un' },
  { id: 'ds-21', pack: 'spicy', emojiA: '👃', textA: 'Renifler subtilement dans le cou de quelqu\'un après un câlin', emojiB: '👄', textB: 'Embrasser quelqu\'un rapidement après qu\'il ait ri' },
  { id: 'ds-22', pack: 'spicy', emojiA: '👙', textA: 'Ajuster ton vêtement de manière légèrement suggestive', emojiB: '👃', textB: 'Sentir ton propre cou et demander si ça sent bon' },
  { id: 'ds-23', pack: 'spicy', emojiA: '👄', textA: 'Proposer un jeu de regard soutenu pendant 10 secondes', emojiB: '👃', textB: 'Sentir derrière l\'oreille de quelqu\'un et complimenter' },
  { id: 'ds-24', pack: 'spicy', emojiA: '👀', textA: 'Dire quelle partie du corps tu trouves la plus sexy chez quelqu\'un', emojiB: '💭', textB: 'Décrire ton idéal de personne en 3 mots' },
  { id: 'ds-25', pack: 'spicy', emojiA: '👃', textA: 'Sentir l\'odeur de la peau de quelqu\'un après qu\'il ait transpiré légèrement', emojiB: '👄', textB: 'Embrasser le front de quelqu\'un après un effort' },
  { id: 'ds-26', pack: 'spicy', emojiA: '👙', textA: 'Montrer comment tu mets ton maillot de bain préféré', emojiB: '👖', textB: 'Montrer comment tu mets tes sous-vêtements préférés' },
  { id: 'ds-27', pack: 'spicy', emojiA: '👄', textA: 'Donner un bisou papillon (cils qui touchent la peau)', emojiB: '👃', textB: 'Sentir doucement derrière l\'oreille de quelqu\'un' },
  { id: 'ds-28', pack: 'spicy', emojiA: '👃', textA: 'Complimenter quelqu\'un sur son odeur naturelle', emojiB: '👄', textB: 'Donner un petit bisou sec sur la joue' },
  { id: 'ds-29', pack: 'spicy', emojiA: '👀', textA: 'Faire croire que tu as vu quelque chose de suggestive dans les vêtements de quelqu\'un', emojiB: '😳', textB: 'Rougir sans raison apparente et en rire' },
  { id: 'ds-30', pack: 'spicy', emojiA: '👄', textA: 'Proposer un échange de compliments physiques de 2 phrases chacun', emojiB: '👃', textB: 'Sentir discrètement dans le creux du cou de quelqu\'un' }
];

// All dilemmas combined
export const allDilemmas: Dilemma[] = [
  ...classicDilemmas,
  ...trashDilemmas,
  ...spicyDilemmas
];

// Function to get dilemmas for a specific pack
export function dilemmasForPack(pack: DilemmaPack | 'mixed'): Dilemma[] {
  if (pack === 'mixed') return allDilemmas;
  return allDilemmas.filter(dilemma => dilemma.pack === pack);
}