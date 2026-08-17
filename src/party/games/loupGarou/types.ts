import type { RoleId, Phase, NightStep, Camp } from '../../../data/loupGarou'

export type { RoleId, Phase, NightStep, Camp }

export interface LoupGarouDead {
  memberId: string
  role: RoleId
  cause: string
}

export interface LoupGarouClientState {
  phase: Phase
  nightStep: NightStep | null
  alive: string[]
  dead: LoupGarouDead[]
  yourRole: RoleId | null
  yourLover: { memberId: string; pseudo: string } | null
  voyanteResult: { memberId: string; role: RoleId } | null
  loupsMembers: string[] | null
  petiteFilleInfo: string[] | null
  currentVoter: string | null
  currentNightStep: NightStep | null
  dayNumber: number
  voteResults: Record<string, number> | null
  dayVotes: Record<string, string>
  winner: 'village' | 'loups' | 'lovers' | null
  killTarget: string | null
  protectedTarget: string | null
  healedThisNight: boolean
  sorciereHealUsed: boolean
  sorciereKillUsed: boolean
  nightVotes: Record<string, string>
  history: { day: number; event: string }[]
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