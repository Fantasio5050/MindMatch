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
import { PmuController } from './games/pmu/ControllerView'
import { PmuScreen } from './games/pmu/ScreenView'
import { WheelController } from './games/wheel/ControllerView'
import { WheelScreen } from './games/wheel/ScreenView'
import { RussianRouletteController } from './games/russianRoulette/ControllerView'
import { RussianRouletteScreen } from './games/russianRoulette/ScreenView'
import { BlackjackController } from './games/blackjack/ControllerView'
import { BlackjackScreen } from './games/blackjack/ScreenView'
import { BlancController } from './games/blanc/ControllerView'
import { BlancScreen } from './games/blanc/ScreenView'
import { PetitsChevauxController } from './games/petitsChevaux/ControllerView'
import { PetitsChevauxScreen } from './games/petitsChevaux/ScreenView'
import { CoupDeCrayonController } from './games/coupDeCrayon/ControllerView'
import { CoupDeCrayonScreen } from './games/coupDeCrayon/ScreenView'
import { IntrusController } from './games/intrus/ControllerView'
import { IntrusScreen } from './games/intrus/ScreenView'
import { OneWordStoryController } from './games/oneWordStory/ControllerView'
import { OneWordStoryScreen } from './games/oneWordStory/ScreenView'
import { TruthOrDareController } from './games/truthOrDare/ControllerView'
import { TruthOrDareScreen } from './games/truthOrDare/ScreenView'
import { LoupGarouController } from './games/loupGarou/ControllerView'
import { LoupGarouScreen } from './games/loupGarou/ScreenView'
import { TimesUpController } from './games/timesUp/ControllerView'
import { TimesUpScreen } from './games/timesUp/ScreenView'
import { QuiproquoController } from './games/quiproquo/ControllerView'
import { QuiproquoScreen } from './games/quiproquo/ScreenView'
import { UnoController } from './games/uno/ControllerView'
import { UnoScreen } from './games/uno/ScreenView'
import { PokerController } from './games/poker/ControllerView'
import { PokerScreen } from './games/poker/ScreenView'

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
  pmu: { Controller: PmuController, Screen: PmuScreen },
  wheel: { Controller: WheelController, Screen: WheelScreen },
  'russian-roulette': { Controller: RussianRouletteController, Screen: RussianRouletteScreen },
  blackjack: { Controller: BlackjackController, Screen: BlackjackScreen },
  blanc: { Controller: BlancController, Screen: BlancScreen },
  'petits-chevaux': { Controller: PetitsChevauxController, Screen: PetitsChevauxScreen },
  'coup-de-crayon': { Controller: CoupDeCrayonController, Screen: CoupDeCrayonScreen },
  intrus: { Controller: IntrusController, Screen: IntrusScreen },
  'one-word-story': { Controller: OneWordStoryController, Screen: OneWordStoryScreen },
  'truth-or-dare': { Controller: TruthOrDareController, Screen: TruthOrDareScreen },
  'loup-garou': { Controller: LoupGarouController, Screen: LoupGarouScreen },
  'times-up': { Controller: TimesUpController, Screen: TimesUpScreen },
  quiproquo: { Controller: QuiproquoController, Screen: QuiproquoScreen },
  uno: { Controller: UnoController, Screen: UnoScreen },
  poker: { Controller: PokerController, Screen: PokerScreen },
}
