import type { GameModule } from './types'
import { whoIsMostLikely } from './whoIsMostLikely'

export const GAME_REGISTRY: Record<string, GameModule> = {
  [whoIsMostLikely.id]: whoIsMostLikely,
}

export function getGame(gameId: string): GameModule | null {
  return GAME_REGISTRY[gameId] ?? null
}

export const AVAILABLE_GAME_IDS = Object.keys(GAME_REGISTRY)
