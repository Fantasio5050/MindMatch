import type { Group, PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

/**
 * UNO — serveur autoritaire.
 *
 * ## L'annonce « UNO »
 * La version précédente rendait la partie IMPOSSIBLE À GAGNER : la pénalité tombait au moment où
 * l'on posait son avant-dernière carte sans avoir annoncé, mais l'annonce n'était acceptée qu'une
 * fois descendu à une carte. Personne ne pouvait donc jamais annoncer à temps, et chaque passage à
 * une carte renvoyait à trois.
 *
 * Règle retenue, celle des vraies tables :
 *  - on peut annoncer dès qu'il nous reste deux cartes (juste avant de poser) ou une ;
 *  - poser son avant-dernière carte sans avoir annoncé EXPOSE le joueur ;
 *  - tant qu'il est exposé, n'importe qui peut crier « Contre-UNO ! » : il pioche 2 cartes ;
 *  - la fenêtre se referme dès que le joueur suivant agit, ou si l'exposé annonce enfin.
 * Au téléphone, ça devient une course : c'est exactement le moment de tension du vrai jeu.
 *
 * ## Piocher
 * Règle officielle : après avoir pioché, on ne peut jouer QUE la carte piochée (si elle passe),
 * sinon on passe. Avant, piocher laissait rejouer n'importe quelle carte de sa main.
 *
 * ## Confidentialité
 * La pioche, la défausse et les mains ne partent jamais telles quelles : `viewFor` n'envoie à
 * chacun que sa main, le nombre de cartes des autres et la carte visible. La pioche partait en
 * clair — son ORDRE permettait de savoir ce que chacun allait piocher.
 */

type PlayColor = 'red' | 'yellow' | 'green' | 'blue'
type UnoColor = PlayColor | 'wild'
type UnoValue = number | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

interface UnoCard {
  id: string
  color: UnoColor
  value: UnoValue
}

type UnoEvent =
  | { seq: number; type: 'play'; memberId: string; cardId: string }
  | { seq: number; type: 'draw'; memberId: string; count: number }
  | { seq: number; type: 'uno'; memberId: string }
  | { seq: number; type: 'penalty'; memberId: string; byId: string }
  | { seq: number; type: 'skip'; memberId: string }
  | { seq: number; type: 'win'; memberId: string }

/** `Omit` ne se distribue pas sur une union : sans ça, TypeScript refuse les champs propres à
 * chaque type d'événement. */
type UnoEventInput = UnoEvent extends unknown ? (UnoEvent extends infer E ? (E extends UnoEvent ? Omit<E, 'seq'> : never) : never) : never

interface UnoState {
  phase: 'intro' | 'playing' | 'ended'
  deck: UnoCard[]
  discardPile: UnoCard[]
  hands: Record<string, UnoCard[]>
  order: string[]
  currentIndex: number
  direction: 1 | -1
  currentColor: PlayColor
  winner: string | null
  /** A annoncé UNO pour sa main actuelle (remis à zéro dès qu'il repasse à 3 cartes ou plus). */
  unoSafe: Record<string, boolean>
  /** Joueur descendu à une carte sans avoir annoncé : attrapable par les autres. */
  exposed: string | null
  /** Carte piochée ce tour : après une pioche, c'est la SEULE jouable. */
  drawnCardId: string | null
  hasDrawn: boolean
  lastEvent: UnoEvent | null
  eventSeq: number
  cardIdCounter: number
}

const HAND_SIZE = 7
const PLAY_XP = 1
const WIN_XP = 10
const UNO_XP = 3
const CATCH_XP = 2
const COLORS: PlayColor[] = ['red', 'yellow', 'green', 'blue']

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

/** Copie de travail profonde : chaque action part de là et ne touche jamais l'état reçu. */
function clone(state: UnoState): UnoState {
  return {
    ...state,
    deck: [...state.deck],
    discardPile: [...state.discardPile],
    hands: Object.fromEntries(Object.entries(state.hands).map(([id, h]) => [id, [...h]])),
    unoSafe: { ...state.unoSafe },
  }
}

function buildDeck(): UnoCard[] {
  let n = 0
  const id = () => `c${n++}`
  const cards: UnoCard[] = []
  for (const color of COLORS) {
    cards.push({ id: id(), color, value: 0 })
    for (let v = 1; v <= 9; v++) {
      cards.push({ id: id(), color, value: v }, { id: id(), color, value: v })
    }
    for (const action of ['skip', 'reverse', 'draw2'] as const) {
      cards.push({ id: id(), color, value: action }, { id: id(), color, value: action })
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: id(), color: 'wild', value: 'wild' })
  for (let i = 0; i < 4; i++) cards.push({ id: id(), color: 'wild', value: 'wild4' })
  return cards
}

/**
 * Pioche une carte (mutation de la copie de travail). Pioche vide : on remélange la défausse sous
 * la carte visible. L'ancienne version remélangeait dans une copie puis réécrivait l'ancienne
 * défausse par-dessus — les cartes remélangées existaient alors EN DOUBLE.
 */
function drawOne(s: UnoState): UnoCard | null {
  if (s.deck.length === 0) {
    if (s.discardPile.length <= 1) return null
    const top = s.discardPile[s.discardPile.length - 1]
    s.deck = shuffle(s.discardPile.slice(0, -1))
    s.discardPile = [top]
  }
  return s.deck.pop() ?? null
}

function giveCards(s: UnoState, memberId: string, count: number): number {
  let given = 0
  for (let i = 0; i < count; i++) {
    const c = drawOne(s)
    if (!c) break
    s.hands[memberId].push(c)
    given++
  }
  // Repasser à 3 cartes ou plus annule l'annonce : il faudra ré-annoncer la prochaine fois.
  if (s.hands[memberId].length > 2) s.unoSafe[memberId] = false
  if (s.exposed === memberId && s.hands[memberId].length !== 1) s.exposed = null
  return given
}

function topCard(s: UnoState): UnoCard | null {
  return s.discardPile[s.discardPile.length - 1] ?? null
}

function canPlay(card: UnoCard, top: UnoCard | null, color: PlayColor): boolean {
  if (!top) return false
  if (card.color === 'wild') return true
  if (card.color === color) return true
  // Une carte de couleur ne suit jamais un joker sur sa valeur : seule la couleur annoncée compte.
  return top.color !== 'wild' && card.value === top.value
}

function stepIndex(s: UnoState, steps: number): number {
  const len = s.order.length
  return (((s.currentIndex + s.direction * steps) % len) + len) % len
}

function currentId(s: UnoState): string {
  return s.order[s.currentIndex]
}

function emit(s: UnoState, event: UnoEventInput): void {
  s.eventSeq += 1
  s.lastEvent = { ...event, seq: s.eventSeq } as UnoEvent
}

/** Passe la main au joueur suivant (`skip` = saute un joueur) et remet le tour à zéro. */
function passTurn(s: UnoState, skip = false): void {
  s.currentIndex = stepIndex(s, skip ? 2 : 1)
  s.hasDrawn = false
  s.drawnCardId = null
}

/** Toute action du joueur dont c'est le tour referme la fenêtre de « Contre-UNO » ouverte avant. */
function closeCatchWindow(s: UnoState, actorId: string): void {
  if (s.exposed && s.exposed !== actorId) s.exposed = null
}

function withState(session: PartySession, s: UnoState, extra: Partial<PartySession> = {}): PartySession {
  return { ...session, ...extra, roundData: s }
}

function deal(participantIds: string[]): UnoState {
  const s: UnoState = {
    phase: 'intro',
    deck: shuffle(buildDeck()),
    discardPile: [],
    hands: {},
    order: shuffle(participantIds),
    currentIndex: 0,
    direction: 1,
    currentColor: 'red',
    winner: null,
    unoSafe: {},
    exposed: null,
    drawnCardId: null,
    hasDrawn: false,
    lastEvent: null,
    eventSeq: 0,
    cardIdCounter: 0,
  }
  for (const id of s.order) {
    s.hands[id] = []
    s.unoSafe[id] = false
    giveCards(s, id, HAND_SIZE)
  }

  // Carte de départ : jamais un +4 (règle officielle, on le remet dans la pioche).
  let first = drawOne(s)
  while (first && first.value === 'wild4') {
    s.deck.unshift(first)
    first = drawOne(s)
  }
  if (!first) return s
  s.discardPile = [first]
  s.currentColor = first.color === 'wild' ? COLORS[Math.floor(Math.random() * 4)] : first.color

  // Effet de la carte de départ sur le premier joueur.
  if (first.value === 'skip') {
    s.currentIndex = stepIndex(s, 1)
  } else if (first.value === 'reverse') {
    s.direction = -1
    if (s.order.length === 2) s.currentIndex = stepIndex(s, 1)
  } else if (first.value === 'draw2') {
    giveCards(s, currentId(s), 2)
    s.currentIndex = stepIndex(s, 1)
  }
  return s
}

function finalRanking(s: UnoState): { memberId: string; cardsLeft: number }[] {
  return s.order
    .map((id) => ({ memberId: id, cardsLeft: s.hands[id]?.length ?? 0 }))
    .sort((a, b) => a.cardsLeft - b.cardsLeft)
}

export const uno: GameModule = {
  id: 'uno',
  name: 'UNO',
  icon: '🃏',
  minPlayers: 2,

  initRound(_group: Group, session: PartySession) {
    const state = getState(session)
    // Premier appel : on distribue, mais on reste sur l'écran des règles le temps que tout le
    // monde les lise. L'hôte lance ensuite (appel suivant).
    if (session.round === 0 || !state) {
      return { session: { ...session, status: 'playing', phase: 'intro', round: 1, roundData: deal(session.participantIds) } }
    }
    if (state.phase === 'intro') {
      const s = clone(state)
      s.phase = 'playing'
      return { session: withState(session, s, { phase: 'playing' }) }
    }
    if (state.phase === 'ended') {
      return { session: { ...session, status: 'ended', phase: 'ended' } }
    }
    return { session }
  },

  handleAction(_group: Group, session: PartySession, memberId: string, action: GameAction) {
    const state = getState(session)
    if (!state || state.phase !== 'playing') return { session }
    if (!state.order.includes(memberId)) return { session }

    // ─── Annonce « UNO ! » : à deux cartes (juste avant de poser) ou à une. ─────
    if (action.type === 'call-uno') {
      const hand = state.hands[memberId]
      if (hand.length > 2 || state.unoSafe[memberId]) return { session }
      const s = clone(state)
      s.unoSafe[memberId] = true
      if (s.exposed === memberId) s.exposed = null
      emit(s, { type: 'uno', memberId })
      return {
        session: withState(session, s),
        xpAwards: [{ memberId, amount: UNO_XP, statIncrements: { 'uno.unoCalled': 1 }, reason: 'A annoncé UNO' }],
      }
    }

    // ─── « Contre-UNO ! » : attraper un joueur exposé. ─────────────────────────
    if (action.type === 'catch-uno') {
      const targetId = (action.payload as { targetId?: string } | null)?.targetId
      if (!targetId || targetId === memberId || state.exposed !== targetId) return { session }
      const s = clone(state)
      s.exposed = null
      giveCards(s, targetId, 2)
      emit(s, { type: 'penalty', memberId: targetId, byId: memberId })
      return {
        session: withState(session, s),
        xpAwards: [{ memberId, amount: CATCH_XP, statIncrements: { 'uno.catches': 1 }, reason: 'A pris quelqu’un sans UNO' }],
      }
    }

    // Tout le reste n'appartient qu'au joueur dont c'est le tour.
    if (memberId !== currentId(state)) return { session }

    // ─── Poser une carte ────────────────────────────────────────────────────
    if (action.type === 'play-card') {
      const payload = action.payload as { cardId?: string; chosenColor?: string } | null
      const hand = state.hands[memberId]
      const card = hand.find((c) => c.id === payload?.cardId)
      if (!card) return { session }
      if (state.hasDrawn && card.id !== state.drawnCardId) return { session }
      if (!canPlay(card, topCard(state), state.currentColor)) return { session }
      const chosen = COLORS.includes(payload?.chosenColor as PlayColor) ? (payload!.chosenColor as PlayColor) : null
      // Un joker sans couleur choisie est refusé plutôt que de retomber sur « rouge » en silence.
      if (card.color === 'wild' && !chosen) return { session }

      const s = clone(state)
      closeCatchWindow(s, memberId)
      s.hands[memberId] = s.hands[memberId].filter((c) => c.id !== card.id)
      s.discardPile.push(card)
      s.currentColor = card.color === 'wild' ? chosen! : card.color
      emit(s, { type: 'play', memberId, cardId: card.id })
      const xpAwards: XpAward[] = [{ memberId, amount: PLAY_XP, statIncrements: { 'uno.cardsPlayed': 1 }, reason: 'A posé une carte' }]

      const left = s.hands[memberId].length
      if (left === 0) {
        s.phase = 'ended'
        s.winner = memberId
        s.exposed = null
        emit(s, { type: 'win', memberId })
        xpAwards.push({ memberId, amount: WIN_XP, statIncrements: { 'uno.wins': 1 }, reason: 'A gagné la partie d’UNO' })
        return { session: withState(session, s, { status: 'ended', phase: 'ended' }), xpAwards }
      }
      if (left === 1 && !s.unoSafe[memberId]) s.exposed = memberId

      // Effets de la carte posée.
      if (card.value === 'reverse') {
        s.direction = s.direction === 1 ? -1 : 1
        // À deux, l'inversion revient à sauter l'adversaire : on rejoue.
        passTurn(s, s.order.length === 2)
      } else if (card.value === 'skip') {
        passTurn(s, true)
      } else if (card.value === 'draw2' || card.value === 'wild4') {
        const victim = s.order[stepIndex(s, 1)]
        giveCards(s, victim, card.value === 'draw2' ? 2 : 4)
        passTurn(s, true)
      } else {
        passTurn(s)
      }
      return { session: withState(session, s), xpAwards }
    }

    // ─── Piocher, puis éventuellement passer ────────────────────────────────
    if (action.type === 'draw-card') {
      const s = clone(state)
      closeCatchWindow(s, memberId)
      if (s.hasDrawn) {
        // Deuxième appui = « je garde la carte piochée et je passe ».
        passTurn(s)
        return { session: withState(session, s) }
      }
      const before = s.hands[memberId].length
      giveCards(s, memberId, 1)
      const drawn = s.hands[memberId].length > before ? s.hands[memberId][s.hands[memberId].length - 1] : null
      emit(s, { type: 'draw', memberId, count: drawn ? 1 : 0 })
      if (drawn && canPlay(drawn, topCard(s), s.currentColor)) {
        s.hasDrawn = true
        s.drawnCardId = drawn.id
      } else {
        passTurn(s)
      }
      return { session: withState(session, s) }
    }

    if (action.type === 'pass') {
      if (!state.hasDrawn) return { session }
      const s = clone(state)
      passTurn(s)
      return { session: withState(session, s) }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    return getState(session)?.phase === 'ended'
  },

  isAwaitingInput(_group, session) {
    return getState(session)?.phase === 'playing'
  },

  /**
   * Appelé par l'hôte pendant la partie : « passer » un joueur absent ou bloqué. Il pioche une
   * carte (s'il ne l'a pas déjà fait) et la main passe. Sans ça, un seul téléphone en veille
   * figeait la table entière — l'hôte n'avait aucun recours.
   */
  resolveRound(_group, session) {
    const state = getState(session)
    if (!state || state.phase !== 'playing') return { session }
    const s = clone(state)
    const skipped = currentId(s)
    closeCatchWindow(s, skipped)
    if (!s.hasDrawn) giveCards(s, skipped, 1)
    emit(s, { type: 'skip', memberId: skipped })
    passTurn(s)
    return { session: withState(session, s) }
  },

  viewFor(group, session, memberId) {
    const s = getState(session)
    if (!s) return null
    const me = memberId && s.order.includes(memberId) ? memberId : null
    const hand = me ? s.hands[me] : []
    const cur = currentId(s)
    const curMember = group.members.find((m) => m.id === cur)
    const myTurn = s.phase === 'playing' && me === cur
    const top = topCard(s)
    const playableIds = myTurn
      ? hand
          .filter((c) => (s.hasDrawn ? c.id === s.drawnCardId : true))
          .filter((c) => canPlay(c, top, s.currentColor))
          .map((c) => c.id)
      : []

    return {
      phase: s.phase,
      hand,
      topCard: top,
      currentColor: s.currentColor,
      currentPlayer: curMember ? { memberId: cur, pseudo: curMember.pseudo, color: curMember.color } : null,
      direction: s.direction,
      order: s.order,
      handCounts: Object.fromEntries(s.order.map((id) => [id, s.hands[id]?.length ?? 0])),
      unoSafeIds: s.order.filter((id) => s.unoSafe[id]),
      exposed: s.exposed,
      winner: s.winner,
      myTurn,
      playableIds,
      canPlay: playableIds.length > 0,
      hasDrawn: myTurn && s.hasDrawn,
      unoCalled: me ? !!s.unoSafe[me] : false,
      // Le bouton d'annonce s'affiche quand il sert : à une carte non annoncée, ou à deux cartes
      // quand c'est notre tour (annonce anticipée, avant de poser l'avant-dernière).
      mustCallUno: !!me && s.phase === 'playing' && !s.unoSafe[me] && (hand.length === 1 || (hand.length === 2 && myTurn)),
      canCatch: !!me && !!s.exposed && s.exposed !== me,
      deckCount: s.deck.length,
      lastEvent: s.lastEvent,
      ranking: s.phase === 'ended' ? finalRanking(s) : null,
    }
  },
}
