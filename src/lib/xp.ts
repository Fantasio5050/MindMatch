const MAX_LEVEL = 30

function thresholdForLevel(level: number): number {
  // Cumulative XP required to reach this level. Slowly increasing curve.
  return Math.round(80 * (level - 1) ** 1.5)
}

export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xp >= thresholdForLevel(level + 1)) {
    level++
  }
  return level
}

export interface LevelProgress {
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  isMaxLevel: boolean
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp)
  const isMaxLevel = level >= MAX_LEVEL
  const floor = thresholdForLevel(level)
  const ceiling = isMaxLevel ? floor : thresholdForLevel(level + 1)
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNextLevel: isMaxLevel ? 0 : ceiling - floor,
    isMaxLevel,
  }
}
