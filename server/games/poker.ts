import type { Group, PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import type {
  PokerCard,
  PokerClientState,
  PokerConfig,
  BettingRound,
  PokerPhase,
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
const HAND_XP = 5
const WIN_XP = 15
const FOLD_XP = 1

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
// Server-side round state (secret)
// ---------------------------------------------------------------------------

interface PokerRoundState {
  deck: PokerCard[]
  hands: Record<string, PokerCard[]>
  communityCards: PokerCard[]
  pot: number
  currentBets: Record<string, number>
  totalBets: Record<string, number>
  chips: Record<string, number>
  currentPlayer: string | null
  dealerPosition: number
  smallBlind: number
  bigBlind: number
  phase: PokerPhase
  bettingRound: BettingRound
  foldedPlayers: string[]
  allInPlayers: string[]
  assistedMode: Record<string, boolean>
  winner: string | null
  winningHand: string | null
  lastAction: { playerId: string; action: string; amount: number } | null
  modesChosen: boolean
  playersWhoChoseMode: string[]
  startingChips: number
  handNumber: number
  playersActed: string[] // players who acted this betting round
  lastRaiseAmount: number // size of the last raise (for min raise rule)
}

function getState(session: PartySession): PokerRoundState {
  return (
    (session.roundData as PokerRoundState | null) ?? {
      deck: [],
      hands: {},
      communityCards: [],
      pot: 0,
      currentBets: {},
      totalBets: {},
      chips: {},
      currentPlayer: null,
      dealerPosition: 0,
      smallBlind: DEFAULT_SMALL_BLIND,
      bigBlind: DEFAULT_BIG_BLIND,
      phase: 'dealing',
      bettingRound: 'preflop',
      foldedPlayers: [],
      allInPlayers: [],
      assistedMode: {},
      winner: null,
      winningHand: null,
      lastAction: null,
      modesChosen: false,
      playersWhoChoseMode: [],
      startingChips: DEFAULT_STARTING_CHIPS,
      handNumber: 0,
      playersActed: [],
      lastRaiseAmount: DEFAULT_BIG_BLIND,
    }
  )
}

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

/**
 * Get the active (non-folded, non-all-in) players in order starting from a given offset.
 */
function getActivePlayers(state: PokerRoundState, memberIds: string[]): string[] {
  return memberIds.filter(
    (id) => !state.foldedPlayers.includes(id) && !state.allInPlayers.includes(id),
  )
}

/**
 * Get all non-folded players (including all-in).
 */
function getNonFoldedPlayers(state: PokerRoundState, memberIds: string[]): string[] {
  return memberIds.filter((id) => !state.foldedPlayers.includes(id))
}

/**
 * Check if betting round is complete.
 * A betting round is complete when:
 * - All active players have acted
 * - All active players have the same bet (or are all-in)
 */
function isBettingRoundComplete(state: PokerRoundState, memberIds: string[]): boolean {
  const active = getActivePlayers(state, memberIds)
  if (active.length <= 1) return true

  // All active players must have acted
  const allActed = active.every((id) => state.playersActed.includes(id))
  if (!allActed) return false

  // All active players must have the same bet
  const bets = active.map((id) => state.currentBets[id] ?? 0)
  const maxBet = Math.max(...bets, 0)
  return bets.every((b) => b === maxBet)
}

/**
 * Find the next player to act.
 */
function findNextPlayer(state: PokerRoundState, memberIds: string[], afterPlayerId: string | null): string | null {
  const active = getActivePlayers(state, memberIds)
  if (active.length === 0) return null

  if (afterPlayerId === null) {
    return active[0]
  }

  const idx = memberIds.indexOf(afterPlayerId)
  if (idx === -1) return active[0]

  // Search forward from the next position
  for (let i = 1; i <= memberIds.length; i++) {
    const nextId = memberIds[(idx + i) % memberIds.length]
    if (active.includes(nextId)) {
      return nextId
    }
  }
  return null
}

/**
 * Move to the next betting round or showdown.
 */
function advanceBettingRound(state: PokerRoundState, memberIds: string[]): PokerRoundState {
  // Reset bets for the new round
  const newCurrentBets: Record<string, number> = {}
  for (const id of memberIds) {
    newCurrentBets[id] = 0
  }

  // Collect bets into pot
  let newPot = state.pot
  for (const id of memberIds) {
    newPot += state.currentBets[id] ?? 0
  }


  const active = getActivePlayers(state, memberIds)

  // If only 1 or 0 active players, go to showdown
  if (active.length <= 1) {
    return {
      ...state,
      pot: newPot,
      currentBets: newCurrentBets,
      playersActed: [],
      phase: 'showdown',
    }
  }

  // Determine next betting round
  const roundOrder: BettingRound[] = ['preflop', 'flop', 'turn', 'river']
  const currentIdx = roundOrder.indexOf(state.bettingRound)

  if (currentIdx >= roundOrder.length - 1) {
    // After river → showdown
    return {
      ...state,
      pot: newPot,
      currentBets: newCurrentBets,
      playersActed: [],
      phase: 'showdown',
    }
  }

  const nextRound = roundOrder[currentIdx + 1]

  // Deal community cards
  let newCommunity = [...state.communityCards]
  let deck = [...state.deck]

  if (nextRound === 'flop' && newCommunity.length < 3) {
    // Burn 1, deal 3
    deck.shift()
    newCommunity = [...newCommunity, deck[0], deck[1], deck[2]]
    deck = deck.slice(3)
  } else if (nextRound === 'turn' && newCommunity.length < 4) {
    deck.shift()
    newCommunity = [...newCommunity, deck[0]]
    deck = deck.slice(1)
  } else if (nextRound === 'river' && newCommunity.length < 5) {
    deck.shift()
    newCommunity = [...newCommunity, deck[0]]
    deck = deck.slice(1)
  }

  // Set first player to act (first active after dealer)
  const firstPlayer = findNextPlayer(state, memberIds, memberIds[state.dealerPosition])

  return {
    ...state,
    deck,
    communityCards: newCommunity,
    pot: newPot,
    currentBets: newCurrentBets,
    bettingRound: nextRound,
    playersActed: [],
    currentPlayer: firstPlayer,
    lastRaiseAmount: state.bigBlind,
  }
}

/**
 * Resolve the showdown — determine winner and distribute pot.
 */
function resolveShowdown(state: PokerRoundState, memberIds: string[]): PokerRoundState {
  const nonFolded = getNonFoldedPlayers(state, memberIds)

  if (nonFolded.length === 0) {
    return { ...state, phase: 'ended', winner: null, winningHand: null }
  }

  // If only one player left, they win without showdown
  if (nonFolded.length === 1) {
    const winner = nonFolded[0]
    const newChips = { ...state.chips }
    newChips[winner] = (newChips[winner] ?? 0) + state.pot
    return {
      ...state,
      phase: 'ended',
      winner,
      winningHand: 'Gagne par abandon',
      chips: newChips,
    }
  }

  // Evaluate all non-folded players' hands
    let winner: string | null = null
  let winnerEval: HandEval | null = null

  const evaluations: { playerId: string; eval: HandEval }[] = []
  for (const playerId of nonFolded) {
    const hand = state.hands[playerId] ?? []
    const allCards = [...hand, ...state.communityCards]
    const evalResult = evaluateHand(allCards)
    evaluations.push({ playerId, eval: evalResult })
  }

  // Find the best hand
  evaluations.sort((a, b) => compareHands(b.eval, a.eval))
  winner = evaluations[0].playerId
  winnerEval = evaluations[0].eval

  // Distribute pot to winner
  const newChips = { ...state.chips }
  newChips[winner] = (newChips[winner] ?? 0) + state.pot

  return {
    ...state,
    phase: 'ended',
    winner,
    winningHand: winnerEval.name,
    chips: newChips,
  }
}

/**
 * Build the client state for a specific player.
 */
function buildClientState(
  state: PokerRoundState,
  group: Group,
  memberId: string,
): PokerClientState {
  const memberIds = group.members.map((m) => m.id)
  const yourCards = state.hands[memberId] ?? []
  const yourBet = state.currentBets[memberId] ?? 0
  const yourChips = state.chips[memberId] ?? 0
  const assisted = state.assistedMode[memberId] ?? false

  // Current bet to call = max bet in the round
  const allBets = memberIds.map((id) => state.currentBets[id] ?? 0)
  const maxBet = Math.max(...allBets, 0)
  const toCall = Math.max(0, maxBet - yourBet)
  const canCheck = toCall === 0

  // Current player info
  let currentPlayer: PokerClientState['currentPlayer'] = null
  if (state.currentPlayer) {
    const m = group.members.find((mem) => mem.id === state.currentPlayer)
    if (m) {
      currentPlayer = { memberId: m.id, pseudo: m.pseudo, color: m.color }
    }
  }

  // Winner info
  let winner: PokerClientState['winner'] = null
  if (state.winner) {
    winner = { memberId: state.winner, handDescription: state.winningHand ?? '' }
  }

  // Last action info
  let lastAction: PokerClientState['lastAction'] = null
  if (state.lastAction) {
    const m = group.members.find((mem) => mem.id === state.lastAction?.playerId)
    lastAction = {
      playerId: state.lastAction?.playerId,
      playerName: m?.pseudo ?? '?',
      action: state.lastAction?.action,
      amount: state.lastAction?.amount,
    }
  }

  // Hand counts (chips per player)
  const handCounts: Record<string, number> = {}
  for (const id of memberIds) {
    handCounts[id] = state.chips[id] ?? 0
  }

  const isYourTurn = state.currentPlayer === memberId && !state.foldedPlayers.includes(memberId) && !state.allInPlayers.includes(memberId)
  const minRaise = state.lastRaiseAmount + maxBet

  // Assisted mode data
  let handStrength: HandStrength | null = null
  let suggestion: ActionSuggestion | null = null
  let potOdds: PotOdds | null = null
  let outs: PokerOuts | null = null

  if (assisted && yourCards.length === 2 && state.phase !== 'ended') {
    handStrength = computeHandStrength(yourCards, state.communityCards)
    suggestion = computeSuggestion(yourCards, state.communityCards, toCall, yourChips, state.pot)
    potOdds = computePotOdds(toCall, state.pot)
    outs = computeOuts(yourCards, state.communityCards)
  }

  return {
    yourCards,
    communityCards: state.communityCards,
    pot: state.pot,
    currentBet: maxBet,
    yourChips,
    yourBet,
    currentPlayer,
    phase: state.phase,
    bettingRound: state.bettingRound,
    foldedPlayers: state.foldedPlayers,
    handCounts,
    winner,
    assistedMode: assisted,
    handStrength,
    suggestion,
    potOdds,
    outs,
    isYourTurn,
    canCheck,
    minRaise,
    lastAction,
    modesChosen: state.modesChosen,
    playersWhoChoseMode: state.playersWhoChoseMode,
  }
}

/**
 * Start a new hand: shuffle deck, deal cards, post blinds.
 */
function startNewHand(state: PokerRoundState, group: Group): PokerRoundState {
  const memberIds = group.members.map((m) => m.id)
  const config: PokerConfig = {
    startingChips: state.startingChips,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
  }

  const deck = shuffle(createDeck())
  const hands: Record<string, PokerCard[]> = {}
  const chips = { ...state.chips }

  // Ensure all players have chips
  for (const id of memberIds) {
    if (chips[id] === undefined || chips[id] <= 0) {
      chips[id] = config.startingChips ?? DEFAULT_STARTING_CHIPS
    }
  }

  // Deal 2 cards to each player
  for (const id of memberIds) {
    hands[id] = [deck.shift()!, deck.shift()!]
  }

  // Post blinds — dealer position rotates
  const dealerPos = state.handNumber === 0 ? 0 : (state.dealerPosition + 1) % memberIds.length
  const sbPos = (dealerPos + 1) % memberIds.length
  const bbPos = (dealerPos + 2) % memberIds.length
  const sbId = memberIds[sbPos]
  const bbId = memberIds[bbPos]

  const currentBets: Record<string, number> = {}
  const totalBets: Record<string, number> = {}
  for (const id of memberIds) {
    currentBets[id] = 0
    totalBets[id] = 0
  }

  // Small blind
  const sbAmount = Math.min(config.smallBlind ?? DEFAULT_SMALL_BLIND, chips[sbId])
  currentBets[sbId] = sbAmount
  totalBets[sbId] = sbAmount
  chips[sbId] -= sbAmount

  // Big blind
  const bbAmount = Math.min(config.bigBlind ?? DEFAULT_BIG_BLIND, chips[bbId])
  currentBets[bbId] = bbAmount
  totalBets[bbId] = bbAmount
  chips[bbId] -= bbAmount

  // First to act pre-flop is left of big blind (UTG)
  const utgPos = (bbPos + 1) % memberIds.length
  const firstToAct = memberIds[utgPos]

  return {
    ...state,
    deck,
    hands,
    chips,
    communityCards: [],
    pot: 0,
    currentBets,
    totalBets,
    dealerPosition: dealerPos,
    currentPlayer: firstToAct,
    phase: 'betting',
    bettingRound: 'preflop',
    foldedPlayers: [],
    allInPlayers: [],
    winner: null,
    winningHand: null,
    lastAction: null,
    playersActed: [],
    lastRaiseAmount: config.bigBlind ?? DEFAULT_BIG_BLIND,
    handNumber: state.handNumber + 1,
  }
}

// ---------------------------------------------------------------------------
// GameModule implementation
// ---------------------------------------------------------------------------

export const poker: GameModule = {
  id: 'poker',
  name: 'Poker Texas Hold\'em',
  icon: '🃏',
  minPlayers: 2,

  initRound(group, session, config) {
    const state = getState(session)
    const isFirstRound = session.round === 0
    const cfg = config as PokerConfig | undefined

    // First round: initialize chips and wait for mode selection
    if (isFirstRound && state.handNumber === 0) {
      const memberIds = group.members.map((m) => m.id)
      const chips: Record<string, number> = {}
      for (const id of memberIds) {
        chips[id] = cfg?.startingChips ?? DEFAULT_STARTING_CHIPS
      }

      const initState: PokerRoundState = {
        ...state,
        chips,
        startingChips: cfg?.startingChips ?? DEFAULT_STARTING_CHIPS,
        smallBlind: cfg?.smallBlind ?? DEFAULT_SMALL_BLIND,
        bigBlind: cfg?.bigBlind ?? DEFAULT_BIG_BLIND,
        phase: 'dealing',
        modesChosen: false,
        playersWhoChoseMode: [],
        handNumber: 0,
      }

      return {
        session: {
          ...session,
          status: 'playing',
          phase: 'mode-selection',
          round: 1,
          roundData: initState,
        },
      }
    }

    // Check if game should end (only 1 player with chips)
    const memberIds = group.members.map((m) => m.id)
    const playersWithChips = memberIds.filter((id) => (state.chips[id] ?? 0) > 0)
    if (playersWithChips.length <= 1 && state.handNumber > 0) {
      return {
        session: { ...session, status: 'ended', phase: 'ended', roundData: state },
      }
    }

    // Start a new hand
    const newState = startNewHand(state, group)
    return {
      session: {
        ...session,
        status: 'playing',
        phase: 'betting',
        round: session.round + 1,
        roundData: newState,
      },
    }
  },

  handleAction(group, session, memberId, action) {
    const state = getState(session)
    const memberIds = group.members.map((m) => m.id)
    const act = action as { type: string; payload: unknown }

    // Action: choose mode (assisted or normal)
    if (act.type === 'choose-mode') {
      if (state.playersWhoChoseMode.includes(memberId)) return { session }

      const assisted = (act.payload as { assisted: boolean }).assisted
      const newAssisted = { ...state.assistedMode, [memberId]: assisted }
      const newPlayersWhoChose = [...state.playersWhoChoseMode, memberId]
      const allChosen = newPlayersWhoChose.length >= memberIds.length

      const nextState: PokerRoundState = {
        ...state,
        assistedMode: newAssisted,
        playersWhoChoseMode: newPlayersWhoChose,
        modesChosen: allChosen,
      }

      return {
        session: { ...session, phase: allChosen ? 'mode-selection-ready' : 'mode-selection', roundData: nextState },
      }
    }

    // Action: start (host starts the first hand after mode selection)
    if (act.type === 'start') {
      if (!state.modesChosen) return { session }

      const newState = startNewHand(state, group)
      return {
        session: {
          ...session,
          status: 'playing',
          phase: 'betting',
          roundData: newState,
        },
      }
    }

    // Betting actions — only valid in betting phase
    if (state.phase !== 'betting') return { session }
    if (state.currentPlayer !== memberId) return { session }
    if (state.foldedPlayers.includes(memberId) || state.allInPlayers.includes(memberId)) return { session }

    const yourBet = state.currentBets[memberId] ?? 0
    const allBets = memberIds.map((id) => state.currentBets[id] ?? 0)
    const maxBet = Math.max(...allBets, 0)
    const toCall = maxBet - yourBet
    const yourChips = state.chips[memberId] ?? 0

    // Action: check
    if (act.type === 'check') {
      if (toCall > 0) return { session } // can't check if there's a bet to call

      const nextState: PokerRoundState = {
        ...state,
        playersActed: [...state.playersActed, memberId],
        lastAction: { playerId: memberId, action: 'check', amount: 0 },
      }

      // Check if betting round is complete
      if (isBettingRoundComplete(nextState, memberIds)) {
        const afterAdvance = advanceBettingRound(nextState, memberIds)
        return { session: { ...session, roundData: afterAdvance } }
      }

      // Next player
      const nextPlayer = findNextPlayer(nextState, memberIds, memberId)
      return { session: { ...session, roundData: { ...nextState, currentPlayer: nextPlayer } } }
    }

    // Action: call
    if (act.type === 'call') {
      const callAmount = Math.min(toCall, yourChips)
      const newBet = yourBet + callAmount
      const newChips = yourChips - callAmount

      const newCurrentBets = { ...state.currentBets, [memberId]: newBet }
      const newTotalBets = { ...state.totalBets, [memberId]: (state.totalBets[memberId] ?? 0) + callAmount }
      const newChipsMap = { ...state.chips, [memberId]: newChips }

      const allIn = newChips === 0
      const newAllIn = allIn ? [...state.allInPlayers, memberId] : state.allInPlayers

      const nextState: PokerRoundState = {
        ...state,
        currentBets: newCurrentBets,
        totalBets: newTotalBets,
        chips: newChipsMap,
        allInPlayers: newAllIn,
        playersActed: [...state.playersActed, memberId],
        lastAction: { playerId: memberId, action: 'call', amount: callAmount },
      }

      if (isBettingRoundComplete(nextState, memberIds)) {
        const afterAdvance = advanceBettingRound(nextState, memberIds)
        return { session: { ...session, roundData: afterAdvance } }
      }

      const nextPlayer = findNextPlayer(nextState, memberIds, memberId)
      return { session: { ...session, roundData: { ...nextState, currentPlayer: nextPlayer } } }
    }

    // Action: raise
    if (act.type === 'raise') {
      const payload = act.payload as { amount: number }
      const raiseTo = payload.amount // total bet to raise to
      const raiseDelta = raiseTo - yourBet
      const minRaiseTo = maxBet + state.lastRaiseAmount

      if (raiseDelta <= 0 || raiseTo < minRaiseTo) return { session }
      if (raiseDelta > yourChips) return { session }

      const newChips = yourChips - raiseDelta
      const newCurrentBets = { ...state.currentBets, [memberId]: raiseTo }
      const newTotalBets = { ...state.totalBets, [memberId]: (state.totalBets[memberId] ?? 0) + raiseDelta }
      const newChipsMap = { ...state.chips, [memberId]: newChips }

      const allIn = newChips === 0
      const newAllIn = allIn ? [...state.allInPlayers, memberId] : state.allInPlayers

      // When someone raises, other players need to act again
      const _newPlayersActed = [memberId]

      const nextState: PokerRoundState = {
        ...state,
        currentBets: newCurrentBets,
        totalBets: newTotalBets,
        chips: newChipsMap,
        allInPlayers: newAllIn,
        playersActed: _newPlayersActed,
        lastRaiseAmount: raiseTo - maxBet,
        lastAction: { playerId: memberId, action: 'raise', amount: raiseTo },
      }

      if (isBettingRoundComplete(nextState, memberIds)) {
        const afterAdvance = advanceBettingRound(nextState, memberIds)
        return { session: { ...session, roundData: afterAdvance } }
      }

      const nextPlayer = findNextPlayer(nextState, memberIds, memberId)
      return { session: { ...session, roundData: { ...nextState, currentPlayer: nextPlayer } } }
    }

    // Action: fold
    if (act.type === 'fold') {
      const newFolded = [...state.foldedPlayers, memberId]
      const nextState: PokerRoundState = {
        ...state,
        foldedPlayers: newFolded,
        playersActed: [...state.playersActed, memberId],
        lastAction: { playerId: memberId, action: 'fold', amount: 0 },
      }

      // Check if only one player remains
      const nonFolded = getNonFoldedPlayers(nextState, memberIds)
      if (nonFolded.length <= 1) {
        const resolved = resolveShowdown(nextState, memberIds)
        return {
          session: { ...session, phase: 'showdown', roundData: resolved },
          xpAwards: [
            { memberId, amount: FOLD_XP, statIncrements: { 'poker.folds': 1 }, reason: 'S\'est couché' },
          ],
        }
      }

      if (isBettingRoundComplete(nextState, memberIds)) {
        const afterAdvance = advanceBettingRound(nextState, memberIds)
        return {
          session: { ...session, roundData: afterAdvance },
          xpAwards: [
            { memberId, amount: FOLD_XP, statIncrements: { 'poker.folds': 1 }, reason: 'S\'est couché' },
          ],
        }
      }

      const nextPlayer = findNextPlayer(nextState, memberIds, memberId)
      return {
        session: { ...session, roundData: { ...nextState, currentPlayer: nextPlayer } },
        xpAwards: [
          { memberId, amount: FOLD_XP, statIncrements: { 'poker.folds': 1 }, reason: 'S\'est couché' },
        ],
      }
    }

    // Action: all-in
    if (act.type === 'all-in') {
      const allInAmount = yourChips
      if (allInAmount <= 0) return { session }

      const newBet = yourBet + allInAmount
      const newCurrentBets = { ...state.currentBets, [memberId]: newBet }
      const newTotalBets = { ...state.totalBets, [memberId]: (state.totalBets[memberId] ?? 0) + allInAmount }
      const newChipsMap = { ...state.chips, [memberId]: 0 }
      const newAllIn = [...state.allInPlayers, memberId]

      // If all-in is a raise, reset playersActed
      let _newPlayersActed = [...state.playersActed, memberId]
      if (newBet > maxBet) {
        _newPlayersActed = [memberId]
      }

      const nextState: PokerRoundState = {
        ...state,
        currentBets: newCurrentBets,
        totalBets: newTotalBets,
        chips: newChipsMap,
        allInPlayers: newAllIn,
        playersActed: _newPlayersActed,
        lastAction: { playerId: memberId, action: 'all-in', amount: allInAmount },
      }

      if (newBet > maxBet) {
        nextState.lastRaiseAmount = newBet - maxBet
      }

      if (isBettingRoundComplete(nextState, memberIds)) {
        const afterAdvance = advanceBettingRound(nextState, memberIds)
        return { session: { ...session, roundData: afterAdvance } }
      }

      const nextPlayer = findNextPlayer(nextState, memberIds, memberId)
      return { session: { ...session, roundData: { ...nextState, currentPlayer: nextPlayer } } }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    return state.phase === 'ended' || state.phase === 'showdown'
  },

  isAwaitingInput(_group, session) {
    const state = getState(session)
    return state.phase === 'betting' || (session.phase === 'mode-selection' && !state.modesChosen)
  },

  resolveRound(group, session) {
    const state = getState(session)
    const memberIds = group.members.map((m) => m.id)

    // If in showdown, resolve
    if (state.phase === 'showdown') {
      const resolved = resolveShowdown(state, memberIds)
      const xpAwards: XpAward[] = []

      if (resolved.winner) {
        xpAwards.push({
          memberId: resolved.winner,
          amount: WIN_XP,
          statIncrements: { 'poker.wins': 1 },
          reason: `A gagné la main (${resolved.winningHand})`,
        })
      }

      return {
        session: { ...session, phase: 'showdown', roundData: resolved },
        xpAwards,
      }
    }

    // If ended, just return
    if (state.phase === 'ended') {
      const xpAwards: XpAward[] = []
      if (state.winner) {
        xpAwards.push({
          memberId: state.winner,
          amount: HAND_XP,
          statIncrements: { 'poker.handsPlayed': 1 },
          reason: 'Main jouée',
        })
      }
      return { session: { ...session, roundData: state }, xpAwards }
    }

    return { session }
  },
}

// ---------------------------------------------------------------------------
// Export helpers for testing / client use
// ---------------------------------------------------------------------------

export { buildClientState, computeHandStrength, computeOuts }
export type { PokerRoundState, HandEval }