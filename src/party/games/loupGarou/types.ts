import type { RoleId, Phase, NightStep, Camp } from '../../../data/loupGarou'

export type { RoleId, Phase, NightStep, Camp }

export interface LoupGarouDead {
  memberId: string
  role: RoleId
  cause: string
  day: number
}

/** Vue d'un joueur (ou de la TV) — le serveur n'y met que ce que ce destinataire a le droit de savoir. */
export interface LoupGarouClientState {
  phase: Phase
  dayNumber: number
  players: string[]
  alive: string[]
  dead: LoupGarouDead[]
  /** Étape de nuit en cours (narration : jamais qui la joue) */
  currentNightStep: NightStep | null
  nightStep: NightStep | null
  /** C'est à toi d'agir dans cette étape */
  yourStep: boolean
  currentVoter: string | null
  yourRole: RoleId | null
  yourLover: { memberId: string; pseudo: string } | null
  /** Loups seulement : la meute (vivants et morts) */
  loupsMembers: string[] | null
  /** Loups seulement, pendant leur étape : qui vise qui */
  nightVotes: Record<string, string>
  /** Loups seulement : la petite fille qui les a vus */
  spiedBy: string | null
  /** Loups (leur étape) et sorcière (la sienne) : la victime désignée */
  killTarget: string | null
  sorciereHealUsed: boolean
  sorciereKillUsed: boolean
  healedThisNight: boolean
  poisonTarget: string | null
  /** Salvateur : protégé la nuit précédente (interdit cette nuit) */
  salvateurLast: string | null
  protectedTarget: string | null
  /** Voyante : sa dernière vision */
  voyanteResult: { memberId: string; role: RoleId } | null
  voyanteCheckedTonight: boolean
  /** Petite fille : le loup aperçu cette nuit */
  petiteFilleInfo: string[] | null
  lastNightDeaths: string[]
  /** Morts depuis le vote du jour (verdict, chasseur, chagrin) */
  dayDeaths: LoupGarouDead[]
  dayVotes: Record<string, string>
  voteResults: Record<string, number> | null
  hunterId: string | null
  winner: 'village' | 'loups' | 'lovers' | null
  history: { day: number; event: string }[]
  /** Fin de partie : tous les rôles et le couple */
  allRoles: Record<string, RoleId> | null
  lovers: [string, string] | null
}

export const ROLE_NAMES: Record<RoleId, string> = {
  'villageois': 'Villageois',
  'loup-garou': 'Loup-Garou',
  'voyante': 'Voyante',
  'sorciere': 'Sorcière',
  'chasseur': 'Chasseur',
  'cupidon': 'Cupidon',
  'salvateur': 'Salvateur',
  'petite-fille': 'Petite Fille',
}

export const ROLE_ICONS: Record<RoleId, string> = {
  'villageois': '🧑‍🌾',
  'loup-garou': '🐺',
  'voyante': '🔮',
  'sorciere': '🧪',
  'chasseur': '🔫',
  'cupidon': '🏹',
  'salvateur': '🛡️',
  'petite-fille': '👀',
}

export const ROLE_DESCRIPTIONS: Record<RoleId, string> = {
  'villageois': 'Aucun pouvoir spécial. Vote le jour pour éliminer les loups.',
  'loup-garou': 'Chaque nuit, dévore un villageois avec les autres loups.',
  'voyante': 'Chaque nuit, découvre le rôle d\'un joueur.',
  'sorciere': '1 potion de guérison + 1 potion de mort.',
  'chasseur': 'En mourrant, emporte un joueur avec toi.',
  'cupidon': 'Lie 2 joueurs par l\'amour. Si l\'un meurt, l\'autre se suicide.',
  'salvateur': 'Protège 1 joueur chaque nuit (pas 2x le même d\'affilée).',
  'petite-fille': 'Espionne les loups la nuit.',
}