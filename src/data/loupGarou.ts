/**
 * Loup-Garou de Thiercelieux — données du jeu
 * Rôles, camps, paramètres et constantes
 */

export type RoleId =
  | 'villageois'
  | 'loup-garou'
  | 'voyante'
  | 'sorciere'
  | 'chasseur'
  | 'cupidon'
  | 'salvateur'
  | 'petite-fille';

export type Camp = 'village' | 'loups' | 'neutre';

export type Phase =
  | 'intro'
  | 'role-reveal'
  | 'night'
  | 'day'
  | 'vote'
  | 'reveal'
  | 'hunter-shot'
  | 'ended';

export type NightStep =
  | 'cupidon'
  | 'voyante'
  | 'salvateur'
  | 'loups'
  | 'sorciere'
  | 'petite-fille';

export interface Role {
  id: RoleId;
  name: string;
  camp: Camp;
  description: string;
  nightAction?: {
    step: NightStep;
    description: string;
    canSkip?: boolean;
  };
  minPlayers?: number;
  maxCount?: number;
  weight?: number; // pour distribution équilibrée
}

export interface GameSettings {
  minPlayers: number;
  maxPlayers: number;
  roles: RoleId[];
  roleCounts: Record<RoleId, number>;
  nightOrder: NightStep[];
}

export const ROLES: Record<RoleId, Role> = {
  'villageois': {
    id: 'villageois',
    name: 'Villageois',
    camp: 'village',
    description: 'Aucun pouvoir spécial. Vous votez le jour pour éliminer les loups.',
    minPlayers: 0,
    weight: 3,
  },
  'loup-garou': {
    id: 'loup-garou',
    name: 'Loup-Garou',
    camp: 'loups',
    description: 'Chaque nuit, les loups se concertent et dévorent un villageois.',
    nightAction: {
      step: 'loups',
      description: 'Votez avec les autres loups pour choisir une victime.',
    },
    minPlayers: 2,
    maxCount: 3,
    weight: 1,
  },
  'voyante': {
    id: 'voyante',
    name: 'Voyante',
    camp: 'village',
    description: 'Chaque nuit, vous découvrez le rôle exact d\'un joueur.',
    nightAction: {
      step: 'voyante',
      description: 'Choisissez un joueur dont vous voulez connaître le rôle.',
    },
    minPlayers: 1,
    maxCount: 1,
    weight: 1,
  },
  'sorciere': {
    id: 'sorciere',
    name: 'Sorcière',
    camp: 'village',
    description: 'Vous avez une potion de guérison et une potion de mort (une seule utilisation chacune).',
    nightAction: {
      step: 'sorciere',
      description: 'Décidez d\'utiliser la potion de guérison sur la victime, la potion de mort sur quelqu\'un, ou passez.',
      canSkip: true,
    },
    minPlayers: 1,
    maxCount: 1,
    weight: 1,
  },
  'chasseur': {
    id: 'chasseur',
    name: 'Chasseur',
    camp: 'village',
    description: 'Au moment de votre mort, vous emportez un joueur de votre choix avec vous.',
    minPlayers: 1,
    maxCount: 1,
    weight: 1,
  },
  'cupidon': {
    id: 'cupidon',
    name: 'Cupidon',
    camp: 'neutre',
    description: 'Vous liez deux joueurs qui deviennent amoureux. Si l\'un meurt, l\'autre se suicide.',
    nightAction: {
      step: 'cupidon',
      description: 'Choisissez deux joueurs à lier par l\'amour.',
    },
    minPlayers: 1,
    maxCount: 1,
    weight: 1,
  },
  'salvateur': {
    id: 'salvateur',
    name: 'Salvateur',
    camp: 'village',
    description: 'Chaque nuit, vous protégez un joueur des loups (pas deux fois le même d\'affilée).',
    nightAction: {
      step: 'salvateur',
      description: 'Choisissez un joueur à protéger cette nuit.',
    },
    minPlayers: 1,
    maxCount: 1,
    weight: 1,
  },
  'petite-fille': {
    id: 'petite-fille',
    name: 'Petite Fille',
    camp: 'village',
    description: 'Pendant la nuit, vous espionnez les loups et voyez qui ils sont (mais pas qui ils attaquent).',
    nightAction: {
      step: 'petite-fille',
      description: 'Ouvrez l\'œil : vous voyez les IDs de tous les loups-garous.',
    },
    minPlayers: 1,
    maxCount: 1,
    weight: 1,
  },
};

export const NIGHT_ORDER: NightStep[] = [
  'cupidon',
  'voyante',
  'salvateur',
  'loups',
  'sorciere',
  'petite-fille',
];

export const DEFAULT_ROLE_COUNTS: Record<RoleId, number> = {
  'villageois': 0, // calculé dynamiquement
  'loup-garou': 2,
  'voyante': 1,
  'sorciere': 1,
  'chasseur': 1,
  'cupidon': 1,
  'salvateur': 1,
  'petite-fille': 1,
};

export const GAME_SETTINGS: GameSettings = {
  minPlayers: 8,
  maxPlayers: 18,
  roles: [
    'loup-garou',
    'voyante',
    'sorciere',
    'chasseur',
    'cupidon',
    'salvateur',
    'petite-fille',
    'villageois',
  ],
  roleCounts: DEFAULT_ROLE_COUNTS,
  nightOrder: NIGHT_ORDER,
};

export function computeRoleCounts(playerCount: number): Record<RoleId, number> {
  const counts: Record<RoleId, number> = { ...DEFAULT_ROLE_COUNTS };
  
  // Base roles (toujours présents)
  const baseRoles: RoleId[] = [
    'loup-garou',
    'voyante',
    'sorciere',
    'chasseur',
    'cupidon',
    'salvateur',
    'petite-fille',
  ];
  
  // Ajustement selon le nombre de joueurs
  let specialCount = baseRoles.length;
  
  // Pour 8-9 joueurs : 2 loups, 6 spéciaux, reste villageois
  // Pour 10-12 : 2 loups, 7 spéciaux
  // Pour 13-15 : 3 loups, 7 spéciaux
  // Pour 16+ : 3 loups, 8 spéciaux
  
  if (playerCount >= 13) {
    counts['loup-garou'] = 3;
  }
  
  specialCount = baseRoles.length + (counts['loup-garou'] - 2);
  
  counts['villageois'] = Math.max(0, playerCount - specialCount);
  
  return counts;
}

export function getRoleById(id: RoleId): Role {
  return ROLES[id];
}

export function getRolesByCamp(camp: Camp): Role[] {
  return Object.values(ROLES).filter(r => r.camp === camp);
}

export function isNightRole(roleId: RoleId): boolean {
  return !!ROLES[roleId].nightAction;
}

export function getNightStepForRole(roleId: RoleId): NightStep | undefined {
  return ROLES[roleId].nightAction?.step;
}