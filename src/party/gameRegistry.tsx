import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Registre client des jeux, chargés à la demande.
 *
 * Les 24 manettes et les 24 écrans TV étaient importés d'office : chaque téléphone téléchargeait
 * le code de toutes les scènes TV qu'il n'affichera jamais, et de tous les jeux qu'on ne lancera
 * pas ce soir. Chaque vue est désormais un module séparé, chargé au lancement du jeu (le
 * `Suspense` vit dans `PartyGameShell`).
 */
type View = LazyExoticComponent<ComponentType>

function view<M>(load: () => Promise<M>, name: keyof M): View {
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })))
}

interface ClientGameEntry {
  Controller: View
  Screen: View
  /** Écran TV conçu à l'échelle de scène (`Stage`, `text-tv-*`, ou plein écran 3D). Les autres
   * sont posés dans la scène virtuelle 1280 × 720 de `TvViewport`, qui les fait remplir l'écran. */
  nativeTv?: boolean
}

export const CLIENT_GAME_REGISTRY: Record<string, ClientGameEntry> = {
  'who-is-most-likely': {
    Controller: view(() => import('./games/whoIsMostLikely/ControllerView'), 'WhoIsMostLikelyController'),
    Screen: view(() => import('./games/whoIsMostLikely/ScreenView'), 'WhoIsMostLikelyScreen'),
  },
  dilemmas: {
    Controller: view(() => import('./games/dilemmas/ControllerView'), 'DilemmasController'),
    Screen: view(() => import('./games/dilemmas/ScreenView'), 'DilemmasScreen'),
  },
  pyramid: {
    Controller: view(() => import('./games/pyramid/ControllerView'), 'PyramidController'),
    Screen: view(() => import('./games/pyramid/ScreenView'), 'PyramidScreen'),
  },
  'secret-profile': {
    Controller: view(() => import('./games/secretProfile/ControllerView'), 'SecretProfileController'),
    Screen: view(() => import('./games/secretProfile/ScreenView'), 'SecretProfileScreen'),
  },
  'party-cards': {
    Controller: view(() => import('./games/partyCards/ControllerView'), 'PartyCardsController'),
    Screen: view(() => import('./games/partyCards/ScreenView'), 'PartyCardsScreen'),
  },
  'who-wrote-it': {
    Controller: view(() => import('./games/whoWroteIt/ControllerView'), 'WhoWroteItController'),
    Screen: view(() => import('./games/whoWroteIt/ScreenView'), 'WhoWroteItScreen'),
  },
  'guess-my-answer': {
    Controller: view(() => import('./games/guessMyAnswer/ControllerView'), 'GuessMyAnswerController'),
    Screen: view(() => import('./games/guessMyAnswer/ScreenView'), 'GuessMyAnswerScreen'),
  },
  palmier: {
    Controller: view(() => import('./games/palmier/ControllerView'), 'PalmierController'),
    Screen: view(() => import('./games/palmier/ScreenView'), 'PalmierScreen'),
  },
  autoroute: {
    Controller: view(() => import('./games/autoroute/ControllerView'), 'AutorouteController'),
    Screen: view(() => import('./games/autoroute/ScreenView'), 'AutorouteScreen'),
  },
  pmu: {
    Controller: view(() => import('./games/pmu/ControllerView'), 'PmuController'),
    Screen: view(() => import('./games/pmu/ScreenView'), 'PmuScreen'),
  },
  wheel: {
    Controller: view(() => import('./games/wheel/ControllerView'), 'WheelController'),
    Screen: view(() => import('./games/wheel/ScreenView'), 'WheelScreen'),
  },
  'russian-roulette': {
    Controller: view(() => import('./games/russianRoulette/ControllerView'), 'RussianRouletteController'),
    Screen: view(() => import('./games/russianRoulette/ScreenView'), 'RussianRouletteScreen'),
  },
  blackjack: {
    Controller: view(() => import('./games/blackjack/ControllerView'), 'BlackjackController'),
    Screen: view(() => import('./games/blackjack/ScreenView'), 'BlackjackScreen'),
  },
  blanc: {
    Controller: view(() => import('./games/blanc/ControllerView'), 'BlancController'),
    Screen: view(() => import('./games/blanc/ScreenView'), 'BlancScreen'),
  },
  'petits-chevaux': {
    Controller: view(() => import('./games/petitsChevaux/ControllerView'), 'PetitsChevauxController'),
    Screen: view(() => import('./games/petitsChevaux/ScreenView'), 'PetitsChevauxScreen'),
  },
  'coup-de-crayon': {
    Controller: view(() => import('./games/coupDeCrayon/ControllerView'), 'CoupDeCrayonController'),
    Screen: view(() => import('./games/coupDeCrayon/ScreenView'), 'CoupDeCrayonScreen'),
  },
  intrus: {
    Controller: view(() => import('./games/intrus/ControllerView'), 'IntrusController'),
    Screen: view(() => import('./games/intrus/ScreenView'), 'IntrusScreen'),
    nativeTv: true,
  },
  'one-word-story': {
    Controller: view(() => import('./games/oneWordStory/ControllerView'), 'OneWordStoryController'),
    Screen: view(() => import('./games/oneWordStory/ScreenView'), 'OneWordStoryScreen'),
  },
  'truth-or-dare': {
    Controller: view(() => import('./games/truthOrDare/ControllerView'), 'TruthOrDareController'),
    Screen: view(() => import('./games/truthOrDare/ScreenView'), 'TruthOrDareScreen'),
  },
  'loup-garou': {
    Controller: view(() => import('./games/loupGarou/ControllerView'), 'LoupGarouController'),
    Screen: view(() => import('./games/loupGarou/ScreenView'), 'LoupGarouScreen'),
  },
  'times-up': {
    Controller: view(() => import('./games/timesUp/ControllerView'), 'TimesUpController'),
    Screen: view(() => import('./games/timesUp/ScreenView'), 'TimesUpScreen'),
  },
  quiproquo: {
    Controller: view(() => import('./games/quiproquo/ControllerView'), 'QuiproquoController'),
    Screen: view(() => import('./games/quiproquo/ScreenView'), 'QuiproquoScreen'),
  },
  uno: {
    Controller: view(() => import('./games/uno/ControllerView'), 'UnoController'),
    Screen: view(() => import('./games/uno/ScreenView'), 'UnoScreen'),
    nativeTv: true,
  },
  poker: {
    Controller: view(() => import('./games/poker/ControllerView'), 'PokerController'),
    Screen: view(() => import('./games/poker/ScreenView'), 'PokerScreen'),
  },
  monopoly: {
    Controller: view(() => import('./games/monopoly/ControllerView'), 'MonopolyController'),
    Screen: view(() => import('./games/monopoly/ScreenView'), 'MonopolyScreen'),
    nativeTv: true,
  },
  'lancer-de-des': {
    Controller: view(() => import('./games/dice/ControllerView'), 'DiceController'),
    Screen: view(() => import('./games/dice/ScreenView'), 'DiceScreen'),
    nativeTv: true,
  },
}
