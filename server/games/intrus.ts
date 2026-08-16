import type { PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { intrusPool, type IntrusPack, type IntrusPair } from '../../src/data/intrusWords'
import { pickWithoutRepeat } from './pickHelpers'

/**
 * « L'Intrus » — déduction sociale façon Undercover (谁是卧底).
 *
 * Les civils partagent un mot, le(s) undercover(s) en ont un légèrement différent SANS le savoir,
 * et le Mr. White n'a aucun mot (lui le sait, et doit improviser). Les indices se donnent à l'ORAL :
 * l'app est maître du jeu (distribution secrète, ordre de parole, chrono indicatif, vote,
 * élimination, révélations) mais ne collecte aucun texte d'indice.
 *
 * Premier jeu à élimination de la plateforme : `alive` est distinct de `participantIds`, et les
 * éliminés deviennent spectateurs — leur téléphone leur révèle toute la vérité (via `secrets`).
 */

export type IntrusRole = 'civil' | 'undercover' | 'mrwhite'
export type IntrusOutcome = 'civils' | 'infiltres' | 'mrwhite'

const DEFAULT_TURN_SECONDS = 30
const CIVIL_WIN_XP = 6
const INFILTRATOR_WIN_XP = 10
const MRWHITE_STEAL_XP = 14
const GOOD_VOTE_XP = 3
const MAX_GUESS_LENGTH = 60

interface Truth {
  roleByMember: Record<string, IntrusRole>
  civilWord: string
  undercoverWord: string
}

interface IntrusSecrets {
  /** Mot de chaque joueur — `null` pour Mr. White. Dérivé côté client en `yourWord`. */
  wordByMember: Record<string, string | null>
  /** Vérité complète, servie uniquement aux joueurs éliminés (dérivé en `yourTruth`). */
  truthByMember: Record<string, Truth>
  roleByMember: Record<string, IntrusRole>
  civilWord: string
  undercoverWord: string
}

interface EliminationEntry {
  memberId: string
  role: IntrusRole
  round: number
}

interface IntrusState {
  pack: IntrusPack
  usedPairIds: string[]
  turnSeconds: number
  mrWhiteEnabled: boolean
  undercoverCount: number
  mrWhiteCount: number
  /** Ordre de table stable (tous les participants, mélangé une fois). */
  order: string[]
  /** Orateurs de la manche courante : les vivants, à partir d'un premier orateur tiré au sort. */
  speakers: string[]
  speakerIndex: number
  turnStartedAt: number | null
  alive: string[]
  eliminated: EliminationEntry[]
  /** Convention plateforme : remplacé par `votedCount` + `yourVote` avant diffusion. */
  votes: Record<string, string>
  ready: string[]
  /** Duel en cas d'égalité : seuls ces joueurs sont éligibles au revote. */
  tiedIds: string[] | null
  /** Vrai pendant un duel, pour que l'UI parle de « duel » plutôt que de manche normale. */
  inDuel: boolean
  lastElimination: EliminationEntry | null
  mrWhiteGuess: { memberId: string; guess: string; correct: boolean } | null
  outcome: IntrusOutcome | null
  /** Rempli seulement à la fin de partie — avant, rien ne fuite. */
  revealedTruth: Truth | null
  secrets: IntrusSecrets | null
}

function emptyState(): IntrusState {
  return {
    pack: 'classic',
    usedPairIds: [],
    turnSeconds: DEFAULT_TURN_SECONDS,
    mrWhiteEnabled: true,
    undercoverCount: 1,
    mrWhiteCount: 0,
    order: [],
    speakers: [],
    speakerIndex: 0,
    turnStartedAt: null,
    alive: [],
    eliminated: [],
    votes: {},
    ready: [],
    tiedIds: null,
    inDuel: false,
    lastElimination: null,
    mrWhiteGuess: null,
    outcome: null,
    revealedTruth: null,
    secrets: null,
  }
}

function getState(session: PartySession): IntrusState {
  return (session.roundData as IntrusState | null) ?? emptyState()
}

function shuffled<T>(items: readonly T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Nombre d'infiltrés maximum tolérable : ils doivent rester STRICTEMENT minoritaires au départ,
 * sinon la condition de victoire des infiltrés (parité) serait atteinte dès la première manche. */
export function maxInfiltrators(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 2))
}

/** Répartition conseillée (~1 undercover pour 4 joueurs), alignée sur les usages du jeu original. */
export function autoUndercoverCount(playerCount: number): number {
  if (playerCount <= 6) return 1
  if (playerCount <= 9) return 2
  return 3
}

/** Résout la répartition finale en respectant le garde-fou de minorité. Le Mr. White est ajouté
 * seulement s'il reste de la place (à 4 joueurs, il n'y en a pas). */
export function resolveRoleCounts(
  playerCount: number,
  wantMrWhite: boolean,
  requestedUndercovers?: number,
): { undercovers: number; mrWhites: number } {
  const cap = maxInfiltrators(playerCount)
  const wanted = requestedUndercovers ?? autoUndercoverCount(playerCount)
  const undercovers = Math.max(1, Math.min(wanted, cap))
  const mrWhites = wantMrWhite && undercovers < cap ? 1 : 0
  return { undercovers, mrWhites }
}

function normalizeGuess(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '')
}

function rolesOf(state: IntrusState): Record<string, IntrusRole> {
  return state.secrets?.roleByMember ?? {}
}

function aliveInfiltrators(state: IntrusState): string[] {
  const roles = rolesOf(state)
  return state.alive.filter((id) => roles[id] === 'undercover' || roles[id] === 'mrwhite')
}

function aliveCivils(state: IntrusState): string[] {
  const roles = rolesOf(state)
  return state.alive.filter((id) => roles[id] === 'civil')
}

/** Condition de victoire : civils s'il n'y a plus d'infiltré, infiltrés dès qu'ils atteignent la
 * parité numérique avec les civils. */
function computeOutcome(state: IntrusState): IntrusOutcome | null {
  const infiltres = aliveInfiltrators(state).length
  if (infiltres === 0) return 'civils'
  if (infiltres >= aliveCivils(state).length) return 'infiltres'
  return null
}

/** Prépare une manche d'indices : orateurs = vivants dans l'ordre de table, à partir d'un premier
 * orateur tiré au sort (l'ordre tourne donc à chaque manche). */
function startClueRound(state: IntrusState, tied: string[] | null): IntrusState {
  const base = state.order.filter((id) => state.alive.includes(id))
  const pool = tied && tied.length > 0 ? base.filter((id) => tied.includes(id)) : base
  const roles = state.secrets?.roleByMember ?? {}
  const offset = pool.length > 0 ? Math.floor(Math.random() * pool.length) : 0
  const speakers = pool.map((_, i) => pool[(offset + i) % pool.length])

  const firstNonMrWhiteIndex = speakers.findIndex((id) => roles[id] !== 'mrwhite')
  const rotatedSpeakers =
    firstNonMrWhiteIndex > 0 ? [...speakers.slice(firstNonMrWhiteIndex), ...speakers.slice(0, firstNonMrWhiteIndex)] : speakers

  return {
    ...state,
    speakers: rotatedSpeakers,
    speakerIndex: 0,
    turnStartedAt: Date.now(),
    votes: {},
    tiedIds: tied,
    inDuel: !!tied,
  }
}

function endedSession(session: PartySession, state: IntrusState, outcome: IntrusOutcome): PartySession {
  const truth: Truth | null = state.secrets
    ? {
        roleByMember: state.secrets.roleByMember,
        civilWord: state.secrets.civilWord,
        undercoverWord: state.secrets.undercoverWord,
      }
    : null
  const nextState: IntrusState = { ...state, outcome, revealedTruth: truth, secrets: null, votes: {} }
  return { ...session, status: 'ended', phase: 'ended', roundData: nextState }
}

function winnerAwards(state: IntrusState, outcome: IntrusOutcome): XpAward[] {
  const roles = rolesOf(state)
  const awards: XpAward[] = []
  for (const [memberId, role] of Object.entries(roles)) {
    if (outcome === 'civils' && role === 'civil') {
      awards.push({ memberId, amount: CIVIL_WIN_XP, statIncrements: { 'intrus.civilWins': 1 }, reason: 'Les civils ont démasqué les intrus' })
    }
    if (outcome === 'infiltres' && (role === 'undercover' || role === 'mrwhite')) {
      awards.push({ memberId, amount: INFILTRATOR_WIN_XP, statIncrements: { 'intrus.infiltratorWins': 1 }, reason: 'Les intrus sont passés inaperçus' })
    }
    if (outcome === 'mrwhite' && role === 'mrwhite') {
      awards.push({ memberId, amount: MRWHITE_STEAL_XP, statIncrements: { 'intrus.mrWhiteSteals': 1 }, reason: 'Mr. White a volé la partie' })
    }
  }
  return awards
}

/** Applique une élimination : révèle le rôle, puis oriente vers la devinette de Mr. White, la fin
 * de partie, ou la manche suivante. */
function applyElimination(
  session: PartySession,
  state: IntrusState,
  targetId: string,
  voters: Record<string, string>,
): { session: PartySession; xpAwards?: XpAward[] } {
  const roles = rolesOf(state)
  const role = roles[targetId] ?? 'civil'
  const entry: EliminationEntry = { memberId: targetId, role, round: session.round }

  const alive = state.alive.filter((id) => id !== targetId)
  const truth: Truth | null = state.secrets
    ? {
        roleByMember: state.secrets.roleByMember,
        civilWord: state.secrets.civilWord,
        undercoverWord: state.secrets.undercoverWord,
      }
    : null
  const secrets: IntrusSecrets | null = state.secrets
    ? {
        ...state.secrets,
        // L'éliminé accède désormais à toute la vérité (et doit se taire 🤫).
        truthByMember: truth ? { ...state.secrets.truthByMember, [targetId]: truth } : state.secrets.truthByMember,
      }
    : null

  // Bonus de déduction : ceux qui ont voté juste contre un infiltré.
  const xpAwards: XpAward[] = []
  if (role !== 'civil') {
    for (const [voterId, choice] of Object.entries(voters)) {
      if (choice === targetId) {
        xpAwards.push({
          memberId: voterId,
          amount: GOOD_VOTE_XP,
          statIncrements: { 'intrus.goodVotes': 1 },
          reason: 'A voté contre un intrus',
        })
      }
    }
  }

  const nextState: IntrusState = {
    ...state,
    alive,
    secrets,
    eliminated: [...state.eliminated, entry],
    lastElimination: entry,
    votes: {},
    tiedIds: null,
    inDuel: false,
  }

  // Mr. White démasqué : une unique chance de deviner le mot des civils.
  if (role === 'mrwhite') {
    return { session: { ...session, phase: 'mrwhite', roundData: nextState }, xpAwards }
  }

  const outcome = computeOutcome(nextState)
  if (outcome) {
    return { session: endedSession(session, nextState, outcome), xpAwards: [...xpAwards, ...winnerAwards(nextState, outcome)] }
  }
  return { session: { ...session, phase: 'reveal', roundData: nextState }, xpAwards }
}

interface IntrusConfig {
  pack?: IntrusPack
  turnSeconds?: number
  mrWhite?: boolean
  undercoverCount?: number
}

export const intrus: GameModule = {
  id: 'intrus',
  name: "L'Intrus",
  icon: '🕵️',
  minPlayers: 4,

  initRound(group, session, config) {
    const state = getState(session)
    const isFirstRound = session.round === 0

    // Manches suivantes : nouvelle salve d'indices (la fin de partie est décidée à l'élimination).
    if (!isFirstRound) {
      if (state.outcome) return { session: { ...session, status: 'ended', phase: 'ended' } }
      const next = startClueRound({ ...state, lastElimination: state.lastElimination, mrWhiteGuess: null }, null)
      return { session: { ...session, status: 'playing', phase: 'clues', round: session.round + 1, roundData: next } }
    }

    const cfg = (config ?? {}) as IntrusConfig
    const requestedPack: IntrusPack = cfg.pack === 'trash' || cfg.pack === 'mixed' ? cfg.pack : 'classic'
    // Le contenu 18+ n'est servi que si la salle l'a explicitement débloqué.
    const pack: IntrusPack = requestedPack !== 'classic' && !group.adultModeEnabled ? 'classic' : requestedPack
    const turnSeconds = [15, 30, 45].includes(cfg.turnSeconds ?? 0) ? (cfg.turnSeconds as number) : DEFAULT_TURN_SECONDS
    const wantMrWhite = cfg.mrWhite !== false

    const ids = group.members.map((m) => m.id)
    const { undercovers, mrWhites } = resolveRoleCounts(ids.length, wantMrWhite, cfg.undercoverCount)

    const pool = intrusPool(pack)
    const used = pool.filter((p) => state.usedPairIds.includes(p.id))
    const pair: IntrusPair = pickWithoutRepeat(pool, used)

    // Attribution des rôles.
    const shuffledIds = shuffled(ids)
    const roleByMember: Record<string, IntrusRole> = {}
    shuffledIds.forEach((id, i) => {
      if (i < undercovers) roleByMember[id] = 'undercover'
      else if (i < undercovers + mrWhites) roleByMember[id] = 'mrwhite'
      else roleByMember[id] = 'civil'
    })
    const wordByMember: Record<string, string | null> = {}
    for (const id of ids) {
      const role = roleByMember[id]
      wordByMember[id] = role === 'mrwhite' ? null : role === 'undercover' ? pair.undercover : pair.civil
    }

    const nextState: IntrusState = {
      ...emptyState(),
      pack,
      usedPairIds: [...state.usedPairIds, pair.id],
      turnSeconds,
      mrWhiteEnabled: mrWhites > 0,
      undercoverCount: undercovers,
      mrWhiteCount: mrWhites,
      order: shuffled(ids),
      alive: [...ids],
      ready: [],
      secrets: {
        wordByMember,
        truthByMember: {},
        roleByMember,
        civilWord: pair.civil,
        undercoverWord: pair.undercover,
      },
    }

    return { session: { ...session, status: 'playing', phase: 'reveal-word', round: 1, roundData: nextState } }
  },

  handleAction(group, session, memberId, action: GameAction) {
    const state = getState(session)

    // Découverte de son mot (« appuie pour révéler ») — sert de "prêt".
    if (session.phase === 'reveal-word' && action.type === 'ready') {
      if (!state.alive.includes(memberId) || state.ready.includes(memberId)) return { session }
      return { session: { ...session, roundData: { ...state, ready: [...state.ready, memberId] } } }
    }

    // Tour de parole oral : l'orateur (ou l'hôte, en secours) valide la fin de son tour.
    if ((session.phase === 'clues' || session.phase === 'duel-clues') && action.type === 'spoke') {
      const speaker = state.speakers[state.speakerIndex]
      const isHost = session.hostMemberId === memberId
      if (!speaker || (memberId !== speaker && !isHost)) return { session }
      return {
        session: {
          ...session,
          roundData: { ...state, speakerIndex: state.speakerIndex + 1, turnStartedAt: Date.now() },
        },
      }
    }

    if ((session.phase === 'vote' || session.phase === 'duel-vote') && action.type === 'vote') {
      const payload = action.payload as { targetId?: string } | null
      const targetId = payload?.targetId
      const eligible = session.phase === 'duel-vote' ? (state.tiedIds ?? []) : state.alive
      const voters = session.phase === 'duel-vote' ? state.alive.filter((id) => !(state.tiedIds ?? []).includes(id)) : state.alive
      if (
        !targetId ||
        !voters.includes(memberId) ||
        !eligible.includes(targetId) ||
        targetId === memberId || // on ne se vote pas soi-même
        !group.members.some((m) => m.id === targetId)
      ) {
        return { session }
      }
      return { session: { ...session, roundData: { ...state, votes: { ...state.votes, [memberId]: targetId } } } }
    }

    // Mr. White démasqué propose le mot des civils.
    if (session.phase === 'mrwhite' && action.type === 'guess') {
      const payload = action.payload as { guess?: string } | null
      const guess = payload?.guess?.trim().slice(0, MAX_GUESS_LENGTH)
      const pending = state.lastElimination
      if (!guess || !pending || pending.memberId !== memberId || state.mrWhiteGuess) return { session }
      const civilWord = state.secrets?.civilWord ?? ''
      const correct = normalizeGuess(guess) === normalizeGuess(civilWord)
      return { session: { ...session, roundData: { ...state, mrWhiteGuess: { memberId, guess, correct } } } }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    switch (session.phase) {
      case 'reveal-word':
        return state.alive.length > 0 && state.alive.every((id) => state.ready.includes(id))
      case 'clues':
      case 'duel-clues':
        return state.speakerIndex >= state.speakers.length
      case 'vote':
        return state.alive.length > 0 && state.alive.every((id) => state.votes[id] !== undefined)
      case 'duel-vote': {
        const voters = state.alive.filter((id) => !(state.tiedIds ?? []).includes(id))
        return voters.length > 0 && voters.every((id) => state.votes[id] !== undefined)
      }
      case 'mrwhite':
        return state.mrWhiteGuess !== null
      default:
        return false
    }
  },

  isAwaitingInput(_group, session) {
    return ['reveal-word', 'clues', 'duel-clues', 'vote', 'duel-vote', 'mrwhite'].includes(session.phase ?? '')
  },

  resolveRound(_group, session) {
    const state = getState(session)

    if (session.phase === 'reveal-word') {
      return { session: { ...session, phase: 'clues', roundData: startClueRound(state, null) } }
    }

    if (session.phase === 'clues' || session.phase === 'duel-clues') {
      const phase = session.phase === 'duel-clues' ? 'duel-vote' : 'vote'
      return { session: { ...session, phase, roundData: { ...state, votes: {}, turnStartedAt: null } } }
    }

    if (session.phase === 'vote' || session.phase === 'duel-vote') {
      const tally: Record<string, number> = {}
      for (const target of Object.values(state.votes)) tally[target] = (tally[target] ?? 0) + 1
      const top = Math.max(0, ...Object.values(tally))
      const leaders = Object.keys(tally).filter((id) => tally[id] === top)

      if (top === 0) {
        // Personne n'a voté (tout le monde a passé son tour) — on enchaîne une nouvelle salve.
        return { session: { ...session, phase: 'clues', roundData: startClueRound(state, null) } }
      }

      if (leaders.length > 1) {
        // Égalité. Premier round : duel (indice supplémentaire puis revote entre ex-æquo).
        // Deuxième égalité d'affilée : personne n'est éliminé, pour ne pas boucler indéfiniment.
        if (session.phase === 'vote') {
          const duelVoters = state.alive.filter((id) => !leaders.includes(id))
          if (duelVoters.length > 0) {
            return { session: { ...session, phase: 'duel-clues', roundData: startClueRound(state, leaders) } }
          }
        }
        return { session: { ...session, phase: 'clues', roundData: startClueRound(state, null) } }
      }

      return applyElimination(session, state, leaders[0], state.votes)
    }

    if (session.phase === 'mrwhite') {
      const guess = state.mrWhiteGuess
      if (guess?.correct) {
        return { session: endedSession(session, state, 'mrwhite'), xpAwards: winnerAwards(state, 'mrwhite') }
      }
      const outcome = computeOutcome(state)
      if (outcome) {
        return { session: endedSession(session, state, outcome), xpAwards: winnerAwards(state, outcome) }
      }
      return { session: { ...session, phase: 'reveal', roundData: state } }
    }

    return { session }
  },
}
