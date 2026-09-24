import type { PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import { QUIPROQUO_CONSTRAINTS, QUIPROQUO_TOPICS, type QuiproquoConstraint } from '../../src/data/quiproquo'

/**
 * Quiproquo — chacun reçoit une contrainte secrète, on discute, puis on devine celles des autres.
 *
 * Tout le jeu repose sur le secret des contraintes, or la table complète partait en clair : le
 * téléphone la lisait même pour y retrouver la sienne. Et la liste des réponses proposées était
 * construite dans l'ordre des joueurs — la n-ième proposition était la contrainte du n-ième
 * joueur, la solution se lisait à l'écran. `viewFor` ne donne plus à chacun que sa contrainte,
 * une liste de propositions triée, et ses propres paris (ceux des autres restent masqués jusqu'aux
 * résultats — seul leur NOMBRE est public, pour que la pièce voie qui a fini).
 */

const TOTAL_ROUNDS = 3
const GUESS_POINTS = 3
const UNDETECTED_POINTS = 5
const HIDDEN = '?'

type Phase = 'reveal-constraints' | 'discussion' | 'guessing' | 'results' | 'ended'

interface QuiproquoResult {
  memberId: string
  constraintId: string
  guessedBy: string[]
  guessedCorrectly: boolean
}

interface QuiproquoState {
  round: number
  totalRounds: number
  phase: Phase
  players: string[]
  topic: string | null
  constraintsByMember: Record<string, QuiproquoConstraint>
  allGuesses: Record<string, Record<string, string>> // votant -> { cible -> contrainte }
  scores: Record<string, number>
  usedTopics: string[]
  usedConstraintIds: string[]
  results: QuiproquoResult[]
}

function getState(session: PartySession): QuiproquoState | null {
  return session.roundData as QuiproquoState | null
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Une contrainte différente par joueur (la banque en compte 20), en évitant celles déjà vues. */
function assignConstraints(players: string[], used: string[]): Record<string, QuiproquoConstraint> {
  const fresh = QUIPROQUO_CONSTRAINTS.filter((c) => !used.includes(c.id))
  const pool = shuffle(fresh.length >= players.length ? fresh : QUIPROQUO_CONSTRAINTS)
  return Object.fromEntries(players.map((id, i) => [id, pool[i % pool.length]]))
}

function pickTopic(used: string[]): string {
  const fresh = QUIPROQUO_TOPICS.filter((t) => !used.includes(t))
  const pool = fresh.length > 0 ? fresh : QUIPROQUO_TOPICS
  return pool[Math.floor(Math.random() * pool.length)]
}

function newRound(players: string[], round: number, prev: Pick<QuiproquoState, 'scores' | 'usedTopics' | 'usedConstraintIds'>): QuiproquoState {
  const constraintsByMember = assignConstraints(players, prev.usedConstraintIds)
  const topic = pickTopic(prev.usedTopics)
  return {
    round,
    totalRounds: TOTAL_ROUNDS,
    phase: 'reveal-constraints',
    players,
    topic,
    constraintsByMember,
    allGuesses: {},
    scores: prev.scores,
    usedTopics: [...prev.usedTopics, topic],
    usedConstraintIds: [...prev.usedConstraintIds, ...Object.values(constraintsByMember).map((c) => c.id)],
    results: [],
  }
}

/** A deviné tout le monde (sauf soi). */
function isDone(s: QuiproquoState, voter: string): boolean {
  const mine = s.allGuesses[voter] ?? {}
  return s.players.every((t) => t === voter || !!mine[t])
}

/** Dépouillement, avec les paris déposés jusque-là (l'hôte peut clore avant que tous aient fini). */
function tally(s: QuiproquoState): QuiproquoState {
  const scores = { ...s.scores }
  const results: QuiproquoResult[] = s.players.map((targetId) => {
    const actual = s.constraintsByMember[targetId]
    const guessedBy = s.players.filter((voter) => voter !== targetId && s.allGuesses[voter]?.[targetId] === actual.id)
    for (const voter of guessedBy) scores[voter] = (scores[voter] ?? 0) + GUESS_POINTS
    if (guessedBy.length === 0) scores[targetId] = (scores[targetId] ?? 0) + UNDETECTED_POINTS
    return { memberId: targetId, constraintId: actual.id, guessedBy, guessedCorrectly: guessedBy.length > 0 }
  })
  return { ...s, phase: 'results', scores, results }
}

function withPhase(session: PartySession, s: QuiproquoState): PartySession {
  return { ...session, phase: s.phase, roundData: s }
}

/** Avance d'une étape : révélation → discussion → paris → résultats. */
function step(s: QuiproquoState): QuiproquoState {
  if (s.phase === 'reveal-constraints') return { ...s, phase: 'discussion' }
  if (s.phase === 'discussion') return { ...s, phase: 'guessing' }
  if (s.phase === 'guessing') return tally(s)
  return s
}

function finalXp(s: QuiproquoState): XpAward[] {
  return Object.entries(s.scores)
    .filter(([, score]) => score > 0)
    .map(([memberId, score]) => ({ memberId, amount: score, statIncrements: { 'quiproquo.totalScore': score }, reason: `${score} points au Quiproquo` }))
}

export const quiproquo: GameModule = {
  id: 'quiproquo',
  name: 'Quiproquo',
  icon: '🎭',
  minPlayers: 4,

  initRound(_group, session) {
    const state = getState(session)
    if (session.round === 0 || !state) {
      const s = newRound([...session.participantIds], 1, { scores: {}, usedTopics: [], usedConstraintIds: [] })
      return { session: { ...session, status: 'playing', phase: s.phase, round: 1, roundData: s } }
    }
    if (state.phase === 'results') {
      if (state.round >= state.totalRounds) {
        const s: QuiproquoState = { ...state, phase: 'ended' }
        return { session: { ...session, status: 'ended', phase: 'ended', roundData: s }, xpAwards: finalXp(s) }
      }
      const s = newRound(state.players, state.round + 1, state)
      return { session: { ...session, phase: s.phase, round: s.round, roundData: s } }
    }
    return { session }
  },

  handleAction(_group, session, memberId, action) {
    const state = getState(session)
    if (!state || !state.players.includes(memberId)) return { session }
    const isHost = memberId === session.hostMemberId

    // Les transitions de discussion appartiennent à l'hôte (n'importe qui pouvait les déclencher).
    if (action.type === 'start-discussion' && isHost && state.phase === 'reveal-constraints') {
      return { session: withPhase(session, step(state)) }
    }
    if (action.type === 'end-discussion' && isHost && state.phase === 'discussion') {
      return { session: withPhase(session, step(state)) }
    }

    if (action.type === 'submit-guess' && state.phase === 'guessing') {
      const { targetId, constraintId } = (action.payload ?? {}) as { targetId?: string; constraintId?: string }
      if (!targetId || !constraintId || targetId === memberId || !state.players.includes(targetId)) return { session }
      const inPlay = Object.values(state.constraintsByMember).some((c) => c.id === constraintId)
      if (!inPlay) return { session }
      const allGuesses = { ...state.allGuesses, [memberId]: { ...(state.allGuesses[memberId] ?? {}), [targetId]: constraintId } }
      let s: QuiproquoState = { ...state, allGuesses }
      if (s.players.every((voter) => isDone(s, voter))) s = tally(s)
      return { session: withPhase(session, s) }
    }

    return { session }
  },

  isRoundComplete() {
    return false
  },

  isAwaitingInput(_group, session) {
    const p = getState(session)?.phase
    return p === 'reveal-constraints' || p === 'discussion' || p === 'guessing'
  },

  /** Hôte : étape suivante — y compris clore les paris sans attendre les retardataires. */
  resolveRound(_group, session) {
    const state = getState(session)
    if (!state) return { session }
    return { session: withPhase(session, step(state)) }
  },

  viewFor(_group, session, memberId) {
    const s = getState(session)
    if (!s) return null
    const reveal = s.phase === 'results' || s.phase === 'ended'
    const me = memberId && s.players.includes(memberId) ? memberId : null
    // Propositions : les contraintes en jeu, TRIÉES — jamais dans l'ordre des joueurs.
    const allConstraints = Object.values(s.constraintsByMember)
      .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
      .map((c) => ({ id: c.id, text: c.text }))
      .sort((a, b) => a.text.localeCompare(b.text, 'fr'))
    // Paris : les siens en clair ; ceux des autres réduits à leur nombre avant les résultats.
    const allGuesses = reveal
      ? s.allGuesses
      : Object.fromEntries(
          Object.entries(s.allGuesses).map(([voter, g]) => [
            voter,
            voter === me ? g : Object.fromEntries(Object.keys(g).map((t) => [t, HIDDEN])),
          ]),
        )
    const mine = me ? s.constraintsByMember[me] : null
    return {
      phase: s.phase,
      round: s.round,
      totalRounds: s.totalRounds,
      topic: s.topic,
      players: s.players,
      yourConstraint: mine ? { id: mine.id, text: mine.text, description: mine.description } : null,
      allConstraints,
      allGuesses,
      doneIds: s.players.filter((id) => isDone(s, id)),
      guesses: {},
      scores: s.scores,
      timeLeft: 0,
      results: reveal ? s.results : [],
    }
  },
}
