import type { Group, PartySession } from '../../src/types'
import type { GameAction, GameModule, XpAward } from './types'
import {
  BAIL,
  BOARD,
  CHANCE_CARDS,
  CHEST_CARDS,
  GO_SALARY,
  GROUP_SQUARES,
  JAIL_SQUARE,
  MAX_PLAYERS,
  START_CASH,
  STATIONS,
  TOKENS,
  UTILITIES,
  isBuyable,
  type MonopolyCard,
} from '../../src/data/monopoly'
import type { MonoEvent, MonoOffer, MonoPlayer, MonoState, MonoStep } from '../../src/party/games/monopoly/types'
import { netWorth } from '../../src/party/games/monopoly/rules'

/**
 * Monopoly, règles classiques sur le plateau parisien.
 *
 * Tout est rythmé par les joueurs : le joueur courant lance, achète ou refuse (enchères ouvertes à
 * tous), lit sa carte, construit, échange, finit son tour. L'hôte peut toujours débloquer la
 * partie (« Forcer » joue l'action par défaut de l'étape en cours) ou la terminer : le plus riche
 * l'emporte. Variante de salon assumée : taxes, amendes et cautions alimentent la cagnotte du Parc
 * gratuit, que rafle le premier qui s'y arrête.
 *
 * Chaque changement visible est consigné dans `events` (avec la fortune de chacun à cet instant) :
 * la TV rejoue ces événements un par un — dés, pas du pion, loyer, carte — sans jamais dévoiler la
 * suite avant son tour.
 */

type Deck = 'chance' | 'chest'

interface Secrets {
  /** Ordre restant des paquets (index dans CHANCE_CARDS / CHEST_CARDS). */
  chance: number[]
  chest: number[]
  /** Cartes « Libéré de prison » détenues, par joueur : de quel paquet elles viennent. */
  held: Record<string, Deck[]>
}

type State = MonoState & { secrets: Secrets }

type EventInput = MonoEvent extends infer E ? (E extends unknown ? Omit<E, 'seq' | 'cash'> : never) : never

const MAX_EVENTS = 40
const WIN_XP = 30
const PLAY_XP = 5

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

const die = () => 1 + Math.floor(Math.random() * 6)
const clone = (s: State): State => JSON.parse(JSON.stringify(s)) as State
const cards = (deck: Deck): MonopolyCard[] => (deck === 'chance' ? CHANCE_CARDS : CHEST_CARDS)

function emit(s: State, ev: EventInput) {
  s.seq += 1
  const cash = Object.fromEntries(s.players.map((p) => [p.id, p.cash]))
  s.events.push({ ...ev, seq: s.seq, cash } as MonoEvent)
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS)
}

const playerOf = (s: State, id: string | null | undefined) => s.players.find((p) => p.id === id)
const current = (s: State) => s.players[s.turn]
const active = (s: State) => s.players.filter((p) => !p.bankrupt)

function ownsGroup(s: State, id: string, square: number): boolean {
  const sq = BOARD[square]
  if (sq.kind !== 'property') return false
  return GROUP_SQUARES[sq.group].every((i) => s.owners[i] === id)
}

function groupHasHouses(s: State, square: number): boolean {
  const sq = BOARD[square]
  if (sq.kind !== 'property') return false
  return GROUP_SQUARES[sq.group].some((i) => (s.houses[i] ?? 0) > 0)
}

/** Loyer dû sur `square` (0 si personne ne le touche). */
function rentFor(s: State, square: number, diceSum: number, opts: { doubleStation?: boolean; utilityTimes?: number } = {}): number {
  const sq = BOARD[square]
  const owner = s.owners[square]
  if (!owner || s.mortgaged[square]) return 0
  if (sq.kind === 'property') {
    const h = s.houses[square] ?? 0
    if (h > 0) return sq.rents[h]
    return ownsGroup(s, owner, square) ? sq.rents[0] * 2 : sq.rents[0]
  }
  if (sq.kind === 'station') {
    const n = STATIONS.filter((i) => s.owners[i] === owner).length
    return 25 * 2 ** (n - 1) * (opts.doubleStation ? 2 : 1)
  }
  if (sq.kind === 'utility') {
    const n = UTILITIES.filter((i) => s.owners[i] === owner).length
    return diceSum * (opts.utilityTimes ?? (n >= 2 ? 10 : 4))
  }
  return 0
}

/** Étape qui suit la résolution d'une case : on rejoue après un double, sinon fin de tour. */
function settled(s: State) {
  const p = current(s)
  s.step = s.again && !p.inJail && !p.bankrupt ? 'roll' : 'done'
}

/** Paiement. Sans assez de liquide, le joueur passe en dette : il vend, hypothèque ou fait faillite. */
function charge(s: State, payer: MonoPlayer, amount: number, to: { id: string; amount: number }[], resume: MonoStep): boolean {
  if (amount <= 0) return true
  if (payer.cash >= amount) {
    payer.cash -= amount
    if (to.length === 0) s.pot += amount
    for (const c of to) {
      const creditor = playerOf(s, c.id)
      if (creditor) creditor.cash += c.amount
    }
    return true
  }
  s.debt = { memberId: payer.id, amount, to, resume }
  s.step = 'debt'
  return false
}

function sendToJail(s: State, p: MonoPlayer) {
  emit(s, { type: 'move', who: p.id, from: p.pos, to: JAIL_SQUARE, mode: 'jump' })
  p.pos = JAIL_SQUARE
  p.inJail = true
  p.jailTurns = 0
  s.again = false
  s.doubles = 0
  emit(s, { type: 'jail', who: p.id })
  s.step = 'done'
}

interface LandOptions {
  doubleStation?: boolean
  /** Carte « compagnie la plus proche » : on relance et on paie dix fois. */
  utilityTen?: boolean
}

function land(s: State, p: MonoPlayer, opts: LandOptions = {}) {
  const sq = BOARD[p.pos]
  if (isBuyable(sq)) {
    const owner = s.owners[p.pos]
    if (!owner) {
      s.step = 'buy'
      return
    }
    if (owner === p.id) return settled(s)
    let sum = (s.dice?.[0] ?? 0) + (s.dice?.[1] ?? 0)
    if (opts.utilityTen) {
      const d: [number, number] = [die(), die()]
      emit(s, { type: 'roll', who: p.id, dice: d, seed: Math.floor(Math.random() * 2 ** 31) })
      sum = d[0] + d[1]
    }
    const rent = rentFor(s, p.pos, sum, { doubleStation: opts.doubleStation, utilityTimes: opts.utilityTen ? 10 : undefined })
    if (rent <= 0) return settled(s)
    const next: MonoStep = s.again && !p.inJail ? 'roll' : 'done'
    if (charge(s, p, rent, [{ id: owner, amount: rent }], next)) {
      emit(s, { type: 'rent', who: p.id, to: owner, square: p.pos, amount: rent })
      settled(s)
    }
    return
  }
  switch (sq.kind) {
    case 'tax': {
      const next: MonoStep = s.again ? 'roll' : 'done'
      if (charge(s, p, sq.amount, [], next)) {
        emit(s, { type: 'tax', who: p.id, square: p.pos, amount: sq.amount })
        settled(s)
      }
      return
    }
    case 'chance':
    case 'chest':
      return drawCard(s, p, sq.kind)
    case 'gotojail':
      return sendToJail(s, p)
    case 'parking':
      if (s.pot > 0) {
        const amount = s.pot
        p.cash += amount
        s.pot = 0
        emit(s, { type: 'pot', who: p.id, amount })
      }
      return settled(s)
    default:
      return settled(s)
  }
}

/** Avance (ou recule) d'un nombre de cases, en touchant le salaire au passage de la case Départ. */
function moveBy(s: State, p: MonoPlayer, steps: number, opts: LandOptions = {}) {
  const from = p.pos
  const to = (((from + steps) % 40) + 40) % 40
  emit(s, { type: 'move', who: p.id, from, to, mode: steps < 0 ? 'back' : 'walk' })
  p.pos = to
  if (steps > 0 && from + steps >= 40) {
    p.cash += GO_SALARY
    emit(s, { type: 'go', who: p.id, amount: GO_SALARY })
  }
  land(s, p, opts)
}

function moveTo(s: State, p: MonoPlayer, to: number, opts: LandOptions = {}) {
  moveBy(s, p, (to - p.pos + 40) % 40 || 40, opts)
}

function drawCard(s: State, p: MonoPlayer, deck: Deck) {
  const queue = s.secrets[deck]
  const index = queue.shift()
  if (index === undefined) return settled(s)
  const card = cards(deck)[index]
  // Une carte « Libéré de prison » reste chez le joueur ; les autres repartent sous le paquet.
  if (card.effect.type === 'jailFree') {
    p.jailCards += 1
    ;(s.secrets.held[p.id] ??= []).push(deck)
  } else queue.push(index)
  s.card = { deck, index, text: card.text }
  s.step = 'card'
  emit(s, { type: 'card', who: p.id, deck, text: card.text })
}

/** Le joueur a lu sa carte : on l'applique. */
function applyCard(s: State, p: MonoPlayer) {
  const c = s.card
  if (!c) return settled(s)
  s.card = null
  const effect = cards(c.deck)[c.index].effect
  const next: MonoStep = s.again ? 'roll' : 'done'
  switch (effect.type) {
    case 'move':
      return moveTo(s, p, effect.to)
    case 'back':
      return moveBy(s, p, -effect.steps)
    case 'nearest': {
      const targets = effect.kind === 'station' ? STATIONS : UTILITIES
      const to = targets.find((i) => i > p.pos) ?? targets[0]
      return moveTo(s, p, to, effect.kind === 'station' ? { doubleStation: true } : { utilityTen: true })
    }
    case 'money':
      if (effect.amount >= 0) {
        p.cash += effect.amount
        emit(s, { type: 'money', who: p.id, amount: effect.amount, reason: 'Carte' })
      } else if (charge(s, p, -effect.amount, [], next)) {
        emit(s, { type: 'money', who: p.id, amount: effect.amount, reason: 'Carte' })
      } else return
      return settled(s)
    case 'jail':
      return sendToJail(s, p)
    case 'jailFree':
      return settled(s)
    case 'repairs': {
      let total = 0
      for (const [k, owner] of Object.entries(s.owners)) {
        if (owner !== p.id) continue
        const h = s.houses[Number(k)] ?? 0
        total += h === 5 ? effect.hotel : h * effect.house
      }
      if (total === 0 || charge(s, p, total, [], next)) {
        if (total > 0) emit(s, { type: 'money', who: p.id, amount: -total, reason: 'Réparations' })
        settled(s)
      }
      return
    }
    case 'payEach': {
      const others = active(s).filter((o) => o.id !== p.id)
      const to = others.map((o) => ({ id: o.id, amount: effect.amount }))
      if (charge(s, p, effect.amount * others.length, to, next)) {
        emit(s, { type: 'money', who: p.id, amount: -effect.amount * others.length, reason: 'Chaque joueur' })
        settled(s)
      }
      return
    }
    case 'collectEach': {
      let total = 0
      for (const o of active(s)) {
        if (o.id === p.id) continue
        // Personne ne s'endette pour un anniversaire : chacun donne ce qu'il peut.
        const give = Math.min(o.cash, effect.amount)
        o.cash -= give
        total += give
      }
      p.cash += total
      emit(s, { type: 'money', who: p.id, amount: total, reason: 'Anniversaire' })
      return settled(s)
    }
  }
}

function nextTurn(s: State, group: Group) {
  s.again = false
  s.doubles = 0
  s.dice = null
  s.card = null
  const n = s.players.length
  for (let k = 1; k <= n; k++) {
    const i = (s.turn + k) % n
    const p = s.players[i]
    // Un joueur parti du groupe ne bloque pas la table : son tour est sauté.
    if (p.bankrupt || !group.members.some((m) => m.id === p.id)) continue
    s.turn = i
    s.step = p.inJail ? 'jail' : 'roll'
    return
  }
  s.step = 'done'
}

function roll(s: State, p: MonoPlayer) {
  const d: [number, number] = [die(), die()]
  s.dice = d
  emit(s, { type: 'roll', who: p.id, dice: d, seed: Math.floor(Math.random() * 2 ** 31) })
  const isDouble = d[0] === d[1]
  if (s.step === 'jail') {
    if (isDouble) {
      p.inJail = false
      p.jailTurns = 0
      emit(s, { type: 'free', who: p.id, how: 'doubles' })
      s.again = false
      return moveBy(s, p, d[0] + d[1])
    }
    p.jailTurns += 1
    if (p.jailTurns < 3) {
      s.step = 'done'
      return
    }
    // Troisième échec : caution obligatoire, puis on avance.
    p.inJail = false
    p.jailTurns = 0
    if (!charge(s, p, BAIL, [], 'done')) return
    emit(s, { type: 'free', who: p.id, how: 'forced' })
    return moveBy(s, p, d[0] + d[1])
  }
  if (isDouble) {
    s.doubles += 1
    if (s.doubles >= 3) return sendToJail(s, p)
  }
  s.again = isDouble
  moveBy(s, p, d[0] + d[1])
}

// ─── Enchères ───────────────────────────────────────────────────────────────

function closeAuction(s: State) {
  const a = s.auction
  if (!a) return
  s.auction = null
  const winner = a.high ? playerOf(s, a.high.id) : undefined
  if (winner && a.high && winner.cash >= a.high.amount) {
    winner.cash -= a.high.amount
    s.owners[a.square] = winner.id
    emit(s, { type: 'won', who: winner.id, square: a.square, amount: a.high.amount })
  } else emit(s, { type: 'won', who: null, square: a.square, amount: 0 })
  settled(s)
}

function checkAuction(s: State) {
  const a = s.auction
  if (!a) return
  const still = active(s).filter((p) => !a.passed.includes(p.id))
  if (a.high ? still.every((p) => p.id === a.high!.id) : still.length === 0) closeAuction(s)
}

// ─── Gestion : maisons, hypothèques ────────────────────────────────────────

function build(s: State, p: MonoPlayer, square: number): boolean {
  const sq = BOARD[square]
  if (sq?.kind !== 'property' || s.owners[square] !== p.id || !ownsGroup(s, p.id, square)) return false
  const group = GROUP_SQUARES[sq.group]
  if (group.some((i) => s.mortgaged[i])) return false
  const h = s.houses[square] ?? 0
  // Construction équilibrée : jamais plus d'une maison d'écart dans un groupe.
  if (h >= 5 || h > Math.min(...group.map((i) => s.houses[i] ?? 0)) || p.cash < sq.houseCost) return false
  p.cash -= sq.houseCost
  s.houses[square] = h + 1
  emit(s, { type: 'build', who: p.id, square, houses: h + 1 })
  return true
}

function sell(s: State, p: MonoPlayer, square: number): boolean {
  const sq = BOARD[square]
  if (sq?.kind !== 'property' || s.owners[square] !== p.id) return false
  const h = s.houses[square] ?? 0
  if (h <= 0 || h < Math.max(...GROUP_SQUARES[sq.group].map((i) => s.houses[i] ?? 0))) return false
  p.cash += sq.houseCost / 2
  s.houses[square] = h - 1
  emit(s, { type: 'sell', who: p.id, square, houses: h - 1 })
  return true
}

function mortgage(s: State, p: MonoPlayer, square: number, on: boolean): boolean {
  const sq = BOARD[square]
  if (!sq || !isBuyable(sq) || s.owners[square] !== p.id || !!s.mortgaged[square] === on) return false
  if (on) {
    if (groupHasHouses(s, square)) return false
    p.cash += sq.price / 2
    s.mortgaged[square] = true
  } else {
    const cost = Math.ceil((sq.price / 2) * 1.1)
    if (p.cash < cost) return false
    p.cash -= cost
    delete s.mortgaged[square]
  }
  emit(s, { type: 'mortgage', who: p.id, square, on })
  return true
}

// ─── Échanges ───────────────────────────────────────────────────────────────

function cleanOffer(raw: unknown): MonoOffer {
  const o = (raw ?? {}) as Partial<MonoOffer>
  const cash = Number.isFinite(o.cash) ? Math.max(0, Math.floor(o.cash as number)) : 0
  const squares = Array.isArray(o.squares) ? [...new Set(o.squares.filter((n) => Number.isInteger(n) && n >= 0 && n < 40))] : []
  const jailCards = Number.isInteger(o.jailCards) ? Math.max(0, o.jailCards as number) : 0
  return { cash, squares, jailCards }
}

function offerValid(s: State, p: MonoPlayer, o: MonoOffer): boolean {
  return (
    p.cash >= o.cash &&
    p.jailCards >= o.jailCards &&
    o.squares.every((i) => s.owners[i] === p.id && !groupHasHouses(s, i))
  )
}

function executeTrade(s: State) {
  const t = s.trade
  if (!t) return
  const a = playerOf(s, t.from)
  const b = playerOf(s, t.to)
  s.trade = null
  if (!a || !b || a.bankrupt || b.bankrupt || !offerValid(s, a, t.give) || !offerValid(s, b, t.get)) return
  const move = (from: MonoPlayer, to: MonoPlayer, o: MonoOffer) => {
    from.cash -= o.cash
    to.cash += o.cash
    for (const i of o.squares) s.owners[i] = to.id
    for (let k = 0; k < o.jailCards; k++) {
      from.jailCards -= 1
      to.jailCards += 1
      const deck = s.secrets.held[from.id]?.pop()
      if (deck) (s.secrets.held[to.id] ??= []).push(deck)
    }
  }
  move(a, b, t.give)
  move(b, a, t.get)
  emit(s, { type: 'trade', from: a.id, to: b.id })
}

// ─── Fin de partie ──────────────────────────────────────────────────────────

function bankrupt(s: State, group: Group, p: MonoPlayer) {
  const creditorId = s.debt && s.debt.to.length === 1 ? s.debt.to[0].id : null
  const creditor = playerOf(s, creditorId)
  for (const [k, owner] of Object.entries(s.owners)) {
    if (owner !== p.id) continue
    const i = Number(k)
    const sq = BOARD[i]
    const h = s.houses[i] ?? 0
    delete s.houses[i]
    if (creditor) {
      // Les maisons repartent à la banque ; le créancier en touche la moitié du prix.
      if (sq.kind === 'property') creditor.cash += (h * sq.houseCost) / 2
      s.owners[i] = creditor.id
    } else {
      delete s.owners[i]
      delete s.mortgaged[i]
    }
  }
  if (creditor) {
    creditor.cash += p.cash
    creditor.jailCards += p.jailCards
    ;(s.secrets.held[creditor.id] ??= []).push(...(s.secrets.held[p.id] ?? []))
  } else {
    for (const deck of s.secrets.held[p.id] ?? []) s.secrets[deck].push(cards(deck).findIndex((c) => c.effect.type === 'jailFree'))
  }
  delete s.secrets.held[p.id]
  p.cash = 0
  p.jailCards = 0
  p.bankrupt = true
  p.inJail = false
  s.debt = null
  if (s.trade && (s.trade.from === p.id || s.trade.to === p.id)) s.trade = null
  if (s.auction) s.auction.passed.push(p.id)
  emit(s, { type: 'bankrupt', who: p.id, to: creditor?.id ?? null })
  if (active(s).length <= 1) return finish(s)
  if (current(s).id === p.id) nextTurn(s, group)
}

function richest(s: State): string | null {
  const ranked = active(s).sort((a, b) => netWorth(s, b.id) - netWorth(s, a.id))
  return ranked[0]?.id ?? null
}

function finish(s: State) {
  s.winner = richest(s)
  s.step = 'done'
  s.auction = null
  s.trade = null
  emit(s, { type: 'end', winner: s.winner })
}

function endedSession(session: PartySession, s: State): { session: PartySession; xpAwards: XpAward[] } {
  const xpAwards = s.players.map((p): XpAward =>
    p.id === s.winner
      ? { memberId: p.id, amount: WIN_XP, statIncrements: { 'monopoly.wins': 1, 'monopoly.games': 1 }, reason: 'A gagné au Monopoly' }
      : { memberId: p.id, amount: PLAY_XP, statIncrements: { 'monopoly.games': 1 }, reason: 'A joué au Monopoly' },
  )
  return { session: { ...session, status: 'ended', phase: 'ended', roundData: s }, xpAwards }
}

function fresh(participantIds: string[]): State {
  const ids = shuffle(participantIds).slice(0, MAX_PLAYERS)
  const s: State = {
    players: ids.map((id, i) => ({ id, token: i % TOKENS.length, cash: START_CASH, pos: 0, inJail: false, jailTurns: 0, jailCards: 0, bankrupt: false })),
    turn: 0,
    step: 'roll',
    dice: null,
    doubles: 0,
    again: false,
    owners: {},
    houses: {},
    mortgaged: {},
    pot: 0,
    card: null,
    auction: null,
    debt: null,
    trade: null,
    events: [],
    seq: 0,
    winner: null,
    secrets: {
      chance: shuffle(CHANCE_CARDS.map((_, i) => i)),
      chest: shuffle(CHEST_CARDS.map((_, i) => i)),
      held: {},
    },
  }
  emit(s, { type: 'start' })
  return s
}

const squareOf = (payload: unknown) => {
  const n = (payload as { square?: unknown } | null)?.square
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) < 40 ? (n as number) : -1
}

/** Action par défaut de l'étape en cours, jouée quand l'hôte force (joueur absent, indécis). */
function forceStep(s: State, group: Group) {
  const p = current(s)
  switch (s.step) {
    case 'roll':
    case 'jail':
      return roll(s, p)
    case 'buy':
      s.auction = { square: p.pos, high: null, passed: [] }
      s.step = 'auction'
      return emit(s, { type: 'auction', square: p.pos })
    case 'auction':
      return closeAuction(s)
    case 'card':
      return applyCard(s, p)
    case 'debt': {
      const debtor = playerOf(s, s.debt?.memberId) ?? p
      return bankrupt(s, group, debtor)
    }
    case 'done':
      return nextTurn(s, group)
  }
}

export const monopoly: GameModule = {
  id: 'monopoly',
  name: 'Monopoly',
  icon: '🎩',
  minPlayers: 2,

  initRound(group, session) {
    if (session.round === 0 && session.phase === null) {
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: fresh(session.participantIds) } }
    }
    const s = clone(session.roundData as State)
    if (session.phase === 'intro') {
      s.step = 'roll'
      return { session: { ...session, phase: 'turn', round: 1, roundData: s } }
    }
    if (session.phase === 'turn') {
      forceStep(s, group)
      if (s.winner !== null || active(s).length <= 1) return endedSession(session, s)
      return { session: { ...session, round: session.round + 1, roundData: s } }
    }
    return { session }
  },

  handleAction(group, session, memberId, action: GameAction) {
    if (session.phase !== 'turn' || !session.roundData) return { session }
    const s = clone(session.roundData as State)
    const me = playerOf(s, memberId)
    if (!me || me.bankrupt) {
      if (action.type === 'finish' && memberId === session.hostMemberId) {
        finish(s)
        return endedSession(session, s)
      }
      return { session }
    }
    const cur = current(s)
    const mine = cur.id === memberId
    const payload = action.payload as Record<string, unknown> | null
    let changed = false

    switch (action.type) {
      case 'roll':
        if (mine && (s.step === 'roll' || s.step === 'jail')) {
          roll(s, me)
          changed = true
        }
        break
      case 'buy': {
        const sq = BOARD[me.pos]
        if (mine && s.step === 'buy' && isBuyable(sq) && me.cash >= sq.price) {
          me.cash -= sq.price
          s.owners[me.pos] = me.id
          emit(s, { type: 'buy', who: me.id, square: me.pos, price: sq.price })
          settled(s)
          changed = true
        }
        break
      }
      case 'decline':
        if (mine && s.step === 'buy') {
          s.auction = { square: me.pos, high: null, passed: [] }
          s.step = 'auction'
          emit(s, { type: 'auction', square: me.pos })
          changed = true
        }
        break
      case 'bid': {
        const a = s.auction
        const amount = Number(payload?.amount)
        if (s.step === 'auction' && a && !a.passed.includes(me.id) && Number.isInteger(amount) && amount >= 10 && amount > (a.high?.amount ?? 0) && amount <= me.cash) {
          a.high = { id: me.id, amount }
          emit(s, { type: 'bid', who: me.id, amount })
          checkAuction(s)
          changed = true
        }
        break
      }
      case 'pass':
        if (s.step === 'auction' && s.auction && !s.auction.passed.includes(me.id) && s.auction.high?.id !== me.id) {
          s.auction.passed.push(me.id)
          checkAuction(s)
          changed = true
        }
        break
      case 'ack':
        if (mine && s.step === 'card') {
          applyCard(s, me)
          changed = true
        }
        break
      case 'pay-bail':
        if (mine && s.step === 'jail' && me.cash >= BAIL) {
          me.cash -= BAIL
          s.pot += BAIL
          me.inJail = false
          me.jailTurns = 0
          emit(s, { type: 'free', who: me.id, how: 'bail' })
          s.step = 'roll'
          changed = true
        }
        break
      case 'use-card':
        if (mine && s.step === 'jail' && me.jailCards > 0) {
          me.jailCards -= 1
          const deck = s.secrets.held[me.id]?.pop()
          if (deck) s.secrets[deck].push(cards(deck).findIndex((c) => c.effect.type === 'jailFree'))
          me.inJail = false
          me.jailTurns = 0
          emit(s, { type: 'free', who: me.id, how: 'card' })
          s.step = 'roll'
          changed = true
        }
        break
      case 'build':
        changed = mine && (s.step === 'roll' || s.step === 'done') && build(s, me, squareOf(payload))
        break
      case 'sell':
        changed = sell(s, me, squareOf(payload))
        break
      case 'mortgage':
        changed = mortgage(s, me, squareOf(payload), true)
        break
      case 'unmortgage':
        changed = mine && (s.step === 'roll' || s.step === 'done') && mortgage(s, me, squareOf(payload), false)
        break
      case 'pay-debt': {
        const d = s.debt
        if (d && d.memberId === me.id && me.cash >= d.amount) {
          me.cash -= d.amount
          if (d.to.length === 0) s.pot += d.amount
          for (const c of d.to) {
            const creditor = playerOf(s, c.id)
            if (creditor) creditor.cash += c.amount
          }
          emit(s, { type: 'money', who: me.id, amount: -d.amount, reason: 'Dette réglée' })
          s.debt = null
          s.step = d.resume
          changed = true
        }
        break
      }
      case 'bankrupt':
        if (s.debt?.memberId === me.id) {
          bankrupt(s, group, me)
          changed = true
        }
        break
      case 'end-turn':
        if (mine && s.step === 'done') {
          nextTurn(s, group)
          changed = true
        }
        break
      case 'propose-trade': {
        const to = playerOf(s, payload?.to as string)
        const give = cleanOffer(payload?.give)
        const get = cleanOffer(payload?.get)
        const empty = (o: MonoOffer) => o.cash === 0 && o.squares.length === 0 && o.jailCards === 0
        if (!s.trade && to && to.id !== me.id && !to.bankrupt && !(empty(give) && empty(get)) && offerValid(s, me, give) && offerValid(s, to, get)) {
          s.trade = { id: s.seq + 1, from: me.id, to: to.id, give, get }
          changed = true
        }
        break
      }
      case 'accept-trade':
        if (s.trade?.to === me.id) {
          executeTrade(s)
          changed = true
        }
        break
      case 'decline-trade':
      case 'cancel-trade':
        if (s.trade && (s.trade.to === me.id || s.trade.from === me.id)) {
          s.trade = null
          changed = true
        }
        break
      case 'finish':
        if (memberId === session.hostMemberId) {
          finish(s)
          changed = true
        }
        break
    }

    if (!changed) return { session }
    if (s.winner !== null || active(s).length <= 1) {
      if (s.winner === null) finish(s)
      return endedSession(session, s)
    }
    return { session: { ...session, round: session.round + 1, roundData: s } }
  },

  // Entièrement rythmé par les joueurs et l'hôte.
  isRoundComplete() {
    return false
  },
  isAwaitingInput() {
    return false
  },
  resolveRound(_group, session) {
    return { session }
  },

  // Tout est public, sauf l'ordre des paquets de cartes.
  viewFor(_group, session) {
    const s = session.roundData as State | null
    if (!s) return null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { secrets, ...view } = s
    return view
  },
}
