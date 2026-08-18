import type { Group, PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

// ─── Types ───────────────────────────────────────────────

type UnoColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
type UnoValue = number | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

interface UnoCard {
  id: string
  color: UnoColor
  value: UnoValue
}

interface UnoState {
  /** Pioche (mélangée) */
  deck: UnoCard[]
  /** Défausse */
  discardPile: UnoCard[]
  /** Mains des joueurs */
  hands: Record<string, UnoCard[]>
  /** ID du joueur dont c'est le tour */
  currentPlayer: string
  /** Ordre des joueurs */
  order: string[]
  /** Index dans l'ordre */
  currentIndex: number
  /** Sens du jeu */
  direction: 1 | -1
  /** Couleur active (importante pour les jokers) */
  currentColor: 'red' | 'yellow' | 'green' | 'blue'
  /** ID du gagnant */
  winner: string | null
  /** Qui a dit UNO */
  unoCalled: Record<string, boolean>
  /** Joueurs qui n'ont pas dit UNO ( susceptibles d'être pénalisés ) */
  penalties: string[]
  /** Dernier événement pour animations */
  lastEvent: { type: 'play' | 'draw' | 'uno' | 'penalty' | 'win'; memberId: string; cardId?: string } | null
  /** Carte piochée ce tour (null si pas pioché ou déjà jouée) */
  drawnThisTurn: UnoCard | null
  /** Si le joueur a déjà pioché ce tour */
  hasDrawnThisTurn: boolean
  /** Phase du jeu */
  phase: 'playing' | 'ended'
  /** Compteur d'IDs pour les cartes */
  cardIdCounter: number
  /** Si une pénalité de +2 ou +4 est en attente */
  pendingDraw: number
}

// ─── Constants ───────────────────────────────────────────

const HAND_SIZE = 7
const PLAY_XP = 1
const WIN_XP = 10
const UNO_XP = 3

// ─── Helpers ─────────────────────────────────────────────

function getState(session: PartySession): UnoState | null {
  return session.roundData as UnoState | null
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function makeCardId(state: UnoState): string {
  return `card-${state.cardIdCounter++}`
}

/** Construit un deck UNO complet (108 cartes) */
function buildDeck(state: UnoState): UnoCard[] {
  const colors: Array<'red' | 'yellow' | 'green' | 'blue'> = ['red', 'yellow', 'green', 'blue']
  const cards: UnoCard[] = []

  for (const color of colors) {
    // Une seule carte "0" par couleur
    cards.push({ id: makeCardId(state), color, value: 0 })
    // Deux cartes 1-9 par couleur
    for (let n = 1; n <= 9; n++) {
      cards.push({ id: makeCardId(state), color, value: n })
      cards.push({ id: makeCardId(state), color, value: n })
    }
    // Deux Skip, Reverse, +2 par couleur
    for (const action of ['skip', 'reverse', 'draw2'] as const) {
      cards.push({ id: makeCardId(state), color, value: action })
      cards.push({ id: makeCardId(state), color, value: action })
    }
  }

  // 4 Jokers
  for (let i = 0; i < 4; i++) {
    cards.push({ id: makeCardId(state), color: 'wild', value: 'wild' })
  }
  // 4 +4 Jokers
  for (let i = 0; i < 4; i++) {
    cards.push({ id: makeCardId(state), color: 'wild', value: 'wild4' })
  }

  return cards
}

/** Pioche une carte du deck ; remélange la défause si vide */
function drawCard(state: UnoState): UnoCard | null {
  if (state.deck.length === 0) {
    // Remélanger la défausse (sauf la carte du dessus)
    if (state.discardPile.length <= 1) return null
    const top = state.discardPile[state.discardPile.length - 1]
    const rest = state.discardPile.slice(0, -1)
    state.deck = shuffle(rest)
    state.discardPile = [top]
  }
  return state.deck.pop() ?? null
}

/** Vérifie si une carte peut être jouée sur la défausse actuelle */
function canPlayCard(card: UnoCard, topCard: UnoCard, currentColor: 'red' | 'yellow' | 'green' | 'blue'): boolean {
  if (card.color === 'wild') return true
  if (card.color === currentColor) return true
  if (topCard.color === 'wild') {
    // La couleur a été choisie — match par couleur
    return card.color === currentColor
  }
  if (card.value === topCard.value) return true
  return false
}

/** Calcule l'index du joueur suivant selon la direction */
function nextIndex(state: UnoState, skip: boolean = false): number {
  const steps = skip ? 2 : 1
  const len = state.order.length
  const next = (state.currentIndex + state.direction * steps + len * 100) % len
  return next
}

/** Vérifie si un joueur a au moins une carte jouable */




// ─── Game Module ─────────────────────────────────────────

export const uno: GameModule = {
  id: 'uno',
  name: 'UNO',
  icon: '🃏',
  minPlayers: 2,

  canStart(group: Group): string | null {
    if (group.members.length < 2) {
      return 'Il faut au moins 2 joueurs pour jouer à UNO.'
    }
    return null
  },

  initRound(_group: Group, session: PartySession, _config?: unknown): { session: PartySession; xpAwards?: XpAward[] } {
    const isFirstRound = session.round === 0

    if (isFirstRound) {
      // Construire l'état initial
      const tempState: UnoState = {
        deck: [],
        discardPile: [],
        hands: {},
        currentPlayer: '',
        order: [],
        currentIndex: 0,
        direction: 1,
        currentColor: 'red',
        winner: null,
        unoCalled: {},
        penalties: [],
        lastEvent: null,
        drawnThisTurn: null,
        hasDrawnThisTurn: false,
        phase: 'playing',
        cardIdCounter: 0,
        pendingDraw: 0,
      }

      // Ordre des joueurs mélangé
      const order = shuffle(session.participantIds)
      tempState.order = order

      // Construire et mélanger le deck
      const deck = shuffle(buildDeck(tempState))
      tempState.deck = deck

      // Distribuer 7 cartes par joueur
      for (const playerId of order) {
        const hand: UnoCard[] = []
        for (let i = 0; i < HAND_SIZE; i++) {
          const card = drawCard(tempState)
          if (card) hand.push(card)
        }
        tempState.hands[playerId] = hand
      }

      // Retourner la première carte (pas un +4 ou joker au départ)
      let firstCard: UnoCard | null = null
      while (firstCard === null || firstCard.value === 'wild4') {
        firstCard = drawCard(tempState)
        if (firstCard === null) break
        if (firstCard.value === 'wild4') {
          // Remettre dans le deck et continuer
          tempState.deck.unshift(firstCard)
          firstCard = null
        }
      }
      if (firstCard) {
        tempState.discardPile = [firstCard]
        // Si c'est un joker, choisir une couleur aléatoire
        if (firstCard.color === 'wild') {
          const colors: Array<'red' | 'yellow' | 'green' | 'blue'> = ['red', 'yellow', 'green', 'blue']
          tempState.currentColor = colors[Math.floor(Math.random() * 4)]
        } else {
          tempState.currentColor = firstCard.color as 'red' | 'yellow' | 'green' | 'blue'
        }
      }

      // Premier joueur
      tempState.currentIndex = 0
      tempState.currentPlayer = order[0]

      // Gérer la première carte spéciale
      if (firstCard) {
        if (firstCard.value === 'skip') {
          tempState.currentIndex = nextIndex(tempState, true)
          tempState.currentPlayer = tempState.order[tempState.currentIndex]
        } else if (firstCard.value === 'reverse') {
          tempState.direction = -1
          // Dans une partie à 2, reverse = skip
          if (order.length === 2) {
            tempState.currentIndex = nextIndex(tempState, true)
            tempState.currentPlayer = tempState.order[tempState.currentIndex]
          }
        } else if (firstCard.value === 'draw2') {
          // Le premier joueur pioche 2 et passe son tour
          for (let i = 0; i < 2; i++) {
            const c = drawCard(tempState)
            if (c) tempState.hands[tempState.currentPlayer].push(c)
          }
          tempState.currentIndex = nextIndex(tempState)
          tempState.currentPlayer = tempState.order[tempState.currentIndex]
        }
      }

      return {
        session: {
          ...session,
          status: 'playing',
          phase: 'playing',
          round: 1,
          roundData: tempState,
        },
      }
    }

    // Rounds suivants — la partie continue
    const state = getState(session)
    if (!state) return { session }
    if (state.winner) {
      return {
        session: { ...session, status: 'ended', phase: 'ended', roundData: state },
      }
    }
    return { session }
  },

  handleAction(_group: Group, session: PartySession, memberId: string, action: GameAction): { session: PartySession; xpAwards?: XpAward[] } {
    const state = getState(session)
    if (!state) return { session }
    if (state.phase === 'ended') return { session }

    const act = action as { type: string; payload: unknown }

    // ─── Action: start (host starts the game) ──────────
    if (act.type === 'start') {
      return { session }
    }

    // ─── Action: call-uno ──────────────────────────────
    if (act.type === 'call-uno') {
      // N'importe qui peut appeler UNO (pour soi-même)
      // On marque que ce joueur a dit UNO
      const hand = state.hands[memberId] ?? []
      if (hand.length === 1) {
        const nextState: UnoState = {
          ...state,
          unoCalled: { ...state.unoCalled, [memberId]: true },
          lastEvent: { type: 'uno', memberId },
        }
        return {
          session: { ...session, roundData: nextState },
          xpAwards: [
            {
              memberId,
              amount: UNO_XP,
              statIncrements: { 'uno.unoCalled': 1 },
              reason: 'A appelé UNO !',
            },
          ],
        }
      }
      return { session }
    }

    // ─── Vérification: c'est le tour du joueur ? ──────
    if (memberId !== state.currentPlayer) return { session }

    // ─── Action: play-card ─────────────────────────────
    if (act.type === 'play-card') {
      const payload = act.payload as { cardId?: string; chosenColor?: string } | null
      const cardId = payload?.cardId
      if (!cardId) return { session }

      const hand = state.hands[memberId] ?? []
      const cardIndex = hand.findIndex((c) => c.id === cardId)
      if (cardIndex < 0) return { session }

      const card = hand[cardIndex]
      const topCard = state.discardPile[state.discardPile.length - 1]
      if (!topCard) return { session }

      // Vérifier que la carte est jouable
      if (!canPlayCard(card, topCard, state.currentColor)) return { session }

      // Vérifier le UNO: si le joueur a 2 cartes, en pose une → il lui en reste 1
      // Il doit avoir appelé UNO (ou le faire dans la foulée)
      const willHaveUno = hand.length === 2

      // Retirer la carte de la main
      const newHand = [...hand]
      newHand.splice(cardIndex, 1)
      const newHands = { ...state.hands, [memberId]: newHand }

      // Ajouter à la défausse
      const newDiscard = [...state.discardPile, card]

      // Déterminer la nouvelle couleur
      let newColor = state.currentColor
      if (card.color === 'wild') {
        const chosen = payload?.chosenColor as 'red' | 'yellow' | 'green' | 'blue' | undefined
        if (chosen && ['red', 'yellow', 'green', 'blue'].includes(chosen)) {
          newColor = chosen
        } else {
          // Si pas de couleur choisie, on garde rouge par défaut
          newColor = 'red'
        }
      } else {
        newColor = card.color as 'red' | 'yellow' | 'green' | 'blue'
      }

      // Vérifier la pénalité UNO: si le joueur n'a pas appelé UNO avant de poser sa carte
      // et qu'il lui reste 1 carte, il est pénalisé (+2 cartes)
      const unoCalled = { ...state.unoCalled }
      const penalties = [...state.penalties]
      const xpAwards: XpAward[] = []

      if (willHaveUno && !unoCalled[memberId]) {
        // Pénalité: +2 cartes
        const drawState: UnoState = {
          ...state,
          hands: newHands,
          discardPile: newDiscard,
        }
        const finalHand = [...newHand]
        for (let i = 0; i < 2; i++) {
          const c = drawCard(drawState)
          if (c) finalHand.push(c)
        }
        newHands[memberId] = finalHand
        state.deck = drawState.deck
        state.discardPile = drawState.discardPile
        penalties.push(memberId)
      }

      // Si le joueur n'a plus de cartes → gagnant !
      if (newHands[memberId].length === 0) {
        const nextState: UnoState = {
          ...state,
          hands: newHands,
          discardPile: newDiscard,
          currentColor: newColor,
          winner: memberId,
          phase: 'ended',
          unoCalled,
          penalties,
          lastEvent: { type: 'win', memberId },
          drawnThisTurn: null,
          hasDrawnThisTurn: false,
        }
        return {
          session: {
            ...session,
            status: 'ended',
            phase: 'ended',
            roundData: nextState,
          },
          xpAwards: [
            {
              memberId,
              amount: WIN_XP,
              statIncrements: { 'uno.wins': 1 },
              reason: 'A gagné la partie d\'UNO !',
            },
          ],
        }
      }

      // Déterminer le joueur suivant selon l'effet de la carte
      let nextIdx = nextIndex({ ...state, currentIndex: state.currentIndex }, false)
      let pendingDraw = 0

      if (card.value === 'skip') {
        nextIdx = nextIndex({ ...state, currentIndex: state.currentIndex }, true)
      } else if (card.value === 'reverse') {
        const newDirection: 1 | -1 = state.direction === 1 ? -1 : 1
        // Partie à 2 joueurs: reverse = skip
        if (state.order.length === 2) {
          nextIdx = nextIndex({ ...state, currentIndex: state.currentIndex, direction: newDirection }, true)
        } else {
          nextIdx = nextIndex({ ...state, currentIndex: state.currentIndex, direction: newDirection }, false)
        }
        state.direction = newDirection
      } else if (card.value === 'draw2') {
        // Le joueur suivant pioche 2 cartes et passe son tour
        const targetId = state.order[nextIdx]
        const targetHand = [...(state.hands[targetId] ?? [])]
        const drawState: UnoState = {
          ...state,
          hands: newHands,
          discardPile: newDiscard,
        }
        for (let i = 0; i < 2; i++) {
          const c = drawCard(drawState)
          if (c) targetHand.push(c)
        }
        state.deck = drawState.deck
        state.discardPile = drawState.discardPile
        newHands[targetId] = targetHand
        // Passer le tour du joueur qui pioche
        nextIdx = nextIndex({ ...state, currentIndex: state.currentIndex }, true)
      } else if (card.value === 'wild4') {
        // Le joueur suivant pioche 4 cartes et passe son tour
        const targetId = state.order[nextIdx]
        const targetHand = [...(state.hands[targetId] ?? [])]
        const drawState: UnoState = {
          ...state,
          hands: newHands,
          discardPile: newDiscard,
        }
        for (let i = 0; i < 4; i++) {
          const c = drawCard(drawState)
          if (c) targetHand.push(c)
        }
        state.deck = drawState.deck
        state.discardPile = drawState.discardPile
        newHands[targetId] = targetHand
        // Passer le tour du joueur qui pioche
        nextIdx = nextIndex({ ...state, currentIndex: state.currentIndex }, true)
      }

      // XP pour avoir joué une carte
      xpAwards.push({
        memberId,
        amount: PLAY_XP,
        statIncrements: { 'uno.cardsPlayed': 1 },
        reason: 'A joué une carte',
      })

      const nextState: UnoState = {
        ...state,
        hands: newHands,
        discardPile: newDiscard,
        currentColor: newColor,
        currentIndex: nextIdx,
        currentPlayer: state.order[nextIdx],
        unoCalled,
        penalties,
        lastEvent: { type: 'play', memberId, cardId: card.id },
        drawnThisTurn: null,
        hasDrawnThisTurn: false,
        pendingDraw,
      }

      return {
        session: { ...session, roundData: nextState },
        xpAwards,
      }
    }

    // ─── Action: draw-card ─────────────────────────────
    if (act.type === 'draw-card') {
      // Si déjà pioché ce tour, on ne peut pas re-piocher — on passe
      if (state.hasDrawnThisTurn) {
        // Passer au joueur suivant
        const nextIdx = nextIndex(state, false)
        const nextState: UnoState = {
          ...state,
          currentIndex: nextIdx,
          currentPlayer: state.order[nextIdx],
          hasDrawnThisTurn: false,
          drawnThisTurn: null,
          lastEvent: null,
        }
        return { session: { ...session, roundData: nextState } }
      }

      const hand = state.hands[memberId] ?? []
      const drawState: UnoState = { ...state }
      const card = drawCard(drawState)
      if (!card) return { session }

      const newHand = [...hand, card]
      const newHands = { ...state.hands, [memberId]: newHand }
      const topCard = state.discardPile[state.discardPile.length - 1]

      // Vérifier si la carte piochée peut être jouée immédiatement
      const canPlayDrawn = canPlayCard(card, topCard, state.currentColor)

      // Si la carte peut être jouée, on laisse le joueur décider (il peut la jouer ou passer)
      // On marque qu'il a pioché et on garde la carte en mémoire
      const nextState: UnoState = {
        ...drawState,
        hands: newHands,
        deck: drawState.deck,
        hasDrawnThisTurn: true,
        drawnThisTurn: canPlayDrawn ? card : null,
        lastEvent: { type: 'draw', memberId },
      }

      // Si la carte piochée ne peut pas être jouée, on passe automatiquement au suivant
      if (!canPlayDrawn) {
        const nextIdx = nextIndex(nextState, false)
        nextState.currentIndex = nextIdx
        nextState.currentPlayer = nextState.order[nextIdx]
        nextState.hasDrawnThisTurn = false
        nextState.drawnThisTurn = null
      }

      return { session: { ...session, roundData: nextState } }
    }

    return { session }
  },

  isRoundComplete(_group: Group, session: PartySession): boolean {
    const state = getState(session)
    if (!state) return false
    return state.phase === 'ended'
  },

  isAwaitingInput(_group: Group, session: PartySession): boolean {
    const state = getState(session)
    if (!state) return false
    return state.phase === 'playing' && !state.winner
  },

  resolveRound(_group: Group, session: PartySession): { session: PartySession; xpAwards?: XpAward[] } {
    const state = getState(session)
    if (!state) return { session }
    // UNO est un jeu en temps réel — pas de résolution de round par tour
    // La partie se termine quand quelqu'un vide sa main (géré dans handleAction)
    return { session }
  },
}