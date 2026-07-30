import { createContext, useContext } from 'react'

/**
 * Sur quelle surface une primitive est-elle en train de s'afficher — la scène ou une main ?
 *
 * Le socle sépare les deux rôles : la TV porte le spectacle, le téléphone porte l'appartenance.
 * Jusqu'ici chaque composant devait se le faire dire par une prop `surface="tv"`, qu'on oubliait
 * de passer — et une primitive oubliée rend en typo téléphone sur un écran de 3 mètres.
 *
 * Le contexte est posé une seule fois, par `PartyGameShell`, qui est justement l'endroit qui SAIT
 * s'il rend un contrôleur ou un écran. Les primitives n'ont plus à demander.
 */
export type Surface = 'tv' | 'phone'

/**
 * `null` = on n'est PAS dans le rendu d'une partie (accueil, salon, platine). La distinction
 * compte : hors partie, un téléphone est seul et a le droit de sonner ; en partie, il est un
 * appareil parmi huit dans la même pièce.
 */
export const SurfaceContext = createContext<Surface | null>(null)

export function useSurface(): Surface | null {
  return useContext(SurfaceContext)
}
