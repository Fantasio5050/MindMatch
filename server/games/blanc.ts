import type { Group, PartySession } from '../../src/types'
import type { GameModule, GameAction, XpAward } from './types'
import { pickWithoutRepeat } from './pickHelpers'
import { BLANC_PROMPTS, BLANC_ANSWERS, type BlancPrompt, type BlancAnswer } from '../../src/data/blancCards'

/** « Le Grand Blanc » — cartes à trous type Blanc Manger Coco / Juduku (18+).
 *
 * Chaque manche : une carte noire (phrase à trou) est révélée, chacun pose une carte blanche de sa
 * main pour combler le trou, puis tout le monde vote pour la combinaison la plus drôle (jamais la
 * sienne). L'auteur·rice de la carte gagnante marque un point. On réutilise entièrement les
 * conventions de sanitization : `hands` -> `yourHand` (main privée), `submissions` -> carte posée,
 * `votes` -> vote anonyme, `secrets.authorByIndex` -> `yourEntryIndex` (pour masquer sa propre
 * carte au vote). Le paquet de cartes blanches vit dans `secrets` (invisible aux clients). */

const HAND_SIZE = 6
const TOTAL_ROUNDS = 6
const SUBMIT_XP = 1
const VOTE_RECEIVED_XP = 3
const ROUND_WIN_XP = 6
const MIN_PLAYERS = 3

interface BlancEntry {
  text: string
  authorId: string
}

interface BlancRoundResult {
  promptText: string
  entries: BlancEntry[]
  votesByEntry: number[]
  winnerEntryIndices: number[]
}

interface BlancSecrets {
  deck: BlancAnswer[]
  discard: BlancAnswer[]
  authorByIndex: Record<number, string>
}

interface BlancState {
  usedPromptIds: string[]
  currentPrompt: BlancPrompt | null
  order: string[]
  hands: Record<string, BlancAnswer[]>
  submissions: Record<string, string> // memberId -> texte de la carte posée
  plays: { text: string }[] // cartes posées, mélangées et anonymisées, pour le vote
  votes: Record<string, number> // votant -> index de la carte votée
  secrets: BlancSecrets | null
  results: BlancRoundResult | null
  scores: Record<string, number> // manches gagnées
  totalRounds: number
  roundsPlayed: number
}

function emptyState(): BlancState {
  return {
    usedPromptIds: [],
    currentPrompt: null,
    order: [],
    hands: {},
    submissions: {},
    plays: [],
    votes: {},
    secrets: null,
    results: null,
    scores: {},
    totalRounds: TOTAL_ROUNDS,
    roundsPlayed: 0,
  }
}

function getState(session: PartySession): BlancState {
  return (session.roundData as BlancState | null) ?? emptyState()
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Tire `n` cartes du paquet ; si le paquet est vide, on recycle la défausse (mélangée). Mute les
 * tableaux `deck`/`discard` passés (copies locales du handler). */
function drawCards(deck: BlancAnswer[], discard: BlancAnswer[], n: number): BlancAnswer[] {
  const drawn: BlancAnswer[] = []
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      deck.push(...shuffle(discard.splice(0, discard.length)))
    }
    const card = deck.shift()
    if (card) drawn.push(card)
  }
  return drawn
}

function add(map: Record<string, number>, id: string, amount: number): Record<string, number> {
  if (amount === 0) return map
  return { ...map, [id]: (map[id] ?? 0) + amount }
}

export const blanc: GameModule = {
  id: 'blanc',
  name: 'Le Grand Blanc',
  icon: '🖊️',
  minPlayers: MIN_PLAYERS,

  canStart(group: Group) {
    if (!group.adultModeEnabled) return 'Active le mode 18+ pour lancer Le Grand Blanc.'
    return null
  },

  initRound(_group, session) {
    const state = getState(session)

    // 1) Tout premier appel : constitue le paquet, distribue les mains, écran de règles.
    if (session.round === 0 && session.phase === null) {
      const deck = shuffle(BLANC_ANSWERS)
      const discard: BlancAnswer[] = []
      const hands: Record<string, BlancAnswer[]> = {}
      for (const id of session.participantIds) hands[id] = drawCards(deck, discard, HAND_SIZE)
      const newState: BlancState = {
        ...emptyState(),
        order: [...session.participantIds],
        hands,
        secrets: { deck, discard, authorByIndex: {} },
      }
      return { session: { ...session, status: 'playing', phase: 'intro', round: 0, roundData: newState } }
    }

    // 2) Fin des règles -> première manche.
    if (session.phase === 'intro') {
      return { session: { ...session, ...startAnsweringRound(state, 1) } }
    }

    // 3) Après les résultats -> manche suivante ou podium.
    if (session.phase === 'results') {
      if (state.roundsPlayed >= state.totalRounds) {
        return { session: { ...session, status: 'ended', phase: 'ended' } }
      }
      return { session: { ...session, ...startAnsweringRound(state, session.round + 1) } }
    }

    return { session }
  },

  handleAction(_group, session, memberId, action: GameAction) {
    const state = getState(session)

    // Poser une carte de sa main pour combler le trou.
    if (session.phase === 'answering' && action.type === 'play') {
      if (state.submissions[memberId]) return { session }
      const payload = action.payload as { cardId?: string } | null
      const cardId = payload?.cardId
      const hand = state.hands[memberId] ?? []
      const card = hand.find((c) => c.id === cardId)
      if (!card || !state.secrets) return { session }

      const nextHand = hand.filter((c) => c.id !== cardId)
      const nextState: BlancState = {
        ...state,
        hands: { ...state.hands, [memberId]: nextHand },
        submissions: { ...state.submissions, [memberId]: card.text },
        secrets: { ...state.secrets, discard: [...state.secrets.discard, card] },
      }
      return {
        session: { ...session, roundData: nextState },
        xpAwards: [
          { memberId, amount: SUBMIT_XP, statIncrements: { 'blanc.cardsPlayed': 1 }, reason: 'A posé une carte au Grand Blanc' },
        ],
      }
    }

    // Voter pour la carte la plus drôle (jamais la sienne).
    if (session.phase === 'voting' && action.type === 'vote') {
      const payload = action.payload as { entryIndex?: number } | null
      const entryIndex = payload?.entryIndex
      const authorByIndex = state.secrets?.authorByIndex ?? {}
      if (
        entryIndex === undefined ||
        entryIndex < 0 ||
        entryIndex >= state.plays.length ||
        authorByIndex[entryIndex] === memberId // on ne vote pas pour sa propre carte
      ) {
        return { session }
      }
      const nextState: BlancState = { ...state, votes: { ...state.votes, [memberId]: entryIndex } }
      return { session: { ...session, roundData: nextState } }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    if (session.phase === 'answering') {
      return state.order.length > 0 && state.order.every((id) => state.submissions[id] !== undefined)
    }
    if (session.phase === 'voting') {
      // Chacun vote, sauf ceux dont la seule option serait leur propre carte (impossible ici car
      // il y a au moins 2 cartes dès qu'on entre en phase de vote).
      const authorByIndex = state.secrets?.authorByIndex ?? {}
      const authors = new Set(Object.values(authorByIndex))
      return state.order.every((id) => {
        // Un votant sans autre carte que la sienne (cas dégénéré) est ignoré.
        const onlyOwnCard = authors.size === 1 && authors.has(id)
        return onlyOwnCard || state.votes[id] !== undefined
      })
    }
    return false
  },

  isAwaitingInput(_group, session) {
    return session.phase === 'answering' || session.phase === 'voting'
  },

  resolveRound(_group, session) {
    const state = getState(session)

    // answering -> voting : on mélange et anonymise les cartes posées, on recharge les mains.
    if (session.phase === 'answering') {
      const submitterIds = shuffle(Object.keys(state.submissions))
      const plays = submitterIds.map((id) => ({ text: state.submissions[id] }))
      const authorByIndex: Record<number, string> = {}
      submitterIds.forEach((id, i) => (authorByIndex[i] = id))

      // Recharge les mains à HAND_SIZE (les cartes posées sont déjà en défausse).
      const deck = [...(state.secrets?.deck ?? [])]
      const discard = [...(state.secrets?.discard ?? [])]
      const hands: Record<string, BlancAnswer[]> = { ...state.hands }
      for (const id of state.order) {
        const missing = HAND_SIZE - (hands[id]?.length ?? 0)
        if (missing > 0) hands[id] = [...(hands[id] ?? []), ...drawCards(deck, discard, missing)]
      }

      // Moins de 2 cartes posées : le vote n'a pas de sens, on résout directement.
      if (plays.length < 2) {
        return resolveVoting({ ...state, plays, hands, secrets: { deck, discard, authorByIndex }, votes: {} }, session)
      }

      const nextState: BlancState = { ...state, plays, hands, votes: {}, secrets: { deck, discard, authorByIndex } }
      return { session: { ...session, phase: 'voting', roundData: nextState } }
    }

    // voting -> results : dépouillement, points, révélation des auteurs.
    if (session.phase === 'voting') {
      return resolveVoting(state, session)
    }

    return { session }
  },
}

/** Démarre une manche de pose de cartes : nouvelle carte noire, compteurs remis à zéro. */
function startAnsweringRound(state: BlancState, round: number): Partial<PartySession> {
  const prompt = pickWithoutRepeat(BLANC_PROMPTS, BLANC_PROMPTS.filter((p) => state.usedPromptIds.includes(p.id)))
  const nextState: BlancState = {
    ...state,
    usedPromptIds: [...state.usedPromptIds, prompt.id],
    currentPrompt: prompt,
    submissions: {},
    plays: [],
    votes: {},
    results: null,
    secrets: state.secrets ? { ...state.secrets, authorByIndex: {} } : null,
  }
  return { status: 'playing', phase: 'answering', round, roundData: nextState }
}

/** Dépouille les votes, attribue les points et passe en phase résultats. */
function resolveVoting(state: BlancState, session: PartySession): { session: PartySession; xpAwards?: XpAward[] } {
  const authorByIndex = state.secrets?.authorByIndex ?? {}
  const votesByEntry = state.plays.map(() => 0)
  for (const idx of Object.values(state.votes)) {
    if (idx >= 0 && idx < votesByEntry.length) votesByEntry[idx]++
  }

  const maxVotes = votesByEntry.length > 0 ? Math.max(...votesByEntry) : 0
  const winnerEntryIndices = maxVotes > 0 ? votesByEntry.map((v, i) => (v === maxVotes ? i : -1)).filter((i) => i >= 0) : []

  const xpAwards: XpAward[] = []
  let scores = state.scores
  for (let i = 0; i < state.plays.length; i++) {
    const authorId = authorByIndex[i]
    if (!authorId) continue
    const received = votesByEntry[i]
    if (received > 0) {
      xpAwards.push({
        memberId: authorId,
        amount: received * VOTE_RECEIVED_XP,
        statIncrements: { 'blanc.votesReceived': received },
        reason: 'Sa carte a fait rire au Grand Blanc',
      })
    }
    if (winnerEntryIndices.includes(i)) {
      xpAwards.push({
        memberId: authorId,
        amount: ROUND_WIN_XP,
        statIncrements: { 'blanc.roundsWon': 1 },
        reason: 'A remporté une manche du Grand Blanc',
      })
      scores = add(scores, authorId, 1)
    }
  }

  const entries: BlancEntry[] = state.plays.map((p, i) => ({ text: p.text, authorId: authorByIndex[i] }))
  const results: BlancRoundResult = {
    promptText: state.currentPrompt?.text ?? '',
    entries,
    votesByEntry,
    winnerEntryIndices,
  }
  const nextState: BlancState = {
    ...state,
    results,
    scores,
    roundsPlayed: state.roundsPlayed + 1,
    // On retire authorByIndex des secrets (les auteurs sont maintenant révélés publiquement).
    secrets: state.secrets ? { ...state.secrets, authorByIndex: {} } : null,
  }
  return { session: { ...session, phase: 'results', roundData: nextState }, xpAwards }
}
