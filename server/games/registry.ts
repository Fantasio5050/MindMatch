import type { GameModule } from './types'
import { whoIsMostLikely } from './whoIsMostLikely'
import { dilemmas } from './dilemmas'
import { pyramid } from './pyramid'
import { secretProfile } from './secretProfile'
import { partyCards } from './partyCards'
import { whoWroteIt } from './whoWroteIt'
import { guessMyAnswer } from './guessMyAnswer'
import { palmier } from './palmier'
import { autoroute } from './autoroute'
import { pmu } from './pmu'
import { wheel } from './wheel'
import { russianRoulette } from './russianRoulette'

export const GAME_REGISTRY: Record<string, GameModule> = {
  [whoIsMostLikely.id]: whoIsMostLikely,
  [dilemmas.id]: dilemmas,
  [pyramid.id]: pyramid,
  [secretProfile.id]: secretProfile,
  [partyCards.id]: partyCards,
  [whoWroteIt.id]: whoWroteIt,
  [guessMyAnswer.id]: guessMyAnswer,
  [palmier.id]: palmier,
  [autoroute.id]: autoroute,
  [pmu.id]: pmu,
  [wheel.id]: wheel,
  [russianRoulette.id]: russianRoulette,
}

export function getGame(gameId: string): GameModule | null {
  return GAME_REGISTRY[gameId] ?? null
}

export const AVAILABLE_GAME_IDS = Object.keys(GAME_REGISTRY)
