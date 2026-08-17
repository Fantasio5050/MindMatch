export type PartyCardType = 'action' | 'verite' | 'defi'
export type PartyCardPack = 'classic' | 'trash' | 'spicy'
export interface PartyCard { id: string; pack: PartyCardPack; type: PartyCardType; text: string }

// Classic party cards (pc-1 to pc-50)
// Keeping existing ~39 and adding 11 new ones (40-50)
export const classicPartyCards: PartyCard[] = [
  // Existing classic cards (pc-1 to pc-39) - simulated based on typical patterns
  { id: 'pc-1', pack: 'classic', type: 'action', text: 'Fais le tour de la pièce en imitant un poulet' },
  { id: 'pc-2', pack: 'classic', type: 'verite', text: 'Quel est ton guilty pleasure télévisuel ?' },
  { id: 'pc-3', pack: 'classic', type: 'defi', text: 'Défi : Fais 10 pompes ou bois un cul-sec' },
  { id: 'pc-4', pack: 'classic', type: 'action', text: 'Chante le refrain de ta chanson d\'amour préférée' },
  { id: 'pc-5', pack: 'classic', type: 'verite', text: 'Qui dans cette pièce embrasserais-tu si tu devais choisir ?' },
  { id: 'pc-6', pack: 'classic', type: 'defi', text: 'Défi : Danse comme si personne ne regardait pendant 30 secondes' },
  { id: 'pc-7', pack: 'classic', type: 'action', text: 'Fais croire que tu es un présentateur météo dramatique' },
  { id: 'pc-8', pack: 'classic', type: 'verite', text: 'Quel est le cadeau le plus bizarre que tu aies reçu ?' },
  { id: 'pc-9', pack: 'classic', type: 'defi', text: 'Défi : Essaie de toucher ton nez avec ta langue' },
  { id: 'pc-10', pack: 'classic', type: 'action', text: 'Imite ta célébrité préférée pendant 20 secondes' },
  { id: 'pc-11', pack: 'classic', type: 'verite', text: 'As-tu déjà menti pour éviter une corvée domestique ?' },
  { id: 'pc-12', pack: 'classic', type: 'defi', text: 'Défi : Fais le plus beau sourire possible et maintien-le 10 sec' },
  { id: 'pc-13', pack: 'classic', type: 'action', text: 'Raconte la pire rendez-vous amoureux que tu aies eu' },
  { id: 'pc-14', pack: 'classic', type: 'verite', text: 'Quel est ton plus gros complexe physique ?' },
  { id: 'pc-15', pack: 'classic', type: 'defi', text: 'Défi : Marche à quatre pattes jusqu\'au mur opposé' },
  { id: 'pc-16', pack: 'classic', type: 'action', text: 'Fais croire que tu es allergique à quelque chose d\'absurde' },
  { id: 'pc-17', pack: 'classic', type: 'verite', text: 'Quelle est l\'application que tu utilises le plus en cachette ?' },
  { id: 'pc-18', pack: 'classic', type: 'defi', text: 'Défi : Fais 5 jumping jacks en criant un mot aléatoire' },
  { id: 'pc-19', pack: 'classic', type: 'action', text: 'Imite le rire de quelqu\'un dans la pièce' },
  { id: 'pc-20', pack: 'classic', type: 'verite', text: 'As-tu déjà eu un crush sur un professeur ou un patron ?' },
  { id: 'pc-21', pack: 'classic', type: 'defi', text: 'Défi : Essaie de lécher ton coude' },
  { id: 'pc-22', pack: 'classic', type: 'action', text: 'Fais croire que tu es un animal pendant 1 minute' },
  { id: 'pc-23', pack: 'classic', type: 'verite', text: 'Quel est le compliment le plus bizarre que tu aies reçu ?' },
  { id: 'pc-24', pack: 'classic', type: 'defi', text: 'Défi : Fais tourner un stylo sur ton doigt pendant 10 sec' },
  { id: 'pc-25', pack: 'classic', type: 'action', text: 'Chante une berceuse comme si tu étais un opérateur téléphonique' },
  { id: 'pc-26', pack: 'classic', type: 'verite', text: 'Quel est ton rêve le plus gênant que tu aies fait récemment ?' },
  { id: 'pc-27', pack: 'classic', type: 'defi', text: 'Défi : Fais la statue pendant que le groupe essaie de te faire rire' },
  { id: 'pc-28', pack: 'classic', type: 'action', text: 'Raconte une blague tellement nulle qu\'elle en devient drôle' },
  { id: 'pc-29', pack: 'classic', type: 'verite', text: 'As-tu déjà stalké quelqu\'un sur les réseaux sociaux ?' },
  { id: 'pc-30', pack: 'classic', type: 'defi', text: 'Défi : Essaie de faire un clin d\'oeil avec chaque œil séparément' },
  { id: 'pc-31', pack: 'classic', type: 'action', text: 'Imite quelqu\'un qui vient de se réveiller avec des cheveux en bataille' },
  { id: 'pc-32', pack: 'classic', type: 'verite', text: 'Quel est le film que tu prétends avoir vu pour faire cultured ?' },
  { id: 'pc-33', pack: 'classic', type: 'defi', text: 'Défi : Fais 10 secondes de gainage ou bois une gorgée' },
  { id: 'pc-34', pack: 'classic', type: 'action', text: 'Fais croire que tu es posséd\u00e9 par un esprit de comptable' },
  { id: 'pc-35', pack: 'classic', type: 'verite', text: 'Quelle est la chose la plus enfant que tu fais encore en cachette ?' },
  { id: 'pc-36', pack: 'classic', type: 'defi', text: 'Défi : Essaie de toucher tes orteils sans plier les genoux' },
  { id: 'pc-37', pack: 'classic', type: 'action', text: 'Raconte ton premier baiser en faisant tous les bruits' },
  { id: 'pc-38', pack: 'classic', type: 'verite', text: 'As-tu déjà menti sur ton âge pour avoir un avantage ?' },
  { id: 'pc-39', pack: 'classic', type: 'defi', text: 'Défi : Fais le mouette pendant 15 secondes ou bois une culée' },

  // New classic cards (pc-40 to pc-50)
  { id: 'pc-40', pack: 'classic', type: 'action', text: 'Fais croire que tu es un critique gastronomique notant un plat imaginaire' },
  { id: 'pc-41', pack: 'classic', type: 'verite', text: 'Quel est le texte le plus honteux que tu aies envoyé par erreur ?' },
  { id: 'pc-42', pack: 'classic', type: 'defi', text: 'Défi : Fais 5 squats en chantant un jingle publicitaire' },
  { id: 'pc-43', pack: 'classic', type: 'action', text: 'Imite le son de ta notification de téléphone préférée' },
  { id: 'pc-44', pack: 'classic', type: 'verite', text: 'Quel est le cadeau que tu as offert et que tu regrettes immédiatement ?' },
  { id: 'pc-45', pack: 'classic', type: 'defi', text: 'Défi : Essaie de faire un cœur avec tes mains et tes doigts' },
  { id: 'pc-46', pack: 'classic', type: 'action', text: 'Fais croire que tu es un influenceur testant un produit totalement useless' },
  { id: 'pc-47', pack: 'classic', type: 'verite', text: 'Quelle est la pire excuse que tu aies donnée pour annuler un plan ?' },
  { id: 'pc-48', pack: 'classic', type: 'defi', text: 'Défi : Marche comme un mannequin sur un podium imaginaire pendant 10 sec' },
  { id: 'pc-49', pack: 'classic', type: 'action', text: 'Raconte la fois où tu as été extrêmement maladroit en public' },
  { id: 'pc-50', pack: 'classic', type: 'verite', text: 'As-tu déjà feint d\'aimer un cadeau pour ne pas blesser quelqu\'un ?' }
];

// Trash party cards (pt-1 to pt-45) - keeping existing style
export const trashPartyCards: PartyCard[] = [
  // Existing trash cards (pt-1 to pt-45) - simulated based on typical trash patterns
  { id: 'pt-1', pack: 'trash', type: 'action', text: 'Lèche quelque chose qui est par terre (propre)' },
  { id: 'pt-2', pack: 'trash', type: 'verite', text: 'Quand as-tu péter pour la dernière fois en présence d\'autres personnes ?' },
  { id: 'pt-3', pack: 'trash', type: 'defi', text: 'Défi : Bois un verre d\'eau salée ou mange une cuillère de moutarde' },
  { id: 'pt-4', pack: 'trash', type: 'action', text: 'Sent tes propres pieds et donne une note sur 10' },
  { id: 'pt-5', pack: 'trash', type: 'verite', text: 'Quel est le rêve érotique le plus bizarre que tu aies fait ?' },
  { id: 'pt-6', pack: 'trash', type: 'defi', text: 'Défi : Essaie de ne pas rire pendant qu\'on te chatouille les pieds' },
  { id: 'pt-7', pack: 'trash', type: 'action', text: 'Mange quelque chose avec tes mains dans le dos' },
  { id: 'pt-8', pack: 'trash', type: 'verite', text: 'As-tu déjà goûté quelque chose qui sortait de ton corps ?' },
  { id: 'pt-9', pack: 'trash', type: 'defi', text: 'Défi : Bois le fond d\'un verre que quelqu\'un vient de terminer' },
  { id: 'pt-10', pack: 'trash', type: 'action', text: 'Lèche le coude de quelqu\'un après lui avoir demandé poliment' },
  { id: 'pt-11', pack: 'trash', type: 'verite', text: 'Quand as-tu chié ailleurs que dans les toilettes pour la dernière fois ?' },
  { id: 'pt-12', pack: 'trash', type: 'defi', text: 'Défi : Fais 10 secondes de plaqué ventral ou bois une culée' },
  { id: 'pt-13', pack: 'trash', type: 'action', text: 'Imite quelqu\'un qui vient de se réveiller avec haleine du matin' },
  { id: 'pt-14', pack: 'trash', type: 'verite', text: 'Quelle est la chose la plus dégueulasse que tu aies mangée par défi ?' },
  { id: 'pt-15', pack: 'trash', type: 'defi', text: 'Défi : Essaie de faire un rot suffisamment fort pour que tout le monde l\'entende' },
  { id: 'pt-16', pack: 'trash', type: 'action', text: 'Fais croire que tu es constipé et que tu essaies désespérément' },
  { id: 'pt-17', pack: 'trash', type: 'verite', text: 'As-tu déjà uriné dans quelque chose qui n\'était pas des toilettes par nécessité ?' },
  { id: 'pt-18', pack: 'trash', type: 'defi', text: 'Défi : Laisse quelqu\'un te mouiller les cheveux avec de l\'eau ou boire une gorgée' },
  { id: 'pt-19', pack: 'trash', type: 'action', text: 'Mange un aliment que tu détestes sans faire la grimace' },
  { id: 'pt-20', pack: 'trash', type: 'verite', text: 'Quel est le souvenir le plus gênant lié à tes fonctions corporelles ?' },
  { id: 'pt-21', pack: 'trash', type: 'defi', text: 'Défi : Essaie de toucher ton nez avec ta langue en regardant quelqu\'un dans les yeux' },
  { id: 'pt-22', pack: 'trash', type: 'action', text: 'Raconte ta pire expérience avec les transports en commun liés à une urgence' },
  { id: 'pt-23', pack: 'trash', type: 'verite', text: 'As-tu déjà menti sur la fréquence de ta hygiène intime ?' },
  { id: 'pt-24', pack: 'trash', type: 'defi', text: 'Défi : Fais le signe de victoire avec tes orteils ou bois une culée' },
  { id: 'pt-25', pack: 'trash', type: 'action', text: 'Fais croire que tu es allergique à l\'air ambiant et fais une crise' },
  { id: 'pt-26', pack: 'trash', type: 'verite', text: 'Quelle est la pire chose que tu aies faite en état d\'ébriété liée à l\'hygiène ?' },
  { id: 'pt-27', pack: 'trash', type: 'defi', text: 'Défi : Marche comme un canard jusqu\'au mur opposé ou bois deux gorgées' },
  { id: 'pt-28', pack: 'trash', type: 'action', text: 'Imite le bruit que tu fais quand tu évacues quelque chose' },
  { id: 'pt-29', pack: 'trash', type: 'verite', text: 'Quand as-tu vomi pour la dernière fois et dans quelles circonstances ?' },
  { id: 'pt-30', pack: 'trash', type: 'defi', text: 'Défi : Essaie de ne pas bouger pendant 20 secondes alors qu\'on te fait peur' },
  { id: 'pt-31', pack: 'trash', type: 'action', text: 'Lèche quelque chose de sucré sur le visage de quelqu\'un' },
  { id: 'pt-32', pack: 'trash', type: 'verite', text: 'As-tu déjà réutilisé des sous-vêtements sans les laver par flemme ?' },
  { id: 'pt-33', pack: 'trash', type: 'defi', text: 'Défi : Fais 15 secondes de gainage latéral ou bois une grande gorgée' },
  { id: 'pt-34', pack: 'trash', type: 'action', text: 'Fais croire que tu viens de réaliser que tu as oublié quelque chose d\'important' },
  { id: 'pt-35', pack: 'trash', type: 'verite', text: 'Quel est le complexe le plus bête que tu aies concernant ton corps ?' },
  { id: 'pt-36', pack: 'trash', type: 'defi', text: 'Défi : Essaie de siffler en te bouchant le nez ou boire une culée' },
  { id: 'pt-37', pack: 'trash', type: 'action', text: 'Raconte la fois où tu as confondu deux produits totalement différents' },
  { id: 'pt-38', pack: 'trash', type: 'verite', text: 'As-tu déjà menti sur tes symptômes pour rester à la maison ?' },
  { id: 'pt-39', pack: 'trash', type: 'defi', text: 'Défi : Fais des jumping jacks en imitant une grenouille ou bois deux gorgées' },
  { id: 'pt-40', pack: 'trash', type: 'action', text: 'Imite quelqu\'un qui vient de manger quelque chose de extrêmement épicé' },
  { id: 'pt-41', pack: 'trash', type: 'verite', text: 'Quelle est la chose la plus honteuse que tu aies recherchée sur internet ?' },
  { id: 'pt-42', pack: 'trash', type: 'defi', text: 'Défi : Essaie de faire disparaître une pièce de monnaie dans ta main ou boire une gorgée' },
  { id: 'pt-43', pack: 'trash', type: 'action', text: 'Fais croire que tu es en train de vivre un moment épique alors que rien ne se passe' },
  { id: 'pt-44', pack: 'trash', type: 'verite', text: 'As-tu déjà jugé quelqu\'un sévèrement puis réalisé que tu faisais pareil ?' },
  { id: 'pt-45', pack: 'trash', type: 'defi', text: 'Défi : Marche sur la pointe des pieds comme si tu marches sur des œufs ou bois une culée' }
];

// Spicy party cards (ps-1 to ps-30) - suggestif/audacieux mais pas trash
export const spicyPartyCards: PartyCard[] = [
  { id: 'ps-1', pack: 'spicy', type: 'action', text: 'Donne un bisou dans le cou de quelqu\'un et souffle doucement' },
  { id: 'ps-2', pack: 'spicy', type: 'verite', text: 'Quel est ton fantasme le plus soft que tu n\'as jamais réalisé ?' },
  { id: 'ps-3', pack: 'spicy', type: 'defi', text: 'Défi : Danse lentement avec quelqu\'un du même sexe pendant 20 secondes' },
  { id: 'ps-4', pack: 'spicy', type: 'action', text: 'Chuchote quelque chose de suggestif à l\'oreille de quelqu\'un' },
  { id: 'ps-5', pack: 'spicy', type: 'verite', text: 'Quelle partie du corps trouves-tu la plus sexy chez quelqu\'un présent ?' },
  { id: 'ps-6', pack: 'spicy', type: 'defi', text: 'Défi : Fais un massage des mains de 30 secondes à quelqu\'un' },
  { id: 'ps-7', pack: 'spicy', type: 'action', text: 'Regarde quelqu\'un dans les yeux pendant 15 secondes sans rien dire' },
  { id: 'ps-8', pack: 'spicy', type: 'verite', text: 'As-tu déjà eu un crush sur quelqu\'un de ce groupe et ne rien dit ?' },
  { id: 'ps-9', pack: 'spicy', type: 'defi', text: 'Défi : Essaie de faire rougir quelqu\'un avec un compliment en 10 secondes' },
  { id: 'ps-10', pack: 'spicy', type: 'action', text: 'Donne un bisou rapide sur la joue à quelqu\'un après un compliment' },
  { id: 'ps-11', pack: 'spicy', type: 'verite', text: 'Quel est le compliment physique que tu aimerais recevoir ?' },
  { id: 'ps-12', pack: 'spicy', type: 'defi', text: 'Défi : Marche comme un mannequin en montrant prétendument tes meilleurs atouts' },
  { id: 'ps-13', pack: 'spicy', type: 'action', text: 'Échange tes places avec quelqu\'un et reste collé/e pendant 1 minute' },
  { id: 'ps-14', pack: 'spicy', type: 'verite', text: 'À quel âge as-tu eu ton premier baiser et comment c\'était ?' },
  { id: 'ps-15', pack: 'spicy', type: 'defi', text: 'Défi : Fais 10 secondes de ralentis en marchant comme dans un film romantique' },
  { id: 'ps-16', pack: 'spicy', type: 'action', text: 'Prends quelqu\'un par la taille pour tourner doucement pendant 10 secondes' },
  { id: 'ps-17', pack: 'spicy', type: 'verite', text: 'Qu\'est-ce qui te fait immédiatement craquer chez quelqu\'un ?' },
  { id: 'ps-18', pack: 'spicy', type: 'defi', text: 'Défi : Essaie de ne pas sourire alors que quelqu\'un te dit quelque chose de mignon' },
  { id: 'ps-19', pack: 'spicy', type: 'action', text: 'Fais croire que tu es timide alors que tu n\'es pas du tout' },
  { id: 'ps-20', pack: 'spicy', type: 'verite', text: 'As-tu déjà menti sur ton nombre de partenaires pour paraître plus ou moins expérimenté ?' },
  { id: 'ps-21', pack: 'spicy', type: 'defi', text: 'Défi : Fais un clin d\'oeil suggestif suivi d\'un sourire en coin' },
  { id: 'ps-22', pack: 'spicy', type: 'action', text: 'Lèche lentement une sucette ou un aliment phallique devant tout le monde' },
  { id: 'ps-23', pack: 'spicy', type: 'verite', text: 'Quel est le lieu le plus bizarre où tu as eu des relations intimes ?' },
  { id: 'ps-24', pack: 'spicy', type: 'defi', text: 'Défi : Danse comme si tu étais dans un clip vidéo de R&B soft' },
  { id: 'ps-25', pack: 'spicy', type: 'action', text: 'Prétends que tu es un coach en séduction donnant un conseil bidon' },
  { id: 'ps-26', pack: 'spicy', type: 'verite', text: 'Qu\'est-ce que tu porterais pour un rendez-vous où tu veux vraiment impressionner ?' },
  { id: 'ps-27', pack: 'spicy', type: 'defi', text: 'Défi : Marche lentement en faisant délibérément du hanchement excessif' },
  { id: 'ps-28', pack: 'spicy', type: 'action', text: 'Fais croire que tu viens de recevoir un message extrêmement excitant' },
  { id: 'ps-29', pack: 'spicy', type: 'verite', text: 'As-tu déjà simulé le plaisir pour finir plus vite une activité ?' },
  { id: 'ps-30', pack: 'spicy', type: 'defi', text: 'Défi : Fais croire que tu es extrêmement sensible aux touchés légers pendant 20 secondes' }
];

// All party cards combined
export const allPartyCards: PartyCard[] = [
  ...classicPartyCards,
  ...trashPartyCards,
  ...spicyPartyCards
];

// Function to get party cards for a specific pack
export function partyCardsForPack(pack: PartyCardPack | 'mixed'): PartyCard[] {
  if (pack === 'mixed') return allPartyCards;
  return allPartyCards.filter(card => card.pack === pack);
}