import type { ComponentType } from 'react'
import { WhoIsMostLikelyController } from './games/whoIsMostLikely/ControllerView'
import { WhoIsMostLikelyScreen } from './games/whoIsMostLikely/ScreenView'
import { DilemmasController } from './games/dilemmas/ControllerView'
import { DilemmasScreen } from './games/dilemmas/ScreenView'
import { PyramidController } from './games/pyramid/ControllerView'
import { PyramidScreen } from './games/pyramid/ScreenView'

interface ClientGameEntry {
  Controller: ComponentType
  Screen: ComponentType
}

export const CLIENT_GAME_REGISTRY: Record<string, ClientGameEntry> = {
  'who-is-most-likely': { Controller: WhoIsMostLikelyController, Screen: WhoIsMostLikelyScreen },
  dilemmas: { Controller: DilemmasController, Screen: DilemmasScreen },
  pyramid: { Controller: PyramidController, Screen: PyramidScreen },
}
