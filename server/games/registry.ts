import type { GameModule } from './types'
import { whoIsMostLikely } from './whoIsMostLikely'
import { dilemmas } from './dilemmas'
import { pyramid } from './pyramid'

export const GAME_REGISTRY: Record<string, GameModule> = {
  [whoIsMostLikely.id]: whoIsMostLikely,
  [dilemmas.id]: dilemmas,
  [pyramid.id]: pyramid,
}

export function getGame(gameId: string): GameModule | null {
  return GAME_REGISTRY[gameId] ?? null
}

export const AVAILABLE_GAME_IDS = Object.keys(GAME_REGISTRY)
