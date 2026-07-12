import type { ComponentType } from 'react'
import { WhoIsMostLikelyController } from './games/whoIsMostLikely/ControllerView'
import { WhoIsMostLikelyScreen } from './games/whoIsMostLikely/ScreenView'

interface ClientGameEntry {
  Controller: ComponentType
  Screen: ComponentType
}

export const CLIENT_GAME_REGISTRY: Record<string, ClientGameEntry> = {
  'who-is-most-likely': { Controller: WhoIsMostLikelyController, Screen: WhoIsMostLikelyScreen },
}
