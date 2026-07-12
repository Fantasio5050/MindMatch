import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'

/** Le PMU (course de chevaux) : les 4 As sont des chevaux, chacun parie des gorgées sur une
 * couleur, puis le paquet défile — chaque carte fait avancer le cheval de sa couleur, et les
 * cartes de côté font reculer. La course entière est résolue ici en une fois, sous forme d'un
 * journal d'événements que tous les clients rejouent de façon synchronisée (TV en 3D). */

export const TRACK_LEN = 7 // position atteinte => ligne d'arrivée franchie
export const SIDE_COUNT = 6 // cartes de côté, une par rangée 1..6
const BET_MIN = 1
const BET_MAX = 6
const WIN_XP = 8
const SURVIVOR_XP = 15
const MAX_DRAWS = 500 // garde-fou théorique, jamais atteint en pratique

interface Card {
  id: string
  rank: number
  suit: number
}

export interface Bet {
  suit: number
  sips: number
}

export type RaceEvent =
  | { type: 'draw'; card: Card; suit: number; newPosition: number }
  | { type: 'setback'; card: Card; suit: number; newPosition: number; row: number }
  | { type: 'finish'; suit: number }

interface RaceResultEntry {
  bet: Bet
  won: boolean
  sipsToDrink: number
  sipsToGive: number
  /** Gorgées gagnées pas encore distribuées — données une par une, donc splittables. */
  remaining: number
  given: Record<string, number>
}

interface PmuState {
  votes: Record<string, Bet>
  bets: Record<string, Bet>
  positions: number[]
  events: RaceEvent[]
  raceStartedAt: number | null
  winnerSuit: number | null
  raceResults: Record<string, RaceResultEntry>
  totalSipsDrunk: Record<string, number>
  totalSipsGiven: Record<string, number>
  raceWins: Record<string, number>
  racesPlayed: number
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Les 48 cartes sans les As (les As SONT les chevaux). */
function buildRaceDeck(tag: string): Card[] {
  const deck: Card[] = []
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 2; rank <= 13; rank++) deck.push({ id: `p-${rank}-${suit}-${tag}`, rank, suit })
  }
  return shuffle(deck)
}

function getState(session: PartySession): PmuState {
  return (
    (session.roundData as PmuState | null) ?? {
      votes: {},
      bets: {},
      positions: [0, 0, 0, 0],
      events: [],
      raceStartedAt: null,
      winnerSuit: null,
      raceResults: {},
      totalSipsDrunk: {},
      totalSipsGiven: {},
      raceWins: {},
      racesPlayed: 0,
    }
  )
}

function add(totals: Record<string, number>, memberId: string, amount: number): Record<string, number> {
  if (amount <= 0) return totals
  return { ...totals, [memberId]: (totals[memberId] ?? 0) + amount }
}

/** Simule une course complète : tirages qui font avancer, cartes de côté qui font reculer dès que
 * tous les chevaux ont dépassé une rangée. Retourne le journal d'événements + le vainqueur. */
export function simulateRace(): { events: RaceEvent[]; winnerSuit: number; positions: number[] } {
  let deck = buildRaceDeck('a')
  let deckCycle = 0
  const sideCards = deck.splice(0, SIDE_COUNT)
  const positions = [0, 0, 0, 0]
  const events: RaceEvent[] = []
  let flipped = 0
  let winnerSuit = -1

  for (let draws = 0; draws < MAX_DRAWS && winnerSuit === -1; draws++) {
    if (deck.length === 0) {
      deckCycle++
      deck = buildRaceDeck(`r${deckCycle}`)
    }
    const card = deck.shift() as Card
    positions[card.suit] += 1
    events.push({ type: 'draw', card, suit: card.suit, newPosition: positions[card.suit] })

    if (positions[card.suit] >= TRACK_LEN) {
      winnerSuit = card.suit
      events.push({ type: 'finish', suit: card.suit })
      break
    }

    // Dès que TOUS les chevaux ont dépassé la rangée k, sa carte de côté se retourne et fait
    // reculer le cheval de sa couleur d'une case. Une seule vague de flips par tirage possible.
    while (flipped < SIDE_COUNT && Math.min(...positions) >= flipped + 1) {
      const side = sideCards[flipped]
      flipped++
      positions[side.suit] = Math.max(0, positions[side.suit] - 1)
      events.push({ type: 'setback', card: side, suit: side.suit, newPosition: positions[side.suit], row: flipped })
    }
  }

  return { events, winnerSuit, positions }
}

export const pmu: GameModule = {
  id: 'pmu',
  name: 'PMU',
  icon: '🏇',
  minPlayers: 2,

  initRound(_group, session) {
    const state = getState(session)

    // 1) Tout premier appel : écran de règles.
    if (session.round === 0 && session.phase === null) {
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: state } }
    }

    // 2) Fin des règles OU fin d'une course : nouvelle course, les paris s'ouvrent.
    if (session.phase === 'intro' || session.phase === 'results') {
      const nextState: PmuState = {
        ...state,
        votes: {},
        bets: {},
        positions: [0, 0, 0, 0],
        events: [],
        raceStartedAt: null,
        winnerSuit: null,
        raceResults: {},
      }
      return { session: { ...session, phase: 'betting', round: session.round + 1, roundData: nextState } }
    }

    // 3) La lecture de la course est finie sur les écrans -> panneau des résultats.
    if (session.phase === 'racing') {
      return { session: { ...session, phase: 'results', roundData: state } }
    }

    return { session }
  },

  handleAction(group, session, memberId, action: GameAction) {
    const state = getState(session)

    // Parier (ou changer son pari tant que tout le monde n'a pas validé).
    if (action.type === 'bet' && session.phase === 'betting') {
      if (!session.participantIds.includes(memberId)) return { session }
      const payload = action.payload as { suit?: number; sips?: number } | null
      const suit = payload?.suit
      const sips = payload?.sips
      if (typeof suit !== 'number' || !Number.isInteger(suit) || suit < 0 || suit > 3) return { session }
      if (typeof sips !== 'number' || !Number.isInteger(sips) || sips < BET_MIN || sips > BET_MAX) return { session }
      return { session: { ...session, roundData: { ...state, votes: { ...state.votes, [memberId]: { suit, sips } } } } }
    }

    // Distribuer ses gorgées gagnées, une par une (splittables entre plusieurs joueurs).
    if (action.type === 'distributeSip' && session.phase === 'results') {
      const entry = state.raceResults[memberId]
      const payload = action.payload as { targetMemberId?: string } | null
      const targetMemberId = payload?.targetMemberId
      if (!entry || entry.remaining <= 0 || !targetMemberId || targetMemberId === memberId) return { session }
      if (!group.members.some((m) => m.id === targetMemberId)) return { session }

      const nextEntry: RaceResultEntry = {
        ...entry,
        remaining: entry.remaining - 1,
        given: { ...entry.given, [targetMemberId]: (entry.given[targetMemberId] ?? 0) + 1 },
      }
      return {
        session: {
          ...session,
          roundData: {
            ...state,
            raceResults: { ...state.raceResults, [memberId]: nextEntry },
            totalSipsDrunk: add(state.totalSipsDrunk, targetMemberId, 1),
            totalSipsGiven: add(state.totalSipsGiven, memberId, 1),
          },
        },
      }
    }

    // L'hôte clôt le PMU depuis l'écran des résultats -> podium final.
    if (action.type === 'finish' && session.phase === 'results') {
      if (session.hostMemberId !== memberId) return { session }
      const entries = session.participantIds.map((id) => ({ id, drunk: state.totalSipsDrunk[id] ?? 0 }))
      const minDrunk = entries.length > 0 ? Math.min(...entries.map((e) => e.drunk)) : 0
      const xpAwards: XpAward[] = entries
        .filter((e) => e.drunk === minDrunk)
        .map((e) => ({
          memberId: e.id,
          amount: SURVIVOR_XP,
          statIncrements: { 'pmu.gamesWon': 1 },
          reason: 'A le mieux survécu au PMU',
        }))
      return { session: { ...session, status: 'ended', phase: 'ended' }, xpAwards }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    if (session.phase !== 'betting') return false
    const state = getState(session)
    return session.participantIds.length > 0 && session.participantIds.every((id) => !!state.votes[id])
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'betting'
  },

  // Tous les paris sont posés : la course entière se joue ici, les clients ne feront que la
  // rejouer image par image, parfaitement synchronisés sur `raceStartedAt`.
  resolveRound(_group, session) {
    const state = getState(session)
    const bets = { ...state.votes }
    const { events, winnerSuit, positions } = simulateRace()

    let totalDrunk = state.totalSipsDrunk
    let totalGiven = state.totalSipsGiven
    let raceWins = state.raceWins
    const raceResults: Record<string, RaceResultEntry> = {}
    const xpAwards: XpAward[] = []

    for (const [memberId, bet] of Object.entries(bets)) {
      const won = bet.suit === winnerSuit
      if (won) {
        raceResults[memberId] = { bet, won, sipsToDrink: 0, sipsToGive: bet.sips * 2, remaining: bet.sips * 2, given: {} }
        raceWins = add(raceWins, memberId, 1)
        xpAwards.push({ memberId, amount: WIN_XP, statIncrements: { 'pmu.raceWins': 1 }, reason: 'A parié sur le bon cheval au PMU' })
      } else {
        raceResults[memberId] = { bet, won, sipsToDrink: bet.sips, sipsToGive: 0, remaining: 0, given: {} }
        totalDrunk = add(totalDrunk, memberId, bet.sips)
      }
    }

    const nextState: PmuState = {
      ...state,
      votes: {},
      bets,
      positions,
      events,
      raceStartedAt: Date.now(),
      winnerSuit,
      raceResults,
      totalSipsDrunk: totalDrunk,
      totalSipsGiven: totalGiven,
      raceWins,
      racesPlayed: state.racesPlayed + 1,
    }

    return { session: { ...session, phase: 'racing', roundData: nextState }, xpAwards }
  },
}
