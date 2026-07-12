import type { ComponentType } from 'react'
import { WhoIsMostLikelyController } from './games/whoIsMostLikely/ControllerView'
import { WhoIsMostLikelyScreen } from './games/whoIsMostLikely/ScreenView'
import { DilemmasController } from './games/dilemmas/ControllerView'
import { DilemmasScreen } from './games/dilemmas/ScreenView'
import { PyramidController } from './games/pyramid/ControllerView'
import { PyramidScreen } from './games/pyramid/ScreenView'
import { SecretProfileController } from './games/secretProfile/ControllerView'
import { SecretProfileScreen } from './games/secretProfile/ScreenView'
import { PartyCardsController } from './games/partyCards/ControllerView'
import { PartyCardsScreen } from './games/partyCards/ScreenView'
import { WhoWroteItController } from './games/whoWroteIt/ControllerView'
import { WhoWroteItScreen } from './games/whoWroteIt/ScreenView'
import { GuessMyAnswerController } from './games/guessMyAnswer/ControllerView'
import { GuessMyAnswerScreen } from './games/guessMyAnswer/ScreenView'
import { PalmierController } from './games/palmier/ControllerView'
import { PalmierScreen } from './games/palmier/ScreenView'
import { AutorouteController } from './games/autoroute/ControllerView'
import { AutorouteScreen } from './games/autoroute/ScreenView'

interface ClientGameEntry {
  Controller: ComponentType
  Screen: ComponentType
}

export const CLIENT_GAME_REGISTRY: Record<string, ClientGameEntry> = {
  'who-is-most-likely': { Controller: WhoIsMostLikelyController, Screen: WhoIsMostLikelyScreen },
  dilemmas: { Controller: DilemmasController, Screen: DilemmasScreen },
  pyramid: { Controller: PyramidController, Screen: PyramidScreen },
  'secret-profile': { Controller: SecretProfileController, Screen: SecretProfileScreen },
  'party-cards': { Controller: PartyCardsController, Screen: PartyCardsScreen },
  'who-wrote-it': { Controller: WhoWroteItController, Screen: WhoWroteItScreen },
  'guess-my-answer': { Controller: GuessMyAnswerController, Screen: GuessMyAnswerScreen },
  palmier: { Controller: PalmierController, Screen: PalmierScreen },
  autoroute: { Controller: AutorouteController, Screen: AutorouteScreen },
}
