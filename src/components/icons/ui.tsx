import { Icon, type IconProps } from './Icon'

/**
 * Les marques d'interface.
 *
 * Elles remplacent les emojis qui servaient de boutons (⚙️, 📺, 🔒, ⛶, ✓…). La différence n'est
 * pas cosmétique : un emoji change de dessin d'un téléphone à l'autre, ne prend pas la couleur du
 * texte, et ne sait pas dire qu'il est désactivé. Une icône, si.
 */

export const IconChevron = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Icon>
)

export const IconArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Icon>
)

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
  </Icon>
)

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
    <path d="M8 10V7.5a4 4 0 018 0V10" />
  </Icon>
)

/** L'écran partagé — la TV du salon. */
export const IconScreen = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
    <path d="M8 20.5h8M12 17v3.5" />
  </Icon>
)

export const IconFullscreen = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V5.5A1.5 1.5 0 015.5 4H9M15 4h3.5A1.5 1.5 0 0120 5.5V9M20 15v3.5a1.5 1.5 0 01-1.5 1.5H15M9 20H5.5A1.5 1.5 0 014 18.5V15" />
  </Icon>
)

export const IconFullscreenExit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4v3.5A1.5 1.5 0 017.5 9H4M20 9h-3.5A1.5 1.5 0 0115 7.5V4M15 20v-3.5a1.5 1.5 0 011.5-1.5H20M4 15h3.5A1.5 1.5 0 019 16.5V20" />
  </Icon>
)

export const IconCopy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 5.5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2" />
  </Icon>
)

export const IconCamera = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5A2.5 2.5 0 015.5 6h1.9l1.2-2h6.8l1.2 2h1.9A2.5 2.5 0 0121 8.5v9A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5z" />
    <circle cx="12" cy="13" r="3.6" />
  </Icon>
)

/** L'hôte — la couronne, réservée à ce rôle et à rien d'autre. */
export const IconCrown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7l3.6 3.4L12 4l5.4 6.4L21 7l-2 12H5z" />
  </Icon>
)

export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0113 0" />
    <path d="M16 5.4a3.5 3.5 0 010 6.2M17.5 14.4a6.5 6.5 0 014 5.6" />
  </Icon>
)

export const IconMusic = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18V5.5l11-2V16" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Icon>
)

export const IconPlay = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.8l12 7.2-12 7.2z" />
  </Icon>
)

export const IconSkip = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5.5l9 6.5-9 6.5z" />
    <path d="M18 5v14" />
  </Icon>
)

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l1 12.5a1.5 1.5 0 001.5 1.4h6a1.5 1.5 0 001.5-1.4L17.5 7" />
  </Icon>
)

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </Icon>
)

export const IconTrophy = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4h10v5a5 5 0 01-10 0z" />
    <path d="M7 5.5H4.5V8a3 3 0 003 3M17 5.5h2.5V8a3 3 0 01-3 3" />
    <path d="M12 14v3.5M8.5 20.5h7l-.8-3h-5.4z" />
  </Icon>
)

export const IconTimer = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 1.5M9.5 2.5h5" />
  </Icon>
)

export const IconDice = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
)

/** Réactions — la seule porte d'entrée vers les emojis, qui restent l'expression des joueurs. */
export const IconSmile = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14a4.5 4.5 0 007 0" />
    <circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none" />
  </Icon>
)

export const IconSpeaker = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12.5 5v14L7.5 14.5H4z" />
    <path d="M16 9.6a3.5 3.5 0 010 4.8M18.6 7a7 7 0 010 10" />
  </Icon>
)

export const IconSpeakerOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12.5 5v14L7.5 14.5H4z" />
    <path d="M16.5 10l4 4M20.5 10l-4 4" />
  </Icon>
)

export const IconHeadphones = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 15v-3a8 8 0 0116 0v3" />
    <rect x="2.5" y="14" width="4.5" height="6.5" rx="2" />
    <rect x="17" y="14" width="4.5" height="6.5" rx="2" />
  </Icon>
)

export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20.5a7.5 7.5 0 0115 0" />
  </Icon>
)

export const IconChat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.5 12a7.5 7.5 0 01-7.5 7.5H8.5l-4.5 3v-4.9A7.5 7.5 0 0113 4.5a7.5 7.5 0 017.5 7.5z" />
    <path d="M9 11h8M9 14.5h5" />
  </Icon>
)

/** Le salon : la table autour de laquelle tout se passe. */
export const IconTable = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="12" rx="9" ry="5.5" />
    <circle cx="12" cy="3.8" r="1.6" />
    <circle cx="20.4" cy="12" r="1.6" />
    <circle cx="12" cy="20.2" r="1.6" />
    <circle cx="3.6" cy="12" r="1.6" />
  </Icon>
)
