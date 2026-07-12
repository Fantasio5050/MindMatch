import type { Group, PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

const CULSEC_WEIGHT = 10
const SURVIVOR_XP = 15

type EffectType =
  | 'drink-self'
  | 'give-sips'
  | 'center-self'
  | 'center-give'
  | 'race'
  | 'left-drinks'
  | 'right-drinks'
  | 'buddy'
  | 'challenge'
  | 'rule'
  | 'king'

interface Card {
  id: string
  rank: number
  suit: number
}

interface CardEffect {
  type: EffectType
  amount: number
  label: string
}

interface PalmierLogEntry {
  card: Card
  drawerMemberId: string
  effect: EffectType
  text: string
}

interface PalmierState {
  // The full shuffled draw order is only known server-side (nested under `secrets` so the generic
  // sanitizer strips it for every client) — otherwise players could see every future card, including
  // upcoming Kings, and spoil the whole game.
  secrets: { drawOrder: Card[] }
  currentCard: Card | null
  currentIndex: number
  totalCards: number
  drawerMemberId: string | null
  effect: EffectType | null
  amount: number
  label: string
  resolved: boolean
  targetMemberId: string | null
  ruleText: string | null
  kingsDrawn: number
  totalSipsReceived: Record<string, number>
  log: PalmierLogEntry[]
}

const RED_SUITS = [1, 2] // hearts, diamonds (matches client SUITS order: spades, hearts, diamonds, clubs)

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildDeck(): Card[] {
  const deck: Card[] = []
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ id: `p-${rank}-${suit}`, rank, suit })
  }
  return shuffle(deck)
}

function classify(card: Card): CardEffect {
  const isRed = RED_SUITS.includes(card.suit)
  switch (card.rank) {
    case 1:
      return isRed
        ? { type: 'center-self', amount: CULSEC_WEIGHT, label: 'As rouge — tu bois le verre central cul sec' }
        : { type: 'center-give', amount: CULSEC_WEIGHT, label: 'As noir — choisis qui boit le verre central cul sec' }
    case 2:
      return isRed
        ? { type: 'drink-self', amount: 2, label: '2 rouge — tu bois 2 gorgées' }
        : { type: 'give-sips', amount: 2, label: '2 noir — distribue 2 gorgées' }
    case 3:
      return isRed
        ? { type: 'drink-self', amount: 3, label: '3 rouge — tu bois 3 gorgées' }
        : { type: 'give-sips', amount: 3, label: '3 noir — distribue 3 gorgées' }
    case 4:
      return { type: 'race', amount: 1, label: 'Four to the floor — tout le monde touche le sol, le/la dernier·ère boit' }
    case 5:
      return { type: 'race', amount: 1, label: 'Five to the fly — tout le monde lève la main, le/la dernier·ère boit' }
    case 6:
      return { type: 'left-drinks', amount: 1, label: 'Ton/ta voisin·e de gauche boit' }
    case 7:
      return { type: 'right-drinks', amount: 1, label: 'Ton/ta voisin·e de droite boit' }
    case 8:
      return { type: 'buddy', amount: 1, label: 'Choisis ton/ta complice — vous trinquez et buvez chacun·e une gorgée' }
    case 9:
      return { type: 'challenge', amount: 1, label: 'Rime — chacun·e trouve un mot qui rime, le/la premier·ère qui sèche boit' }
    case 10:
      return { type: 'challenge', amount: 1, label: 'Catégorie — annonce une catégorie, le/la premier·ère qui sèche boit' }
    case 11:
      return { type: 'rule', amount: 0, label: 'Valet — invente une nouvelle règle pour le reste de la partie' }
    case 12:
      return { type: 'challenge', amount: 1, label: 'Dame — pose une question, le/la premier·ère qui répond sans en poser une boit' }
    default:
      return { type: 'king', amount: CULSEC_WEIGHT, label: 'Roi — verse une gorgée dans le verre central' }
  }
}

function getState(session: PartySession): PalmierState {
  return (
    (session.roundData as PalmierState | null) ?? {
      secrets: { drawOrder: [] },
      currentCard: null,
      currentIndex: -1,
      totalCards: 0,
      drawerMemberId: null,
      effect: null,
      amount: 0,
      label: '',
      resolved: true,
      targetMemberId: null,
      ruleText: null,
      kingsDrawn: 0,
      totalSipsReceived: {},
      log: [],
    }
  )
}

function addSips(totals: Record<string, number>, memberId: string, amount: number): Record<string, number> {
  return { ...totals, [memberId]: (totals[memberId] ?? 0) + amount }
}

function neighbor(group: Group, memberId: string, offset: 1 | -1): string {
  const idx = group.members.findIndex((m) => m.id === memberId)
  const len = group.members.length
  const target = group.members[(idx + offset + len) % len]
  return target.id
}

function drawNext(group: Group, state: PalmierState, session: PartySession): { session: PartySession; xpAwards?: XpAward[] } {
  const nextIndex = state.currentIndex + 1
  if (nextIndex >= state.secrets.drawOrder.length || state.kingsDrawn >= 4) {
    return endGame(group, state, session)
  }

  const card = state.secrets.drawOrder[nextIndex]
  const drawer = group.members[nextIndex % group.members.length]
  const effect = classify(card)

  let totals = state.totalSipsReceived
  let kingsDrawn = state.kingsDrawn
  let resolved = false
  let targetMemberId: string | null = null
  let logText = ''

  if (effect.type === 'drink-self') {
    totals = addSips(totals, drawer.id, effect.amount)
    resolved = true
    logText = `${drawer.pseudo} boit ${effect.amount} gorgée${effect.amount > 1 ? 's' : ''}`
  } else if (effect.type === 'center-self') {
    totals = addSips(totals, drawer.id, effect.amount)
    resolved = true
    logText = `${drawer.pseudo} boit le verre central cul sec 🥃`
  } else if (effect.type === 'left-drinks' || effect.type === 'right-drinks') {
    targetMemberId = neighbor(group, drawer.id, effect.type === 'left-drinks' ? -1 : 1)
    totals = addSips(totals, targetMemberId, effect.amount)
    resolved = true
    const targetName = group.members.find((m) => m.id === targetMemberId)?.pseudo ?? '?'
    logText = `${targetName} boit ${effect.amount} gorgée`
  } else if (effect.type === 'king') {
    kingsDrawn += 1
    if (kingsDrawn >= 4) {
      totals = addSips(totals, drawer.id, CULSEC_WEIGHT)
      resolved = true
      logText = `${drawer.pseudo} tire le 4e Roi — verre central cul sec 🥃`
    } else {
      resolved = true
      logText = `${drawer.pseudo} verse une gorgée dans le verre central (Roi ${kingsDrawn}/4)`
    }
  } else {
    // give-sips, center-give, buddy, race, challenge, rule all need a follow-up action
    resolved = false
    logText = effect.label
  }

  const newLog = resolved ? [...state.log, { card, drawerMemberId: drawer.id, effect: effect.type, text: logText }] : state.log

  const nextState: PalmierState = {
    ...state,
    currentCard: card,
    currentIndex: nextIndex,
    totalCards: state.secrets.drawOrder.length,
    drawerMemberId: drawer.id,
    effect: effect.type,
    amount: effect.amount,
    label: effect.label,
    resolved,
    targetMemberId,
    kingsDrawn,
    totalSipsReceived: totals,
    log: newLog,
  }

  return { session: { ...session, status: 'playing', phase: 'drawing', round: nextIndex + 1, roundData: nextState } }
}

function endGame(group: Group, state: PalmierState, session: PartySession): { session: PartySession; xpAwards: XpAward[] } {
  const entries = group.members.map((m) => ({ id: m.id, sips: state.totalSipsReceived[m.id] ?? 0 }))
  const minSips = entries.length > 0 ? Math.min(...entries.map((e) => e.sips)) : 0
  const xpAwards: XpAward[] = entries
    .filter((e) => e.sips === minSips)
    .map((e) => ({
      memberId: e.id,
      amount: SURVIVOR_XP,
      statIncrements: { 'palmier.gamesWon': 1 },
      reason: 'A le mieux survécu au Palmier',
    }))
  return { session: { ...session, status: 'ended', phase: 'ended' }, xpAwards }
}

export const palmier: GameModule = {
  id: 'palmier',
  name: 'Palmier',
  icon: '🌴',
  minPlayers: 2,

  initRound(group, session) {
    const state = getState(session)

    if (session.round === 0 && session.phase === null) {
      const drawOrder = buildDeck()
      const newState: PalmierState = {
        secrets: { drawOrder },
        currentCard: null,
        currentIndex: -1,
        totalCards: drawOrder.length,
        drawerMemberId: null,
        effect: null,
        amount: 0,
        label: '',
        resolved: true,
        targetMemberId: null,
        ruleText: null,
        kingsDrawn: 0,
        totalSipsReceived: {},
        log: [],
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    return drawNext(group, state, session)
  },

  handleAction(group, session, memberId, action: GameAction) {
    const state = getState(session)
    if (session.phase !== 'drawing' || state.resolved) return { session }
    if (memberId !== state.drawerMemberId && action.type !== 'judgeLoser') return { session }

    const drawerName = group.members.find((m) => m.id === state.drawerMemberId)?.pseudo ?? '?'

    if (action.type === 'chooseTarget' && (state.effect === 'give-sips' || state.effect === 'center-give' || state.effect === 'buddy')) {
      const payload = action.payload as { targetMemberId?: string } | null
      const targetMemberId = payload?.targetMemberId
      if (!targetMemberId || targetMemberId === memberId || !group.members.some((m) => m.id === targetMemberId)) {
        return { session }
      }
      const targetName = group.members.find((m) => m.id === targetMemberId)?.pseudo ?? '?'
      let totals = state.totalSipsReceived
      let text = ''
      if (state.effect === 'give-sips') {
        totals = addSips(totals, targetMemberId, state.amount)
        text = `${targetName} boit ${state.amount} gorgées (distribuées par ${drawerName})`
      } else if (state.effect === 'center-give') {
        totals = addSips(totals, targetMemberId, state.amount)
        text = `${targetName} boit le verre central cul sec 🥃 (désigné·e par ${drawerName})`
      } else {
        totals = addSips(addSips(totals, targetMemberId, 1), memberId, 1)
        text = `${drawerName} et ${targetName} sont complices — ils boivent ensemble`
      }
      const card = state.currentCard as Card
      const nextState: PalmierState = {
        ...state,
        resolved: true,
        targetMemberId,
        totalSipsReceived: totals,
        log: [...state.log, { card, drawerMemberId: memberId, effect: state.effect, text }],
      }
      return { session: { ...session, roundData: nextState } }
    }

    if (action.type === 'judgeLoser' && (state.effect === 'race' || state.effect === 'challenge')) {
      if (memberId !== session.hostMemberId) return { session }
      const payload = action.payload as { loserMemberId?: string } | null
      const loserMemberId = payload?.loserMemberId
      const card = state.currentCard as Card
      let totals = state.totalSipsReceived
      let text = 'Personne ne boit cette fois'
      if (loserMemberId && group.members.some((m) => m.id === loserMemberId)) {
        totals = addSips(totals, loserMemberId, state.amount)
        const loserName = group.members.find((m) => m.id === loserMemberId)?.pseudo ?? '?'
        text = `${loserName} boit ${state.amount} gorgée`
      }
      const nextState: PalmierState = {
        ...state,
        resolved: true,
        targetMemberId: loserMemberId ?? null,
        totalSipsReceived: totals,
        log: [...state.log, { card, drawerMemberId: state.drawerMemberId as string, effect: state.effect, text }],
      }
      return { session: { ...session, roundData: nextState } }
    }

    if (action.type === 'setRule' && state.effect === 'rule') {
      const payload = action.payload as { text?: string } | null
      const text = payload?.text?.trim().slice(0, 80)
      if (!text) return { session }
      const card = state.currentCard as Card
      const nextState: PalmierState = {
        ...state,
        resolved: true,
        ruleText: text,
        log: [...state.log, { card, drawerMemberId: memberId, effect: 'rule', text: `Nouvelle règle : "${text}"` }],
      }
      return { session: { ...session, roundData: nextState } }
    }

    return { session }
  },

  // Fully host-paced like Pyramide: the host can always draw the next card, even if the current
  // one's follow-up (target pick, host judgement, custom rule) never comes — the effect is just
  // skipped rather than blocking the room.
  isRoundComplete() {
    return false
  },
  isAwaitingInput() {
    return false
  },
  resolveRound(_group, session) {
    return { session }
  },
}
