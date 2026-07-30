import type { ReactNode, SVGProps } from 'react'

/**
 * Le socle du set d'icônes maison.
 *
 * Pourquoi un set maison plutôt qu'une bibliothèque : MindMatch affichait 111 emojis en guise
 * d'interface. Un emoji n'est pas un choix graphique — c'est la police système de l'appareil, donc
 * un rendu différent sur chaque téléphone, un style qui n'est celui de personne, et aucune
 * cohérence de trait avec le reste. Les emojis restent, mais uniquement là où ils veulent dire
 * quelque chose d'humain : les réactions des joueurs.
 *
 * Contraintes du set, valables pour CHAQUE icône sans exception :
 *  - grille 24×24, marge optique de 2 (le dessin vit dans le carré 2→22) ;
 *  - trait de 1.6, bouts et jonctions arrondis — c'est ce qui donne le côté « gravé » de la table ;
 *  - `currentColor` uniquement : une icône prend la couleur de son texte, jamais la sienne ;
 *  - aucun remplissage, sauf pastilles pleines assumées (points, pépins de cartes).
 *
 * `size` suit l'échelle du produit : 16 (chip), 20 (inline), 24 (défaut), 32 (carte), 64 (scène).
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
  /** Étiquette accessible. Sans elle l'icône est décorative et donc masquée aux lecteurs d'écran. */
  label?: string
}

export function Icon({
  size = 24,
  label,
  children,
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {children}
    </svg>
  )
}
