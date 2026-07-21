import type { Group, PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { pickWithoutRepeat } from './pickHelpers'
import { DRAWING_WORDS, DRAWING_WORDS_TRASH } from '../../src/data/drawingWords'

/** « Coup de Crayon » — skribbl × Gartic Phone × Blanc Manger Coco.
 *
 * Chaque manche : un mot est tiré (banque 500+ mots simples, + mots custom de l'hôte, + pack
 * trash si le salon est en 18+). TOUT LE MONDE dessine le même mot sur son téléphone dans le
 * temps imparti. Les dessins sont ensuite mélangés et anonymisés, la TV les révèle en diaporama,
 * puis chacun vote pour DEUX dessins (jamais le sien) : 🏆 le mieux réussi et 🤣 le plus drôle.
 * Les auteur·rice·s gagnant·e·s marquent chacun·e un point sur leur tableau (art / fun).
 *
 * Conventions de sanitization réutilisées : `submissions` (dessins cachés pendant qu'on dessine),
 * `votes` (vote anonyme, `yourVote` en retour), `secrets.authorByIndex` -> `yourEntryIndex` (pour
 * verrouiller son propre dessin au vote). La galerie mélangée est publique mais anonyme. */

const DRAW_SECONDS = 90
const DEFAULT_ROUNDS = 3
const MAX_ROUNDS = 6
const MAX_CUSTOM_WORDS = 50
const MAX_IMAGE_CHARS = 300_000 // ~225 Ko de dataURL — les canvas JPEG compressés font ~20-60 Ko
const VOTE_RECEIVED_XP = 2
const ROUND_WIN_XP = 5

interface CdcEntry {
  image: string
  authorId: string
}

interface CdcRoundResult {
  word: string
  entries: CdcEntry[]
  bestVotes: number[]
  funnyVotes: number[]
  bestWinners: number[]
  funnyWinners: number[]
}

interface CdcState {
  order: string[]
  usedWords: string[]
  customWords: string[]
  currentWord: string | null
  drawingStartedAt: number | null
  drawSeconds: number
  submissions: Record<string, string> // memberId -> dataURL du dessin
  gallery: { image: string }[] // dessins mélangés, anonymes, pour le vote
  votingStartedAt: number | null
  votes: Record<string, { best: number; funny: number }>
  secrets: { authorByIndex: Record<number, string> } | null
  results: CdcRoundResult | null
  artScore: Record<string, number> // 🏆 manches "mieux réussi" gagnées
  funScore: Record<string, number> // 🤣 manches "plus drôle" gagnées
  totalRounds: number
  roundsPlayed: number
}

function emptyState(): CdcState {
  return {
    order: [],
    usedWords: [],
    customWords: [],
    currentWord: null,
    drawingStartedAt: null,
    drawSeconds: DRAW_SECONDS,
    submissions: {},
    gallery: [],
    votingStartedAt: null,
    votes: {},
    secrets: null,
    results: null,
    artScore: {},
    funScore: {},
    totalRounds: DEFAULT_ROUNDS,
    roundsPlayed: 0,
  }
}

function getState(session: PartySession): CdcState {
  return (session.roundData as CdcState | null) ?? emptyState()
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function wordPool(state: CdcState, group: Group): string[] {
  const pool = [...DRAWING_WORDS, ...state.customWords]
  if (group.adultModeEnabled) pool.push(...DRAWING_WORDS_TRASH)
  return pool
}

/** Démarre une manche de dessin : nouveau mot, compteurs remis à zéro. */
function startDrawingRound(state: CdcState, group: Group, round: number): Partial<PartySession> {
  const pool = wordPool(state, group)
  const word = pickWithoutRepeat(pool, state.usedWords)
  const nextState: CdcState = {
    ...state,
    usedWords: [...state.usedWords, word],
    currentWord: word,
    drawingStartedAt: Date.now(),
    submissions: {},
    gallery: [],
    votingStartedAt: null,
    votes: {},
    secrets: null,
    results: null,
  }
  return { status: 'playing', phase: 'drawing', round, roundData: nextState }
}

/** Dépouille les deux votes et attribue points + XP. */
function resolveVoting(state: CdcState, session: PartySession): { session: PartySession; xpAwards?: XpAward[] } {
  const authorByIndex = state.secrets?.authorByIndex ?? {}
  const bestVotes = state.gallery.map(() => 0)
  const funnyVotes = state.gallery.map(() => 0)
  for (const v of Object.values(state.votes)) {
    if (v.best >= 0 && v.best < bestVotes.length) bestVotes[v.best]++
    if (v.funny >= 0 && v.funny < funnyVotes.length) funnyVotes[v.funny]++
  }

  const winners = (tally: number[]): number[] => {
    const max = tally.length > 0 ? Math.max(...tally) : 0
    return max > 0 ? tally.map((n, i) => (n === max ? i : -1)).filter((i) => i >= 0) : []
  }
  const bestWinners = winners(bestVotes)
  const funnyWinners = winners(funnyVotes)

  const xpAwards: XpAward[] = []
  let artScore = state.artScore
  let funScore = state.funScore
  for (let i = 0; i < state.gallery.length; i++) {
    const authorId = authorByIndex[i]
    if (!authorId) continue
    const received = bestVotes[i] + funnyVotes[i]
    if (received > 0) {
      xpAwards.push({
        memberId: authorId,
        amount: received * VOTE_RECEIVED_XP,
        statIncrements: { 'coupDeCrayon.votesReceived': received },
        reason: 'Son dessin a plu à Coup de Crayon',
      })
    }
    if (bestWinners.includes(i)) {
      artScore = { ...artScore, [authorId]: (artScore[authorId] ?? 0) + 1 }
      xpAwards.push({
        memberId: authorId,
        amount: ROUND_WIN_XP,
        statIncrements: { 'coupDeCrayon.bestWins': 1 },
        reason: 'A signé le dessin le mieux réussi',
      })
    }
    if (funnyWinners.includes(i)) {
      funScore = { ...funScore, [authorId]: (funScore[authorId] ?? 0) + 1 }
      xpAwards.push({
        memberId: authorId,
        amount: ROUND_WIN_XP,
        statIncrements: { 'coupDeCrayon.funnyWins': 1 },
        reason: 'A signé le dessin le plus drôle',
      })
    }
  }

  const entries: CdcEntry[] = state.gallery.map((g, i) => ({ image: g.image, authorId: authorByIndex[i] }))
  const results: CdcRoundResult = {
    word: state.currentWord ?? '',
    entries,
    bestVotes,
    funnyVotes,
    bestWinners,
    funnyWinners,
  }
  const nextState: CdcState = {
    ...state,
    results,
    artScore,
    funScore,
    roundsPlayed: state.roundsPlayed + 1,
    // La galerie brute est vidée (les images vivent dans results) pour ne pas doubler le payload.
    gallery: [],
    secrets: null,
  }
  return { session: { ...session, phase: 'results', roundData: nextState }, xpAwards }
}

export const coupDeCrayon: GameModule = {
  id: 'coup-de-crayon',
  name: 'Coup de Crayon',
  icon: '🖍️',
  minPlayers: 3,

  initRound(group, session, config) {
    const state = getState(session)

    // 1) Tout premier appel : config (manches + mots custom) puis écran de règles.
    if (session.round === 0 && session.phase === null) {
      const cfg = (config as { rounds?: number; customWords?: string[] } | undefined) ?? {}
      const rounds = Math.max(1, Math.min(MAX_ROUNDS, Math.round(cfg.rounds ?? DEFAULT_ROUNDS)))
      const customWords = (cfg.customWords ?? [])
        .filter((w): w is string => typeof w === 'string')
        .map((w) => w.trim().slice(0, 60))
        .filter((w) => w.length > 0)
        .slice(0, MAX_CUSTOM_WORDS)
      const newState: CdcState = { ...emptyState(), order: [...session.participantIds], totalRounds: rounds, customWords }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    // 2) Fin des règles -> première manche.
    if (session.phase === 'intro') {
      return { session: { ...session, ...startDrawingRound(state, group, 1) } }
    }

    // 3) Après les résultats -> manche suivante ou podium.
    if (session.phase === 'results') {
      if (state.roundsPlayed >= state.totalRounds) {
        return { session: { ...session, status: 'ended', phase: 'ended' } }
      }
      return { session: { ...session, ...startDrawingRound(state, group, session.round + 1) } }
    }

    return { session }
  },

  handleAction(_group, session, memberId, action: GameAction) {
    const state = getState(session)

    // Envoi du dessin (une seule fois — le premier envoi fait foi).
    if (session.phase === 'drawing' && action.type === 'submitDrawing') {
      if (state.submissions[memberId]) return { session }
      const payload = action.payload as { image?: string } | null
      const image = payload?.image
      if (typeof image !== 'string' || !image.startsWith('data:image/') || image.length > MAX_IMAGE_CHARS) {
        return { session }
      }
      const nextState: CdcState = { ...state, submissions: { ...state.submissions, [memberId]: image } }
      return {
        session: { ...session, roundData: nextState },
        xpAwards: [
          { memberId, amount: 1, statIncrements: { 'coupDeCrayon.drawings': 1 }, reason: 'A rendu son dessin' },
        ],
      }
    }

    // Double vote : 🏆 mieux réussi + 🤣 plus drôle — jamais son propre dessin.
    if (session.phase === 'voting' && action.type === 'vote') {
      const payload = action.payload as { best?: number; funny?: number } | null
      const best = payload?.best
      const funny = payload?.funny
      const authorByIndex = state.secrets?.authorByIndex ?? {}
      const valid = (i: unknown): i is number =>
        typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < state.gallery.length && authorByIndex[i] !== memberId
      if (!valid(best) || !valid(funny)) return { session }
      const nextState: CdcState = { ...state, votes: { ...state.votes, [memberId]: { best, funny } } }
      return { session: { ...session, roundData: nextState } }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    if (session.phase === 'drawing') {
      return state.order.length > 0 && state.order.every((id) => state.submissions[id] !== undefined)
    }
    if (session.phase === 'voting') {
      const authorByIndex = state.secrets?.authorByIndex ?? {}
      const authors = new Set(Object.values(authorByIndex))
      return state.order.every((id) => {
        // Cas dégénéré : un votant dont le seul dessin en jeu est le sien est dispensé.
        const onlyOwnDrawing = authors.size === 1 && authors.has(id)
        return onlyOwnDrawing || state.votes[id] !== undefined
      })
    }
    return false
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'drawing' || session.phase === 'voting'
  },

  resolveRound(_group, session) {
    const state = getState(session)

    // drawing -> voting : mélange et anonymise les dessins rendus.
    if (session.phase === 'drawing') {
      const submitterIds = shuffle(Object.keys(state.submissions))
      const gallery = submitterIds.map((id) => ({ image: state.submissions[id] }))
      const authorByIndex: Record<number, string> = {}
      submitterIds.forEach((id, i) => (authorByIndex[i] = id))

      const base: CdcState = {
        ...state,
        gallery,
        votingStartedAt: Date.now(),
        votes: {},
        secrets: { authorByIndex },
        // Les dessins rendus sont maintenant dans la galerie — on vide submissions pour ne pas
        // envoyer chaque image deux fois dans chaque broadcast.
        submissions: {},
      }
      // Moins de 2 dessins rendus : le vote n'a pas de sens, on résout directement.
      if (gallery.length < 2) {
        return resolveVoting(base, session)
      }
      return { session: { ...session, phase: 'voting', roundData: base } }
    }

    // voting -> results : dépouillement.
    if (session.phase === 'voting') {
      return resolveVoting(state, session)
    }

    return { session }
  },
}
