export type PartyCardType = 'action' | 'verite' | 'defi'
export type PartyCardPack = 'classic' | 'trash'

export interface PartyCard {
  id: string
  pack: PartyCardPack
  type: PartyCardType
  text: string
}

export const CLASSIC_PARTY_CARDS: PartyCard[] = [
  { id: 'pc-1', pack: 'classic', type: 'verite', text: "Quelle est la chose la plus gênante qui te soit arrivée en public ?" },
  { id: 'pc-2', pack: 'classic', type: 'defi', text: 'Imite un membre du groupe pendant 30 secondes, les autres devinent qui.' },
  { id: 'pc-3', pack: 'classic', type: 'action', text: 'Fais un compliment sincère à la personne à ta gauche.' },
  { id: 'pc-4', pack: 'classic', type: 'verite', text: 'Quel est ton pire mensonge pour éviter une sortie ?' },
  { id: 'pc-5', pack: 'classic', type: 'defi', text: "Chante le refrain d'une chanson au hasard choisie par le groupe." },
  { id: 'pc-6', pack: 'classic', type: 'action', text: "Raconte le souvenir le plus drôle que tu as avec quelqu'un ici." },
  { id: 'pc-7', pack: 'classic', type: 'verite', text: 'Quelle app passes-tu le plus de temps sur ton téléphone ?' },
  { id: 'pc-8', pack: 'classic', type: 'defi', text: "Fais 10 pompes ou raconte ta pire honte d'enfance." },
  { id: 'pc-9', pack: 'classic', type: 'action', text: 'Échange un objet que tu portes avec ton/ta voisin·e pour le reste de la manche.' },
  { id: 'pc-10', pack: 'classic', type: 'verite', text: 'Quel est le plat que tu prétends aimer mais que tu détestes ?' },
  { id: 'pc-11', pack: 'classic', type: 'defi', text: 'Parle avec un accent au choix du groupe pendant 2 minutes.' },
  { id: 'pc-12', pack: 'classic', type: 'action', text: "Raconte un rêve bizarre que tu as fait récemment." },
  { id: 'pc-13', pack: 'classic', type: 'verite', text: "Si tu devais échanger de vie avec quelqu'un ici, qui choisirais-tu et pourquoi ?" },
  { id: 'pc-14', pack: 'classic', type: 'defi', text: "Laisse le groupe poster un statut de leur choix sur ton téléphone (sans le lire avant)." },
  { id: 'pc-15', pack: 'classic', type: 'action', text: "Devine le prénom complet (nom compris) d'une personne du groupe que tu connais peu." },
  { id: 'pc-16', pack: 'classic', type: 'verite', text: "Quelle est la dernière chose que tu as googlée et que tu n'assumes pas ?" },
  { id: 'pc-17', pack: 'classic', type: 'defi', text: 'Fais deviner un film en le mimant, sans parler.' },
  { id: 'pc-18', pack: 'classic', type: 'action', text: "Dis un talent caché que personne ici ne connaît de toi." },
  { id: 'pc-19', pack: 'classic', type: 'verite', text: "Quelle est la dépense la plus inutile que tu aies jamais faite ?" },
  { id: 'pc-20', pack: 'classic', type: 'defi', text: "Prends la pose la plus héroïque possible et tiens-la 20 secondes." },
  { id: 'pc-21', pack: 'classic', type: 'action', text: "Cite trois qualités de la personne en face de toi." },
  { id: 'pc-22', pack: 'classic', type: 'verite', text: "Quel surnom détestes-tu qu'on te donne ?" },
  { id: 'pc-23', pack: 'classic', type: 'defi', text: "Invente un slogan publicitaire pour la personne à ta gauche." },
  { id: 'pc-24', pack: 'classic', type: 'action', text: "Raconte ta plus belle victoire de l'année." },
  { id: 'pc-25', pack: 'classic', type: 'verite', text: "Quel est ton plus grand talent complètement inutile ?" },
  { id: 'pc-26', pack: 'classic', type: 'defi', text: "Parle uniquement en chuchotant jusqu'à ton prochain tour." },
  { id: 'pc-27', pack: 'classic', type: 'action', text: "Avec la personne en face, trouvez un point commun surprenant entre vous." },
  { id: 'pc-28', pack: 'classic', type: 'verite', text: "Quelle peur irrationnelle assumes-tu totalement ?" },
  { id: 'pc-29', pack: 'classic', type: 'defi', text: "Fais une déclaration d'amour exagérée à un objet de la pièce." },
  { id: 'pc-30', pack: 'classic', type: 'action', text: "Décris ta soirée idéale en une seule phrase." },
  { id: 'pc-31', pack: 'classic', type: 'verite', text: "Quelle est la série que tu as dévorée le plus vite ?" },
  { id: 'pc-32', pack: 'classic', type: 'defi', text: "Danse sans musique pendant 15 secondes comme si tu étais en boîte." },
  { id: 'pc-33', pack: 'classic', type: 'action', text: "Donne un conseil de vie à la personne à ta droite." },
  { id: 'pc-34', pack: 'classic', type: 'verite', text: "Quel est le compliment qui t'a le plus marqué dans ta vie ?" },
  { id: 'pc-35', pack: 'classic', type: 'defi', text: "Imite le rire de quelqu'un du groupe, les autres devinent qui." },
  { id: 'pc-36', pack: 'classic', type: 'action', text: "Propose un toast original que tout le monde doit répéter." },
  { id: 'pc-37', pack: 'classic', type: 'verite', text: "Si tu pouvais effacer un souvenir gênant, lequel choisirais-tu ?" },
  { id: 'pc-38', pack: 'classic', type: 'defi', text: "Raconte une blague : si personne ne rit, tu bois une gorgée." },
  { id: 'pc-39', pack: 'classic', type: 'action', text: "Fais deviner ton métier de rêve d'enfant en un seul mot." },
]

export const TRASH_PARTY_CARDS: PartyCard[] = [
  { id: 'pt-1', pack: 'trash', type: 'verite', text: 'Quelle est la pire chose que tu aies faite pour te venger de quelqu\'un ?' },
  { id: 'pt-2', pack: 'trash', type: 'defi', text: "Envoie un message random à ton dernier contact, dicté par le groupe." },
  { id: 'pt-3', pack: 'trash', type: 'verite', text: "Quel est le mensonge le plus énorme que tu as raconté à tes parents ?" },
  { id: 'pt-4', pack: 'trash', type: 'action', text: 'Montre la dernière photo enregistrée sur ton téléphone (si tu oses).' },
  { id: 'pt-5', pack: 'trash', type: 'verite', text: "C'est quoi ton red flag que tu assumes complètement ?" },
  { id: 'pt-6', pack: 'trash', type: 'defi', text: "Laisse quelqu'un du groupe fouiller ton historique de recherche 10 secondes." },
  { id: 'pt-7', pack: 'trash', type: 'verite', text: "Quelle personne ici referais-tu inviter en premier, et laquelle en dernier ?" },
  { id: 'pt-8', pack: 'trash', type: 'action', text: "Avoue ta pire habitude que personne ici ne connaît." },
  { id: 'pt-9', pack: 'trash', type: 'defi', text: 'Bois cul sec ou avoue ton plus gros regret de soirée.' },
  { id: 'pt-10', pack: 'trash', type: 'verite', text: "Quel est le truc le plus trash que tu aies fait pour plaire à quelqu'un ?" },
  { id: 'pt-11', pack: 'trash', type: 'action', text: "Dis quel est le pire baiser de ta vie, sans donner de nom." },
  { id: 'pt-12', pack: 'trash', type: 'verite', text: "As-tu déjà stalké l'ex de quelqu'un ici ? Avoue." },
  { id: 'pt-13', pack: 'trash', type: 'verite', text: "Quel est le message le plus gênant que tu aies envoyé bourré·e ?" },
  { id: 'pt-14', pack: 'trash', type: 'defi', text: "Laisse ton voisin de gauche écrire ta prochaine story." },
  { id: 'pt-15', pack: 'trash', type: 'action', text: "Classe la table du plus au moins susceptible de finir en prison." },
  { id: 'pt-16', pack: 'trash', type: 'verite', text: "Quelle est la chose la plus honteuse dans ton historique de commandes ?" },
  { id: 'pt-17', pack: 'trash', type: 'defi', text: "Montre ta conversation la plus récente au groupe, le nom caché." },
  { id: 'pt-18', pack: 'trash', type: 'action', text: "Avoue quel joueur de la table tu as déjà un peu jalousé." },
  { id: 'pt-19', pack: 'trash', type: 'verite', text: "Qui, dans cette pièce, aurais-tu pu embrasser dans une autre vie ?" },
  { id: 'pt-20', pack: 'trash', type: 'defi', text: "Envoie « on doit se parler » à un contact au hasard (puis « fausse manip » 😅)." },
  { id: 'pt-21', pack: 'trash', type: 'action', text: "Dis à qui tu confierais ton téléphone déverrouillé… et à qui jamais." },
  { id: 'pt-22', pack: 'trash', type: 'verite', text: "Quel est le pire endroit où tu aies dormi après une soirée ?" },
  { id: 'pt-23', pack: 'trash', type: 'defi', text: "Lis ton dernier message envoyé à voix haute, avec le ton le plus dramatique." },
  { id: 'pt-24', pack: 'trash', type: 'action', text: "Nomme la personne ici avec qui tu partirais en week-end sans hésiter." },
  { id: 'pt-25', pack: 'trash', type: 'verite', text: "Quelle est la rumeur la plus folle qui ait circulé sur toi ?" },
  { id: 'pt-26', pack: 'trash', type: 'defi', text: "Fais une imitation de toi-même en mode complètement ivre." },
  { id: 'pt-27', pack: 'trash', type: 'action', text: "Révèle ton pire date en 20 secondes chrono, sans donner de nom." },
  { id: 'pt-28', pack: 'trash', type: 'verite', text: "Quel secret pourrais-tu balancer sur quelqu'un ici… mais tu ne le feras pas ?" },
  { id: 'pt-29', pack: 'trash', type: 'defi', text: "Laisse le groupe choisir un filtre ridicule que tu gardes 2 tours." },
  { id: 'pt-30', pack: 'trash', type: 'action', text: "Avoue une chose que tu as déjà faite et que tes parents ignorent encore." },
  { id: 'pt-31', pack: 'trash', type: 'verite', text: "As-tu déjà fait semblant d'aimer un cadeau ? C'était quoi, et de qui ?" },
  { id: 'pt-32', pack: 'trash', type: 'defi', text: "Appelle un contact et chante-lui « joyeux anniversaire », peu importe la date." },
  { id: 'pt-33', pack: 'trash', type: 'action', text: "Dis quelle célébrité serait ton joker « liste ». On ne juge pas." },
  { id: 'pt-34', pack: 'trash', type: 'verite', text: "Le vrai chiffre : combien de partenaires tu as vraiment eu ?" },
  { id: 'pt-35', pack: 'trash', type: 'action', text: "Décris ta position préférée au lit… avec les gestes." },
  { id: 'pt-36', pack: 'trash', type: 'defi', text: "Envoie « t'es chaud·e ? » à ton dernier match et lis la réponse à voix haute." },
  { id: 'pt-37', pack: 'trash', type: 'verite', text: "Quel est l'endroit le plus improbable où tu as couché ?" },
  { id: 'pt-38', pack: 'trash', type: 'action', text: "Mime ton orgasme le plus théâtral — le groupe te note sur 10." },
  { id: 'pt-39', pack: 'trash', type: 'verite', text: "T'as déjà simulé ? Avec qui et pourquoi (sans donner de nom) ?" },
  { id: 'pt-40', pack: 'trash', type: 'defi', text: "Montre la photo la plus sexy de ta galerie… ou cul sec." },
  { id: 'pt-41', pack: 'trash', type: 'verite', text: "Ton pire craquage : avec qui tu n'aurais JAMAIS dû coucher ?" },
  { id: 'pt-42', pack: 'trash', type: 'action', text: "Classe la table du plus au moins bon coup, selon ton pur instinct." },
  { id: 'pt-43', pack: 'trash', type: 'verite', text: "La chose la plus sale que tu aies faite pour du sexe ?" },
  { id: 'pt-44', pack: 'trash', type: 'action', text: "Avoue quel·le joueur·se tu materais si tu étais célibataire ce soir." },
  { id: 'pt-45', pack: 'trash', type: 'verite', text: "Ta recherche la plus honteuse en navigation privée, c'était quoi ?" },
]

export function partyCardsForPack(pack: PartyCardPack | 'mixed'): PartyCard[] {
  if (pack === 'classic') return CLASSIC_PARTY_CARDS
  if (pack === 'trash') return TRASH_PARTY_CARDS
  return [...CLASSIC_PARTY_CARDS, ...TRASH_PARTY_CARDS]
}
