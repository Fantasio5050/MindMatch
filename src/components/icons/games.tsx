import { Icon, type IconProps } from './Icon'

/**
 * Les 17 marques de jeu.
 *
 * Règle de dessin : une idée par icône, lisible à 16 px. Quand un jeu se raconte par son OBJET
 * (une roue, un fer à cheval, un barillet), on dessine l'objet ; quand il se raconte par sa
 * MÉCANIQUE (l'intrus, le dilemme), on dessine la mécanique — c'est plus juste et ça évite la
 * pantomime illustrative que produisaient les emojis.
 */

/** Qui est le plus ? — l'étoile qu'on décerne à quelqu'un. */
export const IconMostLikely = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" />
  </Icon>
)

/** Blackjack — deux cartes servies, la seconde en biais. */
export const IconBlackjack = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="9.5" height="14" rx="2" />
    <rect x="12" y="5" width="9.5" height="14" rx="2" transform="rotate(14 12 5)" />
  </Icon>
)

/** Dilemmes & Débats — la balance : deux plateaux, un choix. */
export const IconDilemma = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v16M7 20h10M4 8h16M4 8l-2.4 5h4.8zM20 8l2.4 5h-4.8z" />
  </Icon>
)

/** Cartes de soirée — l'éventail qu'on tend au joueur suivant. */
export const IconPartyCards = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8" y="6" width="9" height="13" rx="2" />
    <path d="M6.6 8.4l-1.8.6a2 2 0 00-1.2 2.5l2.2 6.6" />
    <path d="M18.4 8.4l1.8.6a2 2 0 011.2 2.5l-2.2 6.6" />
  </Icon>
)

/** Qui a écrit ça ? — le stylo et la ligne qu'il vient de tracer. */
export const IconWhoWroteIt = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16.4 2.9l4.7 4.7-11 11-6 1.3 1.3-6z" />
    <path d="M13.8 5.5l4.7 4.7" />
    <path d="M3 21.5h18" />
  </Icon>
)

/** Devine ma réponse — la bulle où l'on tente une réponse. */
export const IconGuessAnswer = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12.5a7.5 7.5 0 01-7.5 7.5H8l-4 3v-4.6A7.5 7.5 0 0112.5 5 7.5 7.5 0 0120 12.5z" />
    <path d="M10.5 10.6a2.1 2.1 0 013.9 1c0 1.4-2 1.7-2 3" />
    <circle cx="12.4" cy="17.1" r=".7" fill="currentColor" stroke="none" />
  </Icon>
)

/** Profil secret — une silhouette, et la question qu'elle pose. */
export const IconSecretProfile = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0113 0" />
    <path d="M16.4 6.4a2.4 2.4 0 014.4 1.2c0 1.6-2.2 1.9-2.2 3.4" />
    <circle cx="18.6" cy="14.1" r=".8" fill="currentColor" stroke="none" />
  </Icon>
)

/** Coup de Crayon — le crayon et son trait. */
export const IconCrayon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 3.5l6 6-9 9-6 1 1-6z" />
    <path d="M12.5 5.5l6 6" />
    <path d="M3 21c2-1.5 4-1.5 6 0" />
  </Icon>
)

/** L'Intrus — trois pareils, un qui ne l'est pas. C'est la mécanique, pas un détective. */
export const IconIntrus = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="3" />
    <circle cx="17" cy="7" r="3" />
    <circle cx="7" cy="17" r="3" />
    <path d="M17 13.8l3.2 6.2h-6.4z" />
  </Icon>
)

/** Le Grand Blanc — la carte à trou qu'il faut remplir. */
export const IconBlanc = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7 9.5h4M14 9.5h3" />
    <path d="M7 14.5h10" strokeDasharray="3 2.5" />
  </Icon>
)

/** Petits Chevaux — le pion, pas le cheval : c'est un jeu de plateau. */
export const IconPawn = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="6.5" r="3" />
    <path d="M9.2 9.4c0 2-1.2 2.8-1.2 4.3 0 1.2 1 1.9 1 3.3H15c0-1.4 1-2.1 1-3.3 0-1.5-1.2-2.3-1.2-4.3" />
    <path d="M6 20.5h12l-1-3.5H7z" />
  </Icon>
)

/** Pyramide — les cartes empilées, sommet en haut. */
export const IconPyramid = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9.5" y="3" width="5" height="6" rx="1" />
    <rect x="5" y="10.5" width="5" height="6" rx="1" />
    <rect x="14" y="10.5" width="5" height="6" rx="1" />
    <path d="M3 20.5h18" />
  </Icon>
)

/** Palmier — le tronc penché et ses palmes retombantes. */
export const IconPalmier = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 7.5c-.8 4.5-1.5 8.8-1.3 13" />
    <path d="M13.5 7.5C11.6 4.7 8 4.2 5.5 6.3" />
    <path d="M13.5 7.5C12.9 4.2 10.2 2 7.2 2.3" />
    <path d="M13.5 7.5c2.4-1.9 5.6-1.5 7.3.9" />
    <path d="M13.5 7.5c1.4-2.7 4.4-3.7 7-2.6" />
    <path d="M8.5 20.5h7" />
  </Icon>
)

/** Autoroute — la route qui file, avec sa bande centrale. */
export const IconHighway = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3L4 21M16 3l4 18" />
    <path d="M12 4v3M12 10.5v3M12 17v3" />
  </Icon>
)

/** PMU — le fer à cheval, l'objet du turf. */
export const IconHorseshoe = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 20.5V14a5 5 0 0110 0v6.5" />
    <path d="M5 20.5h4M15 20.5h4" />
    <circle cx="9.4" cy="10.5" r=".8" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="10.5" r=".8" fill="currentColor" stroke="none" />
  </Icon>
)

/** Roue Infernale — la roue et son taquet. */
export const IconWheel = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 5v16M4 13h16M6.3 7.3l11.4 11.4M17.7 7.3L6.3 18.7" />
    <path d="M12 1.8l2 3h-4z" fill="currentColor" stroke="none" />
  </Icon>
)

/** Roulette russe — le barillet. On dessine le mécanisme, jamais l'arme. */
export const IconRevolver = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="6.4" r="1.5" />
    <circle cx="16.8" cy="9.2" r="1.5" />
    <circle cx="16.8" cy="14.8" r="1.5" />
    <circle cx="12" cy="17.6" r="1.5" />
    <circle cx="7.2" cy="14.8" r="1.5" />
    <circle cx="7.2" cy="9.2" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
)

/** Le test de personnalité — pas un jeu, mais il a sa marque : le radar des traits. */
export const IconProfile = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2.5l8.2 6-3.1 9.8H6.9L3.8 8.5z" />
    <path d="M12 8l3.6 2.6-1.4 4.3H9.8l-1.4-4.3z" />
  </Icon>
)

/** Mode Soirée — la platine partagée. */
export const IconTurntable = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M18.4 6.9l-4.6 3.4" />
  </Icon>
)

/** Registre des marques, indexé par l'id de module serveur. Volontairement interne : tout le
 * produit passe par `<GameIcon gameId=… />`, ce qui garantit un repli propre pour un jeu inconnu. */
const GAME_ICON: Record<string, (p: IconProps) => React.ReactElement> = {
  'who-is-most-likely': IconMostLikely,
  blackjack: IconBlackjack,
  dilemmas: IconDilemma,
  'party-cards': IconPartyCards,
  'who-wrote-it': IconWhoWroteIt,
  'guess-my-answer': IconGuessAnswer,
  'secret-profile': IconSecretProfile,
  'coup-de-crayon': IconCrayon,
  intrus: IconIntrus,
  blanc: IconBlanc,
  'petits-chevaux': IconPawn,
  pyramid: IconPyramid,
  palmier: IconPalmier,
  autoroute: IconHighway,
  pmu: IconHorseshoe,
  wheel: IconWheel,
  'russian-roulette': IconRevolver,
}

/** Marque d'un jeu par son id, avec une repli neutre pour un module inconnu. */
export function GameIcon({ gameId, ...rest }: IconProps & { gameId: string }) {
  const Mark = GAME_ICON[gameId]
  if (Mark) return <Mark {...rest} />
  return (
    <Icon {...rest}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M8 12h8" />
    </Icon>
  )
}
