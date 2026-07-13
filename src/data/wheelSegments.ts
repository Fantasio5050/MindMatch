/** Segments de la Roue Infernale + gages — partagés entre le serveur (résolution des spins) et
 * les clients (texture 3D de la TV, roue SVG des téléphones), pour que rien ne puisse diverger. */

export type WheelSegmentType =
  | 'drink' // le lanceur boit `value` gorgées
  | 'give' // le lanceur distribue `value` gorgées (splittables)
  | 'everyone' // tout le monde boit 1
  | 'neighbors' // les voisins du lanceur boivent 2
  | 'gage' // gage tiré au sort — refus = 3 gorgées
  | 'immunity' // annule la prochaine gorgée imposée par la roue
  | 'respin' // le lanceur rejoue
  | 'culsec' // cul sec (compte 5 gorgées au classement)

export interface WheelSegment {
  id: string
  type: WheelSegmentType
  value?: number
  label: string
  emoji: string
  color: string
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { id: 'drink-2', type: 'drink', value: 2, label: 'Tu bois 2', emoji: '🍻', color: '#e0447c' },
  { id: 'give-2', type: 'give', value: 2, label: 'Distribue 2', emoji: '🎁', color: '#2fa46a' },
  { id: 'everyone', type: 'everyone', label: 'Tout le monde boit', emoji: '🌊', color: '#2f7fd4' },
  { id: 'gage-1', type: 'gage', label: 'Gage !', emoji: '🎭', color: '#8b5cf6' },
  { id: 'drink-3', type: 'drink', value: 3, label: 'Tu bois 3', emoji: '🍺', color: '#c02652' },
  { id: 'immunity', type: 'immunity', label: 'Immunité', emoji: '🛡️', color: '#d8a022' },
  { id: 'neighbors', type: 'neighbors', label: 'Tes voisins boivent 2', emoji: '🫂', color: '#0ea5a8' },
  { id: 'give-3', type: 'give', value: 3, label: 'Distribue 3', emoji: '💝', color: '#1f7a50' },
  { id: 'respin', type: 'respin', label: 'Rejoue !', emoji: '🔄', color: '#64748b' },
  { id: 'gage-2', type: 'gage', label: 'Gage !', emoji: '🎪', color: '#7c3aed' },
  { id: 'culsec', type: 'culsec', label: 'CUL SEC', emoji: '🥃', color: '#1b1426' },
  { id: 'drink-1', type: 'drink', value: 1, label: 'Tu bois 1', emoji: '🥂', color: '#ec6f9c' },
]

export const WHEEL_SEGMENT_COUNT = WHEEL_SEGMENTS.length
export const WHEEL_SEGMENT_DEG = 360 / WHEEL_SEGMENT_COUNT

/** Nombre de gorgées comptées au classement pour un cul sec. */
export const CULSEC_SIPS = 5

export const WHEEL_GAGES: string[] = [
  'Imite un animal choisi par le groupe jusqu\'à ton prochain tour.',
  'Parle avec un accent (au choix du groupe) pendant 2 tours.',
  'Fais 10 pompes ou 20 squats, au choix.',
  'Montre la dernière photo de ta galerie au groupe.',
  'Danse 15 secondes sans musique, avec conviction.',
  'Raconte ton pire rencard en 30 secondes.',
  'Fais un compliment sincère à chaque joueur.',
  'Chante le refrain d\'une chanson choisie par ton voisin de gauche.',
  'Ferme les yeux jusqu\'à ton prochain tour.',
  'Parle en chuchotant pendant 2 tours.',
  'Traverse la pièce en canard, aller-retour.',
  'Imite un joueur du groupe — les autres doivent deviner qui.',
  'Tiens la pose du flamant rose pendant 30 secondes.',
  'Ton voisin de droite invente ton gage. Bonne chance.',
  'Termine chacune de tes phrases par « voilà voilà » pendant 2 tours.',
  'Fais deviner un film uniquement en mimant, 30 secondes max.',
]
