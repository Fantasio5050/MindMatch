import type { Group, PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import {
  truthOrDareForType,
  type TruthOrDareCard,
  type TruthOrDarePack,
  type TruthOrDareType,
} from '../../src/data/truthOrDare'

/**
 * Action ou Vérité.
 *
 * Défauts corrigés :
 *  - la phase « carte révélée » plantait, téléphone et TV : la vue lisait `state.votes`, que le
 *    filtre générique retire (c'est une clé réservée). Le « correctif » précédent protégeait la
 *    carte, pas les votes ;
 *  - la validation se calculait au moment où le joueur appuyait sur « j'ai fait », souvent avant
 *    que quiconque ait voté : presque tout finissait « rejeté » ;
 *  - la Double Action n'était jamais proposée (22 cartes inaccessibles) et, tirée, n'aurait
 *    désigné aucun partenaire alors que les cartes disent « Vous deux » ;
 *  - un joueur absent bloquait la table : l'hôte n'avait aucun recours ;
 *  - le pack 18+ n'était pas verrouillé côté serveur.
 *
 * Consentement : en Double Action, le partenaire est tiré au sort — et certaines cartes du pack
 * 18+ impliquent un contact physique. Il peut donc se retirer, SANS gage : un autre partenaire
 * est tiré parmi ceux qui n'ont pas refusé ; si personne ne veut, le défi devient une action en
 * solo. Seul le joueur qui a choisi la carte porte le risque du gage.
 *
 * Déroulé : le joueur choisit → la carte s'affiche → il s'exécute (ou refuse) → les AUTRES
 * valident ou non ; le verdict tombe quand tous ont voté, ou quand l'hôte clôt.
 */

type PackChoice = TruthOrDarePack | 'mixed'
type Phase = 'choosing' | 'revealed' | 'result' | 'ended'

const TURNS_PER_PLAYER = 2
const MAX_TURNS = 24
const CHOICE_XP = 2
const APPROVED_XP = 5
const VOTE_XP = 1
const MAX_STREAK = 3

interface PlayerState {
  streakTruth: number
  streakDare: number
  truthsAnswered: number
  daresCompleted: number
  daresRefused: number
}

interface HistoryEntry {
  memberId: string
  partnerId: string | null
  choice: TruthOrDareType
  cardText: string
  approved: boolean
  refused: boolean
}

interface TruthOrDareState {
  phase: Phase
  pack: PackChoice
  players: string[]
  turnOrder: string[]
  turnIndex: number
  totalRounds: number
  usedIds: string[]
  currentMemberId: string | null
  currentCard: TruthOrDareCard | null
  currentChoice: TruthOrDareType | null
  partnerId: string | null
  /** Partenaires qui ont décliné ce défi (ils ne seront pas retirés au sort). */
  declinedPartners: string[]
  forcedChoice: TruthOrDareType | null
  /** Votes privés : qui a voté est public, ce qu'il a voté ne l'est pas avant le verdict. */
  ballots: Record<string, boolean>
  playerStates: Record<string, PlayerState>
  history: HistoryEntry[]
}

function getState(session: PartySession): TruthOrDareState | null {
  return session.roundData as TruthOrDareState | null
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const emptyPs = (): PlayerState => ({ streakTruth: 0, streakDare: 0, truthsAnswered: 0, daresCompleted: 0, daresRefused: 0 })

function forcedFor(s: TruthOrDareState, id: string): TruthOrDareType | null {
  const ps = s.playerStates[id] ?? emptyPs()
  if (ps.streakTruth >= MAX_STREAK) return 'dare'
  if (ps.streakDare >= MAX_STREAK) return 'truth'
  return null
}

function pickCard(pack: PackChoice, type: TruthOrDareType, used: string[]): TruthOrDareCard | null {
  const pool = truthOrDareForType(pack, type)
  const fresh = pool.filter((c) => !used.includes(c.id))
  const from = fresh.length > 0 ? fresh : pool
  return from.length ? from[Math.floor(Math.random() * from.length)] : null
}

/** Voix attendues : tout le monde sauf le joueur (et son partenaire en Double Action). */
function voters(s: TruthOrDareState): string[] {
  return s.players.filter((id) => id !== s.currentMemberId && id !== s.partnerId)
}

function startTurn(s: TruthOrDareState, turnIndex: number): TruthOrDareState {
  const current = s.turnOrder[turnIndex % s.turnOrder.length]
  return {
    ...s,
    phase: 'choosing',
    turnIndex,
    currentMemberId: current,
    currentCard: null,
    currentChoice: null,
    partnerId: null,
    declinedPartners: [],
    forcedChoice: forcedFor(s, current),
    ballots: {},
  }
}

/** Verdict : majorité des voix exprimées (égalité = bénéfice du doute). */
function conclude(s: TruthOrDareState, refused: boolean): { state: TruthOrDareState; xp: XpAward[] } {
  const id = s.currentMemberId!
  const choice = s.currentChoice!
  const votes = Object.values(s.ballots)
  const yes = votes.filter(Boolean).length
  const approved = !refused && (votes.length === 0 || yes * 2 >= votes.length)
  const ps = s.playerStates[id] ?? emptyPs()
  const isTruth = choice === 'truth'
  const nextPs: PlayerState = refused
    ? { ...ps, streakTruth: 0, streakDare: 0, daresRefused: ps.daresRefused + 1 }
    : {
        ...ps,
        streakTruth: isTruth ? ps.streakTruth + 1 : 0,
        streakDare: isTruth ? 0 : ps.streakDare + 1,
        truthsAnswered: ps.truthsAnswered + (isTruth ? 1 : 0),
        daresCompleted: ps.daresCompleted + (isTruth ? 0 : 1),
      }
  const xp: XpAward[] = Object.keys(s.ballots).map((v) => ({ memberId: v, amount: VOTE_XP, reason: 'A voté' }))
  if (approved) {
    for (const who of [id, s.partnerId].filter((x): x is string => !!x)) {
      xp.push({ memberId: who, amount: APPROVED_XP, statIncrements: { 'truthOrDare.completions': 1 }, reason: 'Défi validé par le groupe' })
    }
  }
  if (refused) xp.push({ memberId: id, amount: 0, statIncrements: { 'truthOrDare.refusals': 1 }, reason: 'A refusé' })
  return {
    state: {
      ...s,
      phase: 'result',
      playerStates: { ...s.playerStates, [id]: nextPs },
      history: [...s.history, { memberId: id, partnerId: s.partnerId, choice, cardText: s.currentCard?.text ?? '', approved, refused }],
    },
    xp,
  }
}

function withPhase(session: PartySession, s: TruthOrDareState): PartySession {
  return s.phase === 'ended'
    ? { ...session, status: 'ended', phase: 'ended', roundData: s }
    : { ...session, phase: s.phase, roundData: s }
}

export const truthOrDare: GameModule = {
  id: 'truth-or-dare',
  name: 'Action ou Vérité',
  icon: '🎯',
  minPlayers: 3,

  initRound(group: Group, session, config) {
    const state = getState(session)
    if (session.round === 0 || !state) {
      const requested = (config as { pack?: PackChoice } | undefined)?.pack ?? 'classic'
      // Verrou serveur : le pack trash exige le mode 18+ du salon, quel que soit le client.
      const pack: PackChoice = requested !== 'classic' && !group.adultModeEnabled ? 'classic' : requested
      const players = [...session.participantIds]
      const base: TruthOrDareState = {
        phase: 'choosing',
        pack,
        players,
        turnOrder: shuffle(players),
        turnIndex: 0,
        totalRounds: Math.min(MAX_TURNS, players.length * TURNS_PER_PLAYER),
        usedIds: [],
        currentMemberId: null,
        currentCard: null,
        currentChoice: null,
        partnerId: null,
        declinedPartners: [],
        forcedChoice: null,
        ballots: {},
        playerStates: {},
        history: [],
      }
      const s = startTurn(base, 0)
      return { session: { ...session, status: 'playing', phase: s.phase, round: 1, roundData: s } }
    }
    if (state.phase === 'result') {
      if (state.history.length >= state.totalRounds) return { session: withPhase(session, { ...state, phase: 'ended' }) }
      const s = startTurn(state, state.turnIndex + 1)
      return { session: { ...withPhase(session, s), round: session.round + 1 } }
    }
    return { session }
  },

  handleAction(_group, session, memberId, action) {
    const state = getState(session)
    if (!state || !state.players.includes(memberId)) return { session }

    if (action.type === 'choose' && state.phase === 'choosing') {
      if (memberId !== state.currentMemberId) return { session }
      const choice = (action.payload as { choice?: TruthOrDareType } | null)?.choice
      if (choice !== 'truth' && choice !== 'dare' && choice !== 'double-dare') return { session }
      // La série impose l'autre camp ; la Double Action compte comme une Action.
      const asType = choice === 'double-dare' ? 'dare' : choice
      if (state.forcedChoice && asType !== state.forcedChoice) return { session }
      const card = pickCard(state.pack, choice, state.usedIds)
      if (!card) return { session }
      const others = state.players.filter((id) => id !== memberId)
      const partnerId = choice === 'double-dare' ? others[Math.floor(Math.random() * others.length)] : null
      const s: TruthOrDareState = {
        ...state,
        phase: 'revealed',
        currentChoice: choice,
        currentCard: card,
        partnerId,
        usedIds: [...state.usedIds, card.id],
        ballots: {},
      }
      return {
        session: withPhase(session, s),
        xpAwards: [{ memberId, amount: CHOICE_XP, statIncrements: { [`truthOrDare.${choice}`]: 1 }, reason: 'A tiré une carte' }],
      }
    }

    if (action.type === 'vote' && state.phase === 'revealed') {
      if (!voters(state).includes(memberId)) return { session }
      const approved = !!(action.payload as { approved?: boolean } | null)?.approved
      const s: TruthOrDareState = { ...state, ballots: { ...state.ballots, [memberId]: approved } }
      if (voters(s).every((v) => v in s.ballots)) {
        const { state: done, xp } = conclude(s, false)
        return { session: withPhase(session, done), xpAwards: xp }
      }
      return { session: withPhase(session, s) }
    }

    // Le partenaire se retire, sans gage.
    if (action.type === 'partner-decline' && state.phase === 'revealed' && memberId === state.partnerId) {
      const declinedPartners = [...state.declinedPartners, memberId]
      const candidates = state.players.filter((id) => id !== state.currentMemberId && !declinedPartners.includes(id))
      if (candidates.length > 0) {
        const partnerId = candidates[Math.floor(Math.random() * candidates.length)]
        return { session: withPhase(session, { ...state, partnerId, declinedPartners, ballots: {} }) }
      }
      // Personne n'est partant : le défi redevient une action en solo.
      const card = pickCard(state.pack, 'dare', state.usedIds)
      if (!card) return { session }
      return {
        session: withPhase(session, {
          ...state,
          partnerId: null,
          declinedPartners,
          currentChoice: 'dare',
          currentCard: card,
          usedIds: [...state.usedIds, card.id],
          ballots: {},
        }),
      }
    }

    if (action.type === 'refuse' && state.phase === 'revealed' && memberId === state.currentMemberId) {
      const { state: done, xp } = conclude(state, true)
      return { session: withPhase(session, done), xpAwards: xp }
    }

    return { session }
  },

  isRoundComplete() {
    return false
  },

  isAwaitingInput(_group, session) {
    const p = getState(session)?.phase
    return p === 'choosing' || p === 'revealed'
  },

  /**
   * Hôte : pendant le choix, on choisit pour le joueur absent (au hasard, en respectant la série) ;
   * pendant le vote, on rend le verdict avec les voix déjà exprimées.
   */
  resolveRound(_group, session) {
    const state = getState(session)
    if (!state) return { session }
    if (state.phase === 'revealed') {
      const { state: done, xp } = conclude(state, false)
      return { session: withPhase(session, done), xpAwards: xp }
    }
    if (state.phase === 'choosing' && state.currentMemberId) {
      const choice: TruthOrDareType = state.forcedChoice ?? (Math.random() < 0.5 ? 'truth' : 'dare')
      const card = pickCard(state.pack, choice, state.usedIds)
      if (!card) return { session }
      return {
        session: withPhase(session, { ...state, phase: 'revealed', currentChoice: choice, currentCard: card, usedIds: [...state.usedIds, card.id] }),
      }
    }
    return { session }
  },

  viewFor(_group, session, memberId) {
    const s = getState(session)
    if (!s) return null
    const reveal = s.phase === 'result' || s.phase === 'ended'
    const expected = voters(s)
    return {
      phase: s.phase,
      pack: s.pack,
      players: s.players,
      currentMemberId: s.currentMemberId,
      partnerId: s.partnerId,
      declinedCount: s.declinedPartners.length,
      canDeclinePartner: s.phase === 'revealed' && !!memberId && memberId === s.partnerId,
      currentChoice: s.currentChoice,
      currentCard: s.currentCard ? { id: s.currentCard.id, type: s.currentCard.type, text: s.currentCard.text } : null,
      forcedChoice: s.forcedChoice,
      totalRounds: s.totalRounds,
      turnIndex: s.turnIndex,
      turnOrder: s.turnOrder,
      playerStates: s.playerStates,
      history: s.history,
      // Qui a voté : public. Ce qu'il a voté : à lui seul, jusqu'au verdict.
      votedIds: Object.keys(s.ballots),
      expectedVoters: expected,
      canVote: s.phase === 'revealed' && !!memberId && expected.includes(memberId),
      yourVote: memberId && memberId in s.ballots ? s.ballots[memberId] : null,
      approveCount: reveal ? Object.values(s.ballots).filter(Boolean).length : null,
    }
  },
}
