import { GAME_LIBRARY } from './gameLibrary'

export interface GameMeta {
  id: string
  name: string
}

/** Nom affichable de chaque jeu, dérivé du catalogue : un jeu ajouté au catalogue a son nom partout
 * (la liste tenue à la main ici en avait oublié la moitié). */
export const GAME_META: Record<string, GameMeta> = Object.fromEntries(GAME_LIBRARY.map((e) => [e.id, { id: e.id, name: e.name }]))
