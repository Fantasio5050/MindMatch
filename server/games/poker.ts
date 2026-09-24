import type { PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import type {
  PokerCard,
  PokerConfig,
  BettingRound,
  HandStrength,
  ActionSuggestion,
  PotOdds,
  PokerOuts,
} from '../../src/party/games/poker/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_STARTING_CHIPS = 1000
const DEFAULT_SMALL_BLIND = 10
const DEFAULT_BIG_BLIND = 20

const SUITS: PokerCard['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: PokerCard['rank'][] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

const HAND_NAMES = [
  'Haute Carte',
  'Paire',
  'Double Paire',
  'Brelan',
  'Suite',
  'Couleur',
  'Full',
  'Carré',
  'Quinte Flush',
  'Quinte Flush Royale',
]

// ---------------------------------------------------------------------------
// Deck helpers
// ---------------------------------------------------------------------------

function createDeck(): PokerCard[] {
  const deck: PokerCard[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}-${suit}`, rank, suit })
    }
  }
  return deck
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ---------------------------------------------------------------------------
// Hand evaluation
// ---------------------------------------------------------------------------

interface HandEval {
  rank: number // 0=high card ... 9=royal flush
  name: string
  kickers: number[] // tiebreakers, descending
  bestFive: PokerCard[]
}

/**
 * Evaluate the best 5-card poker hand from up to 7 cards (2 hole + 5 community).
 * Returns { rank, name, kickers, bestFive }.
 */
export function evaluateHand(cards: PokerCard[]): HandEval {
  if (cards.length < 5) {
    // Not enough cards — evaluate what we can (partial)
    return evaluatePartialHand(cards)
  }

  // Generate all combinations of 5 from the given cards
  const combos = combinations(cards, 5)
  let best: HandEval | null = null

  for (const combo of combos) {
    const evalResult = evaluateFive(combo)
    if (!best || compareHands(evalResult, best) > 0) {
      best = evalResult
    }
  }

  return best!
}

function evaluatePartialHand(cards: PokerCard[]): HandEval {
  // If fewer than 5 cards, still try to evaluate best possible
  if (cards.length === 0) {
    return { rank: 0, name: 'Haute Carte', kickers: [], bestFive: [] }
  }
  const sorted = [...cards].sort((a, b) => b.rank - a.rank)
  const ranks = sorted.map((c) => c.rank)

  // Check for pair
  const rankCounts = countRanks(cards)
  const pairs = Object.entries(rankCounts).filter(([, c]) => c === 2)
  const threeOfKind = Object.entries(rankCounts).find(([, c]) => c === 3)

  if (threeOfKind) {
    const rank = parseInt(threeOfKind[0])
    return { rank: 3, name: 'Brelan', kickers: [rank, ...ranks.filter((r) => r !== rank)].slice(0, 5), bestFive: sorted }
  }
  if (pairs.length >= 2) {
    const sortedPairs = pairs.map((p) => parseInt(p[0])).sort((a, b) => b - a)
    return { rank: 2, name: 'Double Paire', kickers: [...sortedPairs, ...ranks.filter((r) => !sortedPairs.includes(r))].slice(0, 5), bestFive: sorted }
  }
  if (pairs.length === 1) {
    const pairRank = parseInt(pairs[0][0])
    return { rank: 1, name: 'Paire', kickers: [pairRank, ...ranks.filter((r) => r !== pairRank)].slice(0, 5), bestFive: sorted }
  }

  return { rank: 0, name: 'Haute Carte', kickers: ranks.slice(0, 5), bestFive: sorted }
}

function evaluateFive(cards: PokerCard[]): HandEval {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank)
  const ranks = sorted.map((c) => c.rank)
  const suits = sorted.map((c) => c.suit)

  const rankCounts = countRanks(cards)
  const counts = Object.values(rankCounts).sort((a, b) => b - a)
  const rankByCount = Object.entries(rankCounts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return parseInt(b[0]) - parseInt(a[0])
    })
    .map((e) => parseInt(e[0]))

  const isFlush = suits.every((s) => s === suits[0])
  const isStraight = checkStraight(ranks)
  const isLowStraight = checkLowStraight(ranks)

  // Royal Flush
  if (isFlush && isStraight && ranks[0] === 14) {
    return { rank: 9, name: HAND_NAMES[9], kickers: [14], bestFive: sorted }
  }
  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: 8, name: HAND_NAMES[8], kickers: [ranks[0]], bestFive: sorted }
  }
  // Low straight flush (A-2-3-4-5)
  if (isFlush && isLowStraight) {
    return { rank: 8, name: HAND_NAMES[8], kickers: [5], bestFive: sorted }
  }
  // Four of a Kind
  if (counts[0] === 4) {
    const fourRank = rankByCount[0]
    const kicker = ranks.find((r) => r !== fourRank)!
    return { rank: 7, name: HAND_NAMES[7], kickers: [fourRank, kicker], bestFive: sorted }
  }
  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    return { rank: 6, name: HAND_NAMES[6], kickers: [rankByCount[0], rankByCount[1]], bestFive: sorted }
  }
  // Flush
  if (isFlush) {
    return { rank: 5, name: HAND_NAMES[5], kickers: ranks, bestFive: sorted }
  }
  // Straight
  if (isStraight) {
    return { rank: 4, name: HAND_NAMES[4], kickers: [ranks[0]], bestFive: sorted }
  }
  if (isLowStraight) {
    return { rank: 4, name: HAND_NAMES[4], kickers: [5], bestFive: sorted }
  }
  // Three of a Kind
  if (counts[0] === 3) {
    const threeRank = rankByCount[0]
    const kickers = ranks.filter((r) => r !== threeRank).slice(0, 2)
    return { rank: 3, name: HAND_NAMES[3], kickers: [threeRank, ...kickers], bestFive: sorted }
  }
  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    const highPair = rankByCount[0]
    const lowPair = rankByCount[1]
    const kicker = ranks.find((r) => r !== highPair && r !== lowPair)!
    return { rank: 2, name: HAND_NAMES[2], kickers: [highPair, lowPair, kicker], bestFive: sorted }
  }
  // Pair
  if (counts[0] === 2) {
    const pairRank = rankByCount[0]
    const kickers = ranks.filter((r) => r !== pairRank).slice(0, 3)
    return { rank: 1, name: HAND_NAMES[1], kickers: [pairRank, ...kickers], bestFive: sorted }
  }
  // High Card
  return { rank: 0, name: HAND_NAMES[0], kickers: ranks, bestFive: sorted }
}

function countRanks(cards: PokerCard[]): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const c of cards) {
    counts[c.rank] = (counts[c.rank] ?? 0) + 1
  }
  return counts
}

function checkStraight(sortedDescRanks: number[]): boolean {
  // sortedDescRanks is already sorted descending and has exactly 5 unique values
  const unique = [...new Set(sortedDescRanks)]
  if (unique.length !== 5) return false
  return unique[0] - unique[4] === 4
}

function checkLowStraight(sortedDescRanks: number[]): boolean {
  // A-2-3-4-5: ranks would be [14, 5, 4, 3, 2]
  const unique = [...new Set(sortedDescRanks)]
  if (unique.length !== 5) return false
  return unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2
}

/**
 * Compare two hand evaluations. Returns >0 if a wins, <0 if b wins, 0 if tie.
 */
function compareHands(a: HandEval, b: HandEval): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const ak = a.kickers[i] ?? 0
    const bk = b.kickers[i] ?? 0
    if (ak !== bk) return ak - bk
  }
  return 0
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = []
  const n = arr.length
  if (k > n) return result

  const indices: number[] = []
  for (let i = 0; i < k; i++) indices.push(i)

  while (true) {
    result.push(indices.map((i) => arr[i]))
    // Find rightmost index that can be incremented
    let i = k - 1
    while (i >= 0 && indices[i] === i + n - k) i--
    if (i < 0) break
    indices[i]++
    for (let j = i + 1; j < k; j++) {
      indices[j] = indices[j - 1] + 1
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Assisted mode helpers
// ---------------------------------------------------------------------------

/**
 * Compute hand strength for assisted mode.
 * Based on hole cards + community cards.
 */
function computeHandStrength(holeCards: PokerCard[], communityCards: PokerCard[]): HandStrength {
  const allCards = [...holeCards, ...communityCards]
  if (holeCards.length < 2) {
    return { level: 'weak', description: 'Pas de cartes' }
  }

  // Pre-flop: evaluate based on hole cards only
  if (communityCards.length === 0) {
    const [c1, c2] = holeCards
    const isPair = c1.rank === c2.rank
    const isSuited = c1.suit === c2.suit
    const high = Math.max(c1.rank, c2.rank)
    const low = Math.min(c1.rank, c2.rank)
    const gap = high - low

    if (isPair) {
      if (high >= 10) return { level: 'strong', description: `Paire de ${rankName(high)} ! Excellente main de départ` }
      if (high >= 7) return { level: 'medium', description: `Paire de ${rankName(high)}, bonne main de départ` }
      return { level: 'medium', description: `Petite paire de ${rankName(high)} — joue prudemment` }
    }

    if (high === 14 && low >= 10) {
      return { level: isSuited ? 'strong' : 'medium', description: `As + ${rankName(low)}${isSuited ? ' assortis' : ''} — forte main` }
    }
    if (high >= 12 && low >= 10 && gap <= 2) {
      return { level: isSuited ? 'strong' : 'medium', description: `Broadway ${isSuited ? 'assorti' : ''} — cartes fortes` }
    }
    if (isSuited && gap <= 2 && high >= 8) {
      return { level: 'medium', description: `Connecteurs assortis ${rankName(low)}-${rankName(high)} — potentiel de suite/couleur` }
    }
    if (high >= 11) {
      return { level: 'medium', description: `${rankName(high)} hauteur — joue avec prudence` }
    }
    return { level: 'weak', description: `${rankName(low)}-${rankName(high)} ${isSuited ? 'assortis' : 'dépareillés'} — main faible` }
  }

  // Post-flop: use actual hand evaluation
  const evalResult = evaluateHand(allCards)
  const rank = evalResult.rank

  if (rank >= 6) return { level: 'strong', description: `${evalResult.name} ! Main très forte 🔥` }
  if (rank >= 4) return { level: 'strong', description: `${evalResult.name} — main puissante` }
  if (rank >= 2) return { level: 'medium', description: `${evalResult.name} — main correcte` }
  if (rank === 1) {
    const pairRank = evalResult.kickers[0]
    if (pairRank >= 11) return { level: 'medium', description: `Paire de ${rankName(pairRank)} — correct` }
    return { level: 'weak', description: `Petite paire de ${rankName(pairRank)} — fragile` }
  }
  return { level: 'weak', description: `Haute carte ${rankName(evalResult.kickers[0] ?? 0)} — main faible` }
}

/**
 * Compute action suggestion for assisted mode.
 */
function computeSuggestion(
  holeCards: PokerCard[],
  communityCards: PokerCard[],
  toCall: number,
  yourChips: number,
  pot: number,
): ActionSuggestion {
  const strength = computeHandStrength(holeCards, communityCards)

  if (strength.level === 'strong') {
    if (toCall === 0) {
      return { action: 'raise', reason: 'Main forte — relance pour augmenter le pot et mettre la pression' }
    }
    if (toCall >= yourChips) {
      return { action: 'all-in', reason: 'Main forte et tu dois faire tapis pour suivre — fonce !' }
    }
    return { action: 'raise', reason: 'Main forte — relance pour valoriser ta main et augmenter le pot' }
  }

  if (strength.level === 'medium') {
    if (toCall === 0) {
      return { action: 'check', reason: 'Main moyenne — vois la prochaine carte gratuitement' }
    }
    const potOddsValue = toCall / (pot + toCall)
    if (potOddsValue < 0.25) {
      return { action: 'call', reason: 'Pas cher à suivre par rapport au pot — suis pour voir la suite' }
    }
    if (potOddsValue < 0.4) {
      return { action: 'call', reason: 'Cotes correctes — tu peux suivre prudemment' }
    }
    return { action: 'fold', reason: 'Trop cher pour ta main moyenne — mieux vaut se coucher' }
  }

  // Weak
  if (toCall === 0) {
    return { action: 'check', reason: 'Main faible — check pour voir une carte gratuite' }
  }
  if (toCall <= DEFAULT_BIG_BLIND && yourChips > toCall * 20) {
    return { action: 'call', reason: 'Pas cher à suivre — tu peux tenter ta chance pour peu' }
  }
  return { action: 'fold', reason: 'Main faible et trop cher à suivre — couche-toi pour économiser tes jetons' }
}

/**
 * Compute pot odds for assisted mode.
 */
function computePotOdds(toCall: number, pot: number): PotOdds | null {
  if (toCall <= 0) return null
  const totalPot = pot + toCall
  const ratio = (toCall / totalPot) * 100
  const roundedRatio = Math.round(ratio)
  return {
    toCall,
    potSize: pot,
    ratio: `${roundedRatio}%`,
  }
}

/**
 * Compute outs for assisted mode — cards that would improve the hand.
 */
function computeOuts(holeCards: PokerCard[], communityCards: PokerCard[]): PokerOuts | null {
  if (holeCards.length < 2) return null

  const knownCards = new Set([...holeCards, ...communityCards].map((c) => c.id))
  const remainingDeck = createDeck().filter((c) => !knownCards.has(c.id))

  // If we have community cards, evaluate current hand and look for improvements
  if (communityCards.length >= 3) {
    const currentEval = evaluateHand([...holeCards, ...communityCards])
    const outs: PokerCard[] = []

    // Check each remaining card to see if it improves our hand
    for (const card of remainingDeck) {
      const newEval = evaluateHand([...holeCards, ...communityCards, card])
      if (newEval.rank > currentEval.rank) {
        outs.push(card)
      }
    }

    if (outs.length === 0) {
      // Check for draws (flush draw, straight draw)
      const flushOuts = checkFlushDraw(holeCards, communityCards, remainingDeck)
      const straightOuts = checkStraightDraw(holeCards, communityCards, remainingDeck)

      if (flushOuts.count > 0) {
        return { description: flushOuts.description, count: flushOuts.count }
      }
      if (straightOuts.count > 0) {
        return { description: straightOuts.description, count: straightOuts.count }
      }
      return { description: 'Aucune out évidente — ta main ne s\'améliorera probablement pas', count: 0 }
    }

    // Group outs by what they improve to
    const improvements = new Map<number, PokerCard[]>()
    for (const card of outs) {
      const newEval = evaluateHand([...holeCards, ...communityCards, card])
      if (!improvements.has(newEval.rank)) improvements.set(newEval.rank, [])
      improvements.get(newEval.rank)!.push(card)
    }

    const parts: string[] = []
    for (const [rank, cards] of improvements) {
      parts.push(`${cards.length} ${pluralCard(cards.length)} → ${HAND_NAMES[rank]}`)
    }

    return {
      description: `${outs.length} outs: ${parts.join(', ')}`,
      count: outs.length,
    }
  }

  // Pre-flop: look for potential
  const [c1, c2] = holeCards
  if (c1.rank === c2.rank) {
    return { description: `2 ${rankName(c1.rank)} restants → Brelan, ${4 - 2} pour Carré`, count: 2 }
  }

  // Suited cards — flush potential
  if (c1.suit === c2.suit) {
    const suitCount = communityCards.filter((c) => c.suit === c1.suit).length
    const remaining = 13 - 2 - suitCount
    return { description: `${remaining} cartes ${suitSymbol(c1.suit)} restantes → Couleur`, count: remaining }
  }

  return null
}

function checkFlushDraw(
  holeCards: PokerCard[],
  communityCards: PokerCard[],
  remainingDeck: PokerCard[],
): { description: string; count: number } {
  const allCards = [...holeCards, ...communityCards]
  const suitCounts: Record<string, number> = {}
  for (const c of allCards) {
    suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1
  }

  for (const [suit, count] of Object.entries(suitCounts)) {
    if (count === 4) {
      const outs = remainingDeck.filter((c) => c.suit === suit).length
      return { description: `${outs} cartes ${suitSymbol(suit as PokerCard['suit'])} restantes → Couleur`, count: outs }
    }
  }
  return { description: '', count: 0 }
}

function checkStraightDraw(
  holeCards: PokerCard[],
  communityCards: PokerCard[],
  _remainingDeck: PokerCard[],
): { description: string; count: number } {
  const allCards = [...holeCards, ...communityCards]
  const ranks = [...new Set(allCards.map((c) => c.rank))].sort((a, b) => a - b)

  // Look for open-ended or gutshot straight draws
  for (let i = 0; i <= ranks.length - 4; i++) {
    const window = ranks.slice(i, i + 4)
    if (window[3] - window[0] === 3) {
      // 4 consecutive ranks — open-ended straight draw
      return { description: 'Tirage suite par les deux bouts — 8 outs', count: 8 }
    }
    if (window[3] - window[0] === 4) {
      // Gutshot — 4 outs
      return { description: 'Tirage suite par le ventre — 4 outs', count: 4 }
    }
  }
  return { description: '', count: 0 }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function rankName(rank: number): string {
  const names: Record<number, string> = {
    2: 'Deux', 3: 'Trois', 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept',
    8: 'Huit', 9: 'Neuf', 10: 'Dix', 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As',
  }
  return names[rank] ?? '?'
}

function suitSymbol(suit: PokerCard['suit']): string {
  const symbols: Record<PokerCard['suit'], string> = {
    hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
  }
  return symbols[suit]
}

function pluralCard(n: number): string {
  return n > 1 ? 'cartes' : 'carte'
}

// ---------------------------------------------------------------------------
// Déroulé d'une partie
// ---------------------------------------------------------------------------
//
// Réécrit : la version précédente était injouable (aucune vue par joueur : pas de cartes, pas
// de boutons) et, une fois branchée, fausse :
//  - quand tout le monde se couchait, le pot était versé AVANT d'y ajouter les mises du tour en
//    cours — blindes et relances disparaissaient ;
//  - un tapis suivi partait à l'abattage sans distribuer les cartes communes restantes : la main
//    se décidait sur deux cartes ;
//  - pas de pot partagé en cas d'égalité, pas de pot secondaire : un tapis court pouvait rafler
//    l'argent qu'il n'avait jamais pu couvrir ;
//  - les joueurs ruinés étaient « ressuscités » à 1 000 jetons, donc la partie ne finissait pas ;
//  - chaque action reçue après une main redistribuait l'XP de la victoire.
//
// Invariant vérifié par simulation : la somme des tapis et des mises engagées ne varie jamais.

const WIN_HAND_XP = 5
const WIN_GAME_XP = 25

type Street = BettingRound

interface PokerWinner {
  memberId: string
  amount: number
  handDescription: string
}

interface PokerState {
  phase: 'mode-selection' | 'betting' | 'ended'
  /** Ordre de table, figé au lancement (les arrivées en cours de partie regardent). */
  seats: string[]
  chips: Record<string, number>
  startingChips: number
  smallBlind: number
  bigBlind: number
  assisted: Record<string, boolean>
  modeChosen: string[]
  handNumber: number
  dealer: string | null
  deck: PokerCard[]
  hands: Record<string, PokerCard[]>
  board: PokerCard[]
  street: Street
  /** Joueurs servis à cette main (ceux qui avaient encore des jetons). */
  inHand: string[]
  folded: string[]
  allIn: string[]
  /** Mises du tour d'enchères en cours. */
  streetBets: Record<string, number>
  /** Total engagé dans la main : sert aux pots secondaires. */
  committed: Record<string, number>
  toAct: string | null
  /** Ont parlé depuis la dernière relance. */
  acted: string[]
  lastRaiseSize: number
  lastAction: { playerId: string; action: string; amount: number } | null
  /** Résultat de la dernière main : gagnants (plusieurs si partage) et mains montrées. */
  winners: PokerWinner[]
  revealed: Record<string, { cards: PokerCard[]; handDescription: string }>
  gameWinner: string | null
}

function getState(session: PartySession): PokerState | null {
  return (session.roundData as PokerState | null) ?? null
}

function clone(s: PokerState): PokerState {
  return {
    ...s,
    chips: { ...s.chips },
    assisted: { ...s.assisted },
    modeChosen: [...s.modeChosen],
    deck: [...s.deck],
    hands: { ...s.hands },
    board: [...s.board],
    inHand: [...s.inHand],
    folded: [...s.folded],
    allIn: [...s.allIn],
    streetBets: { ...s.streetBets },
    committed: { ...s.committed },
    acted: [...s.acted],
    winners: [...s.winners],
    revealed: { ...s.revealed },
  }
}

/** Joueur suivant dans l'ordre de table, parmi `pool`, strictement après `fromId`. */
function nextIn(seats: string[], pool: string[], fromId: string | null): string | null {
  if (pool.length === 0) return null
  const start = fromId ? seats.indexOf(fromId) : -1
  for (let i = 1; i <= seats.length; i++) {
    const id = seats[(start + i + seats.length) % seats.length]
    if (pool.includes(id)) return id
  }
  return null
}

const live = (s: PokerState) => s.inHand.filter((id) => !s.folded.includes(id))
const canAct = (s: PokerState) => live(s).filter((id) => !s.allIn.includes(id))
const maxBet = (s: PokerState) => Math.max(0, ...s.inHand.map((id) => s.streetBets[id] ?? 0))
const potTotal = (s: PokerState) => s.inHand.reduce((a, id) => a + (s.committed[id] ?? 0), 0)

/** Met des jetons au milieu (plafonné au tapis). Mutation de la copie de travail. */
function putIn(s: PokerState, id: string, amount: number): number {
  const paid = Math.max(0, Math.min(amount, s.chips[id]))
  s.chips[id] -= paid
  s.streetBets[id] = (s.streetBets[id] ?? 0) + paid
  s.committed[id] = (s.committed[id] ?? 0) + paid
  if (s.chips[id] === 0 && !s.allIn.includes(id)) s.allIn.push(id)
  return paid
}

function isStreetComplete(s: PokerState): boolean {
  const actors = canAct(s)
  const top = maxBet(s)
  if (actors.length === 0) return true
  // Un seul joueur peut encore miser et il a couvert : il n'a plus personne contre qui parier.
  if (actors.length === 1 && (s.streetBets[actors[0]] ?? 0) >= top) return true
  return actors.every((id) => s.acted.includes(id) && (s.streetBets[id] ?? 0) === top)
}

function dealBoardTo(s: PokerState, target: number): void {
  while (s.board.length < target) {
    // Une carte brûlée avant le flop, la turn et la river.
    if (s.board.length === 0 || s.board.length === 3 || s.board.length === 4) s.deck.shift()
    const n = s.board.length === 0 ? 3 : 1
    s.board.push(...s.deck.splice(0, n))
  }
}

/**
 * Pots secondaires. Chaque palier d'engagement forme un pot auquel ne peuvent prétendre que ceux
 * qui l'ont couvert ; les couchés y ont contribué mais n'y prétendent pas. Partage à égalité, le
 * jeton indivisible va au premier gagnant après le donneur (règle de salle).
 */
function settlePots(s: PokerState): PokerWinner[] {
  const contenders = live(s)
  const evals = new Map(contenders.map((id) => [id, evaluateHand([...s.hands[id], ...s.board])]))
  const levels = [...new Set(s.inHand.map((id) => s.committed[id] ?? 0).filter((v) => v > 0))].sort((a, b) => a - b)
  const won: Record<string, { amount: number; hand: string }> = {}
  let prev = 0
  for (const level of levels) {
    const slice = s.inHand.reduce((a, id) => a + Math.max(0, Math.min(s.committed[id] ?? 0, level) - prev), 0)
    prev = level
    if (slice === 0) continue
    const eligible = contenders.filter((id) => (s.committed[id] ?? 0) >= level)
    // Personne n'a couvert ce palier (le plus gros tapis était couché) : il revient au(x)
    // joueur(s) encore en lice qui ont misé le plus.
    const pool = eligible.length > 0 ? eligible : contenders
    let best: string[] = []
    for (const id of pool) {
      if (best.length === 0) { best = [id]; continue }
      const cmp = compareHands(evals.get(id)!, evals.get(best[0])!)
      if (cmp > 0) best = [id]
      else if (cmp === 0) best.push(id)
    }
    const ordered = s.seats.filter((id) => best.includes(id))
    const firstAfterDealer = nextIn(s.seats, ordered, s.dealer) ?? ordered[0]
    const share = Math.floor(slice / best.length)
    let odd = slice - share * best.length
    for (const id of ordered) {
      const extra = id === firstAfterDealer && odd > 0 ? odd : 0
      odd -= extra
      s.chips[id] += share + extra
      won[id] = { amount: (won[id]?.amount ?? 0) + share + extra, hand: evals.get(id)!.name }
    }
  }
  return Object.entries(won).map(([memberId, w]) => ({ memberId, amount: w.amount, handDescription: w.hand }))
}

/** Fin de main : paiement, cartes montrées, et éventuellement fin de partie. */
function finishHand(s: PokerState): XpAward[] {
  const remaining = live(s)
  if (remaining.length === 1) {
    // Tout le monde s'est couché : le dernier ramasse sans montrer ses cartes.
    const winner = remaining[0]
    const amount = potTotal(s)
    s.chips[winner] += amount
    s.winners = [{ memberId: winner, amount, handDescription: 'Les autres se sont couchés' }]
    s.revealed = {}
  } else {
    dealBoardTo(s, 5)
    s.winners = settlePots(s)
    s.revealed = Object.fromEntries(
      remaining.map((id) => [id, { cards: s.hands[id], handDescription: evaluateHand([...s.hands[id], ...s.board]).name }]),
    )
  }
  s.phase = 'ended'
  s.toAct = null
  s.committed = {}
  s.streetBets = {}

  const xp: XpAward[] = s.winners.map((w) => ({
    memberId: w.memberId,
    amount: WIN_HAND_XP,
    statIncrements: { 'poker.handsWon': 1 },
    reason: `A remporté ${w.amount} jetons`,
  }))
  const stillIn = s.seats.filter((id) => s.chips[id] > 0)
  if (stillIn.length === 1) {
    s.gameWinner = stillIn[0]
    xp.push({ memberId: stillIn[0], amount: WIN_GAME_XP, statIncrements: { 'poker.wins': 1 }, reason: 'A raflé tous les jetons' })
  }
  return xp
}

/** Tour d'enchères terminé : carte(s) suivante(s), ou abattage. */
function advanceStreet(s: PokerState): XpAward[] {
  s.streetBets = {}
  s.acted = []
  s.lastRaiseSize = s.bigBlind
  if (s.street === 'river' || canAct(s).length <= 1) {
    // Plus d'enchères possibles (river passée, ou tout le monde à tapis sauf un au plus) : on
    // retourne tout le tableau et on abat les cartes.
    return finishHand(s)
  }
  const order: Street[] = ['preflop', 'flop', 'turn', 'river']
  s.street = order[order.indexOf(s.street) + 1]
  dealBoardTo(s, s.street === 'flop' ? 3 : s.street === 'turn' ? 4 : 5)
  s.toAct = nextIn(s.seats, canAct(s), s.dealer)
  return []
}

/** Après chaque action : main gagnée par abandon, tour terminé, ou joueur suivant. */
function afterAction(s: PokerState, actorId: string): XpAward[] {
  if (live(s).length === 1) return finishHand(s)
  if (isStreetComplete(s)) return advanceStreet(s)
  s.toAct = nextIn(s.seats, canAct(s), actorId)
  return []
}

function startHand(s: PokerState): { ended: boolean; xp: XpAward[] } {
  const players = s.seats.filter((id) => s.chips[id] > 0)
  if (players.length < 2) {
    s.phase = 'ended'
    s.gameWinner = players[0] ?? s.gameWinner
    return { ended: true, xp: [] }
  }
  const deck = shuffle(createDeck())
  s.inHand = players
  s.hands = Object.fromEntries(players.map((id) => [id, [deck.shift()!, deck.shift()!]]))
  s.deck = deck
  s.board = []
  s.folded = []
  s.allIn = []
  s.streetBets = {}
  s.committed = {}
  s.acted = []
  s.street = 'preflop'
  s.winners = []
  s.revealed = {}
  s.lastAction = null
  s.lastRaiseSize = s.bigBlind
  s.handNumber += 1
  s.dealer = nextIn(s.seats, players, s.dealer)

  // Tête-à-tête : le donneur est petite blinde et parle en premier avant le flop.
  const sb = players.length === 2 ? s.dealer! : nextIn(s.seats, players, s.dealer)!
  const bb = nextIn(s.seats, players, sb)!
  putIn(s, sb, s.smallBlind)
  putIn(s, bb, s.bigBlind)
  s.phase = 'betting'
  s.toAct = nextIn(s.seats, canAct(s), bb)
  // Blindes qui mettent tout le monde à tapis : rien à jouer, on retourne le tableau.
  const xp = !s.toAct || isStreetComplete(s) ? advanceStreet(s) : []
  return { ended: false, xp }
}

function applyBet(s: PokerState, memberId: string, type: string, payload: unknown): { ok: boolean; xp: XpAward[] } {
  const mine = s.streetBets[memberId] ?? 0
  const top = maxBet(s)
  const toCall = top - mine

  if (type === 'check') {
    if (toCall > 0) return { ok: false, xp: [] }
    s.lastAction = { playerId: memberId, action: 'check', amount: 0 }
  } else if (type === 'call') {
    if (toCall <= 0) return { ok: false, xp: [] }
    const paid = putIn(s, memberId, toCall)
    s.lastAction = { playerId: memberId, action: s.allIn.includes(memberId) ? 'all-in' : 'call', amount: paid }
  } else if (type === 'fold') {
    s.folded.push(memberId)
    s.lastAction = { playerId: memberId, action: 'fold', amount: 0 }
  } else if (type === 'raise' || type === 'all-in') {
    const target = type === 'all-in' ? mine + s.chips[memberId] : Number((payload as { amount?: number } | null)?.amount)
    if (!Number.isFinite(target) || target <= top) return { ok: false, xp: [] }
    const isAllIn = target >= mine + s.chips[memberId]
    // Une relance doit être au moins égale à la précédente ; seul un tapis peut faire moins.
    if (!isAllIn && target < top + s.lastRaiseSize) return { ok: false, xp: [] }
    const paid = putIn(s, memberId, target - mine)
    const raisedBy = mine + paid - top
    // Toute hausse oblige les autres à reparler. Un tapis inférieur à une relance complète ne
    // devrait, en tournoi, pas rouvrir le droit de relancer ; on le rouvre quand même (règle de
    // salon, plus lisible au téléphone) mais sans augmenter la relance minimale.
    if (raisedBy >= s.lastRaiseSize) s.lastRaiseSize = raisedBy
    s.acted = []
    s.lastAction = { playerId: memberId, action: s.allIn.includes(memberId) ? 'all-in' : 'raise', amount: mine + paid }
  } else {
    return { ok: false, xp: [] }
  }
  if (!s.acted.includes(memberId)) s.acted.push(memberId)
  const xp: XpAward[] =
    type === 'fold' ? [{ memberId, amount: 1, statIncrements: { 'poker.folds': 1 }, reason: 'S’est couché' }] : []
  return { ok: true, xp: [...xp, ...afterAction(s, memberId)] }
}

function withState(session: PartySession, s: PokerState, extra: Partial<PartySession> = {}): PartySession {
  return { ...session, ...extra, roundData: s }
}

function sessionPhase(s: PokerState): string {
  if (s.phase === 'mode-selection') {
    return s.modeChosen.length >= s.seats.length ? 'mode-selection-ready' : 'mode-selection'
  }
  return s.phase === 'betting' ? 'betting' : 'showdown'
}

/** Démarre une main et renvoie la session correspondante (ou la fin de partie). */
function dealNext(session: PartySession, state: PokerState): { session: PartySession; xpAwards?: XpAward[] } {
  const s = clone(state)
  const { ended, xp } = startHand(s)
  if (ended) return { session: withState(session, s, { status: 'ended', phase: 'ended' }) }
  // `startHand` a pu retourner tout le tableau (blindes à tapis) : la main peut être déjà finie.
  const over = !!s.gameWinner
  return {
    session: withState(session, s, { status: over ? 'ended' : 'playing', phase: over ? 'ended' : sessionPhase(s), round: s.handNumber }),
    xpAwards: xp,
  }
}

export const poker: GameModule = {
  id: 'poker',
  name: 'Poker Texas Hold\'em',
  icon: '🃏',
  minPlayers: 2,

  initRound(_group, session, config) {
    const state = getState(session)
    if (session.round === 0 || !state) {
      const cfg = (config ?? {}) as PokerConfig
      const startingChips = Math.max(100, Math.floor(cfg.startingChips ?? DEFAULT_STARTING_CHIPS))
      const bigBlind = Math.max(2, Math.floor(cfg.bigBlind ?? DEFAULT_BIG_BLIND))
      const s: PokerState = {
        phase: 'mode-selection',
        seats: [...session.participantIds],
        chips: Object.fromEntries(session.participantIds.map((id) => [id, startingChips])),
        startingChips,
        smallBlind: Math.max(1, Math.floor(cfg.smallBlind ?? Math.min(DEFAULT_SMALL_BLIND, bigBlind / 2))),
        bigBlind,
        assisted: {},
        modeChosen: [],
        handNumber: 0,
        dealer: null,
        deck: [],
        hands: {},
        board: [],
        street: 'preflop',
        inHand: [],
        folded: [],
        allIn: [],
        streetBets: {},
        committed: {},
        toAct: null,
        acted: [],
        lastRaiseSize: bigBlind,
        lastAction: null,
        winners: [],
        revealed: {},
        gameWinner: null,
      }
      return { session: withState(session, s, { status: 'playing', phase: sessionPhase(s), round: 1 }) }
    }
    // Appel de l'hôte après une main : on distribue la suivante (ou on constate la fin).
    if (state.phase === 'ended') {
      if (state.gameWinner) return { session: { ...session, status: 'ended', phase: 'ended' } }
      return dealNext(session, state)
    }
    return { session }
  },

  handleAction(_group, session, memberId, action) {
    const state = getState(session)
    if (!state || !state.seats.includes(memberId)) return { session }

    // Le mode (assisté ou non) se choisit au départ, et peut se changer à tout moment.
    if (action.type === 'choose-mode') {
      const s = clone(state)
      s.assisted[memberId] = !!(action.payload as { assisted?: boolean } | null)?.assisted
      if (!s.modeChosen.includes(memberId)) s.modeChosen.push(memberId)
      return { session: withState(session, s, s.phase === 'mode-selection' ? { phase: sessionPhase(s) } : {}) }
    }

    if (action.type === 'start') {
      // Réservé à l'hôte ; ceux qui n'ont pas choisi jouent en mode normal.
      if (state.phase !== 'mode-selection' || memberId !== session.hostMemberId) return { session }
      return dealNext(session, state)
    }

    if (state.phase !== 'betting' || state.toAct !== memberId) return { session }
    const s = clone(state)
    const { ok, xp } = applyBet(s, memberId, action.type, action.payload)
    if (!ok) return { session }
    return {
      session: withState(session, s, { phase: sessionPhase(s), ...(s.gameWinner ? { status: 'ended' as const, phase: 'ended' } : {}) }),
      xpAwards: xp,
    }
  },

  // Les fins de main sont traitées au moment de l'action qui les déclenche : rien à résoudre
  // « après coup ». (Avant, cette résolution tardive redistribuait l'XP à chaque action reçue.)
  isRoundComplete() {
    return false
  },

  isAwaitingInput(_group, session) {
    const s = getState(session)
    return s?.phase === 'mode-selection' || s?.phase === 'betting'
  },

  /** Hôte : lancer malgré les indécis, ou faire jouer un joueur absent (parole si possible, sinon il se couche). */
  resolveRound(_group, session) {
    const state = getState(session)
    if (!state) return { session }
    if (state.phase === 'mode-selection') return dealNext(session, state)
    if (state.phase !== 'betting' || !state.toAct) return { session }
    const s = clone(state)
    const who = s.toAct!
    const canCheck = (s.streetBets[who] ?? 0) >= maxBet(s)
    const { xp } = applyBet(s, who, canCheck ? 'check' : 'fold', null)
    return {
      session: withState(session, s, { phase: sessionPhase(s), ...(s.gameWinner ? { status: 'ended' as const, phase: 'ended' } : {}) }),
      xpAwards: xp,
    }
  },

  viewFor(group, session, memberId) {
    const s = getState(session)
    if (!s) return null
    const me = memberId && s.seats.includes(memberId) ? memberId : null
    const dealtIn = !!me && s.inHand.includes(me)
    const yourCards = dealtIn ? s.hands[me!] ?? [] : []
    const top = s.phase === 'betting' ? maxBet(s) : 0
    const yourBet = me ? s.streetBets[me] ?? 0 : 0
    const yourChips = me ? s.chips[me] ?? 0 : 0
    const toCall = Math.max(0, top - yourBet)
    const assisted = !!me && !!s.assisted[me]
    const member = (id: string | null) => group.members.find((m) => m.id === id)
    const cur = member(s.toAct)
    const isYourTurn = s.phase === 'betting' && !!me && s.toAct === me
    const inPlay = s.phase === 'betting' && dealtIn && !s.folded.includes(me!)
    const pot = s.phase === 'betting' ? potTotal(s) : s.winners.reduce((a, w) => a + w.amount, 0)
    const last = s.lastAction
    const top1 = s.winners[0]

    return {
      yourCards,
      communityCards: s.board,
      pot,
      currentBet: top,
      yourChips,
      yourBet,
      toCall: Math.min(toCall, yourChips),
      currentPlayer: cur ? { memberId: cur.id, pseudo: cur.pseudo, color: cur.color } : null,
      phase: s.phase === 'mode-selection' ? 'dealing' : s.phase,
      bettingRound: s.street,
      foldedPlayers: s.folded,
      allInPlayers: s.allIn,
      seats: s.seats,
      busted: s.handNumber > 0 ? s.seats.filter((id) => s.chips[id] <= 0 && !s.inHand.includes(id)) : [],
      sittingOut: !!me && s.handNumber > 0 && !dealtIn,
      dealer: s.dealer,
      handNumber: s.handNumber,
      handCounts: Object.fromEntries(s.seats.map((id) => [id, s.chips[id] ?? 0])),
      bets: s.phase === 'betting' ? Object.fromEntries(s.inHand.map((id) => [id, s.streetBets[id] ?? 0])) : {},
      winner: top1 ? { memberId: top1.memberId, handDescription: top1.handDescription } : null,
      winners: s.winners,
      revealedHands: s.revealed,
      gameWinner: s.gameWinner,
      assistedMode: assisted,
      handStrength: assisted && inPlay && yourCards.length === 2 ? computeHandStrength(yourCards, s.board) : null,
      suggestion: assisted && isYourTurn ? computeSuggestion(yourCards, s.board, toCall, yourChips, potTotal(s)) : null,
      potOdds: assisted && isYourTurn ? computePotOdds(toCall, potTotal(s)) : null,
      outs: assisted && inPlay && s.board.length >= 3 && s.board.length < 5 ? computeOuts(yourCards, s.board) : null,
      isYourTurn,
      canCheck: isYourTurn && toCall === 0,
      // Relance minimale, plafonnée au tapis : au-delà, la seule relance possible est le tapis.
      minRaise: Math.min(top + s.lastRaiseSize, yourBet + yourChips),
      canRaise: isYourTurn && yourChips > toCall,
      lastAction: last ? { playerId: last.playerId, playerName: member(last.playerId)?.pseudo ?? '?', action: last.action, amount: last.amount } : null,
      modesChosen: s.modeChosen.length >= s.seats.length,
      playersWhoChoseMode: s.modeChosen,
    }
  },
}

export { computeHandStrength, computeOuts }
export type { PokerState, HandEval }
