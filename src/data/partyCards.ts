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
]

export function partyCardsForPack(pack: PartyCardPack | 'mixed'): PartyCard[] {
  if (pack === 'classic') return CLASSIC_PARTY_CARDS
  if (pack === 'trash') return TRASH_PARTY_CARDS
  return [...CLASSIC_PARTY_CARDS, ...TRASH_PARTY_CARDS]
}
