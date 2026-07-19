/** Petits Chevaux à boire — plateau façon jeu de l'oie (18+). Chacun lance le dé à son tour, avance
 * son pion sur un plateau en serpentin, et déclenche l'événement de la case (boire, distribuer,
 * avancer, reculer, gage, cul sec…). Atterrir pile sur un adversaire le renvoie au départ (et il
 * boit). Premier·ère à l'arrivée gagne. Partagé client/serveur : le serveur fait foi sur les
 * déplacements, le client anime le plateau. */

export type PCCellType =
  | 'start' // départ
  | 'normal' // rien
  | 'drink' // le joueur boit `value`
  | 'everyone' // tout le monde boit 1
  | 'forward' // avance de `value`
  | 'back' // recule de `value`
  | 'gage' // gage tiré au sort — à faire ou boire 3
  | 'culsec' // cul sec (compte 5 gorgées)
  | 'finish' // arrivée

export interface PCCell {
  index: number
  type: PCCellType
  value?: number
  label: string
  emoji: string
}

/** Gorgées infligées au joueur renvoyé au départ par une capture. */
export const PC_CAPTURE_SIPS = 2
/** Gorgées comptées pour un cul sec. */
export const PC_CULSEC_SIPS = 5
/** Gorgées d'un gage refusé. */
export const PC_GAGE_REFUSAL_SIPS = 3

export const PC_TRACK: PCCell[] = [
  { index: 0, type: 'start', label: 'Départ', emoji: '🏁' },
  { index: 1, type: 'normal', label: '', emoji: '' },
  { index: 2, type: 'drink', value: 1, label: 'Bois 1', emoji: '🍺' },
  { index: 3, type: 'normal', label: '', emoji: '' },
  { index: 4, type: 'forward', value: 2, label: 'Raccourci ! Avance de 2', emoji: '🚀' },
  { index: 5, type: 'gage', label: 'Gage !', emoji: '🎭' },
  { index: 6, type: 'normal', label: '', emoji: '' },
  { index: 7, type: 'everyone', label: 'Tournée : tout le monde boit 1', emoji: '🌊' },
  { index: 8, type: 'back', value: 2, label: 'Nid-de-poule, recule de 2', emoji: '🕳️' },
  { index: 9, type: 'normal', label: '', emoji: '' },
  { index: 10, type: 'drink', value: 2, label: 'Bois 2', emoji: '🍻' },
  { index: 11, type: 'normal', label: '', emoji: '' },
  { index: 12, type: 'gage', label: 'Gage !', emoji: '🎪' },
  { index: 13, type: 'forward', value: 1, label: 'Coup de pouce, avance de 1', emoji: '✨' },
  { index: 14, type: 'normal', label: '', emoji: '' },
  { index: 15, type: 'culsec', label: 'CUL SEC !', emoji: '🥃' },
  { index: 16, type: 'normal', label: '', emoji: '' },
  { index: 17, type: 'drink', value: 1, label: 'Bois 1', emoji: '🍺' },
  { index: 18, type: 'back', value: 3, label: 'Toboggan, recule de 3', emoji: '🐍' },
  { index: 19, type: 'normal', label: '', emoji: '' },
  { index: 20, type: 'everyone', label: 'Tout le monde boit 1', emoji: '🌊' },
  { index: 21, type: 'gage', label: 'Gage !', emoji: '🎭' },
  { index: 22, type: 'normal', label: '', emoji: '' },
  { index: 23, type: 'drink', value: 2, label: 'Bois 2', emoji: '🍻' },
  { index: 24, type: 'forward', value: 2, label: 'Dernière ligne droite, avance de 2', emoji: '🏇' },
  { index: 25, type: 'normal', label: '', emoji: '' },
  { index: 26, type: 'gage', label: 'Gage !', emoji: '🎪' },
  { index: 27, type: 'drink', value: 1, label: 'Bois 1', emoji: '🍺' },
  { index: 28, type: 'normal', label: '', emoji: '' },
  { index: 29, type: 'finish', label: 'Arrivée', emoji: '🏆' },
]

export const PC_TRACK_LENGTH = PC_TRACK.length
export const PC_FINISH_INDEX = PC_TRACK_LENGTH - 1

/** Les 4 couleurs classiques des chevaux — chaque joueur choisit la sienne (doublons autorisés
 * au-delà de 4 joueurs). Ordre/positions des écuries : vert en haut-gauche, jaune en haut-droite,
 * rouge en bas-droite, bleu en bas-gauche (comme un vrai plateau de petits chevaux). */
export interface PCHorseColor {
  key: string
  name: string
  hex: string
}

export const PC_HORSE_COLORS: PCHorseColor[] = [
  { key: 'green', name: 'Vert', hex: '#3fa45b' },
  { key: 'yellow', name: 'Jaune', hex: '#e2b325' },
  { key: 'red', name: 'Rouge', hex: '#d23b3b' },
  { key: 'blue', name: 'Bleu', hex: '#2f74d0' },
]

export const PC_COLOR_HEX: Record<string, string> = Object.fromEntries(PC_HORSE_COLORS.map((c) => [c.key, c.hex]))

export function pcColorHex(key: string | undefined): string {
  return (key && PC_COLOR_HEX[key]) || '#9aa0a6'
}
