import type { Group, PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import {
  type RoleId,
  type Phase,
  type NightStep,
  NIGHT_ORDER,
  computeRoleCounts,
  getNightStepForRole,
} from '../../src/data/loupGarou'

const DAY_VOTE_XP = 2
const NIGHT_ACTION_XP = 1
const WIN_XP = 10

/** État secret — stocké dans session.roundData, jamais envoyé tel quel au client */
interface LoupGarouSecrets {
  roleByMember: Record<string, RoleId>
  lovers: [string, string] | null
  voyanteChecks: string[]
  salvateurLastProtect: string | null
  sorciereHealUsed: boolean
  sorciereKillUsed: boolean
  killTarget: string | null
  protectedTarget: string | null
  healedThisNight: boolean
  nightVotes: Record<string, string> // loupId -> targetId
  cupidonChoice: [string, string] | null
  voyanteChoice: string | null
  salvateurChoice: string | null
  sorciereAction: { heal: boolean; killTarget: string | null } | null
  dayVotes: Record<string, string> // voterId -> targetId
  hunterShotTarget: string | null
  nightDeaths: string[]
  dayNumber: number
  currentNightStep: NightStep | null  // explicitly typed
  currentNightActor: string | null
  winner: 'village' | 'loups' | 'lovers' | null
  alive: string[]
  dead: { memberId: string; role: RoleId; cause: string }[]
  phase: Phase
  pendingNightSteps: NightStep[]
  history: { day: number; event: string }[]
}

function getState(session: PartySession): LoupGarouSecrets {
  return session.roundData as LoupGarouSecrets
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function assignRoles(members: { id: string }[]): Record<string, RoleId> {
  const counts = computeRoleCounts(members.length)
  const rolePool: RoleId[] = []
  for (const [role, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) rolePool.push(role as RoleId)
  }
  // Fill remaining with villageois
  while (rolePool.length < members.length) rolePool.push('villageois')
  // Trim excess
  rolePool.length = members.length

  const shuffled = shuffle(rolePool)
  const assignment: Record<string, RoleId> = {}
  members.forEach((m, i) => { assignment[m.id] = shuffled[i] })
  return assignment
}

function checkWinCondition(state: LoupGarouSecrets): 'village' | 'loups' | 'lovers' | null {
  const alive = state.alive
  const aliveLoups = alive.filter(id => state.roleByMember[id] === 'loup-garou')
  const aliveNonLoups = alive.filter(id => state.roleByMember[id] !== 'loup-garou')

  if (aliveLoups.length === 0) return 'village'
  if (aliveLoups.length >= aliveNonLoups.length) return 'loups'

  // Lovers win if they're the last 2 alive
  if (state.lovers && alive.length === 2 && state.lovers.every(id => alive.includes(id))) {
    return 'lovers'
  }

  return null
}

function handleDeath(state: LoupGarouSecrets, memberId: string, cause: string): { state: LoupGarouSecrets; hunterNeedsToShoot: boolean } {
  const role = state.roleByMember[memberId]
  const nextState: LoupGarouSecrets = {
    ...state,
    alive: state.alive.filter(id => id !== memberId),
    dead: [...state.dead, { memberId, role, cause }],
  }

  // Lover suicide
  if (state.lovers && state.lovers.includes(memberId)) {
    const other = state.lovers.find(id => id !== memberId)
    if (other && nextState.alive.includes(other)) {
      return handleDeath(nextState, other, 'amour (suicide)')
    }
  }

  // Hunter shoots
  const hunterNeedsToShoot = role === 'chasseur'
  return { state: nextState, hunterNeedsToShoot }
}

function advanceNightStep(state: LoupGarouSecrets, group: Group): LoupGarouSecrets {
  const pendingSteps = [...state.pendingNightSteps]
  if (pendingSteps.length === 0) {
    // Night is over — resolve deaths
    return resolveNight(state, group)
  }

  const nextStep = pendingSteps[0]
  const remainingSteps = pendingSteps.slice(1)

  // Find the actor for this step
  let actor: string | null = null
  for (const id of state.alive) {
    const role = state.roleByMember[id]
    if (getNightStepForRole(role) === nextStep) {
      actor = id
      break
    }
  }

  // For loups, any loup can act
  if (nextStep === 'loups') {
    actor = state.alive.find(id => state.roleByMember[id] === 'loup-garou') ?? null
  }

  // If no actor for this step (role dead), skip
  if (!actor && nextStep !== 'petite-fille') {
    return advanceNightStep({ ...state, pendingNightSteps: remainingSteps }, group)
  }

  return {
    ...state,
    currentNightStep: nextStep,
    currentNightActor: actor,
    pendingNightSteps: remainingSteps,
  }
}

function resolveNight(state: LoupGarouSecrets, _group: Group): LoupGarouSecrets {
  let nextState: LoupGarouSecrets = { ...state, phase: 'day' as Phase, currentNightStep: null as NightStep | null, currentNightActor: null as string | null }
  const deaths: string[] = []

  // Loup kill (unless protected or healed)
  if (state.killTarget && state.killTarget !== state.protectedTarget && !state.healedThisNight) {
    deaths.push(state.killTarget)
  }

  // Sorciere kill
  if (state.sorciereAction?.killTarget) {
    if (!deaths.includes(state.sorciereAction.killTarget)) {
      deaths.push(state.sorciereAction.killTarget)
    }
  }

  for (const deathId of deaths) {
    if (nextState.alive.includes(deathId)) {
      const { state: afterDeath } = handleDeath(nextState, deathId, 'nuit (loups-garous)')
      nextState = afterDeath
    }
  }

  nextState.history = [...nextState.history, { day: state.dayNumber, event: deaths.length > 0 ? `Nuit ${state.dayNumber}: ${deaths.length} mort(s)` : `Nuit ${state.dayNumber}: personne n'est mort` }]

  // Reset night state
  nextState.killTarget = null
  nextState.protectedTarget = null
  nextState.healedThisNight = false
  nextState.sorciereAction = null
  nextState.voyanteChoice = null
  nextState.salvateurChoice = null
  nextState.nightVotes = {}
  nextState.cupidonChoice = null

  // Check win
  const winner = checkWinCondition(nextState)
  if (winner) {
    nextState.winner = winner
    nextState.phase = 'ended'
  }

  return nextState
}

function resolveDayVote(state: LoupGarouSecrets, _group: Group): LoupGarouSecrets {
  const voteCounts: Record<string, number> = {}
  for (const targetId of Object.values(state.dayVotes)) {
    voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1
  }

  let eliminated: string | null = null
  let maxVotes = 0
  for (const [id, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count
      eliminated = id
    }
  }

  let nextState = { ...state, phase: 'reveal' as Phase }
  if (eliminated && state.alive.includes(eliminated)) {
    const { state: afterDeath, hunterNeedsToShoot } = handleDeath(nextState, eliminated, 'vote du village')
    nextState = afterDeath
    nextState.hunterShotTarget = null
    if (hunterNeedsToShoot) {
      nextState.phase = 'hunter-shot'
    }
  }

  nextState.history = [...nextState.history, { day: state.dayNumber, event: eliminated ? `Jour ${state.dayNumber}: ${eliminated} éliminé·e par le village` : `Jour ${state.dayNumber}: personne éliminé·e` }]
  nextState.dayVotes = {}

  // Check win
  const winner = checkWinCondition(nextState)
  if (winner) {
    nextState.winner = winner
    nextState.phase = 'ended'
  }

  return nextState
}

export const loupGarou: GameModule = {
  id: 'loup-garou',
  name: 'Loup-Garou',
  icon: '🐺',
  minPlayers: 8,

  initRound(group, session, _config) {
    const isFirstRound = session.round === 0

    if (!isFirstRound) {
      const state = getState(session)
      // Continue game based on current phase
      if (state.phase === 'day') {
        // Start vote
        return { session: { ...session, status: 'playing', phase: 'vote', roundData: { ...state, phase: 'vote' as Phase } } }
      }
      if (state.phase === 'reveal' || state.phase === 'hunter-shot') {
        // Start next night
        const nextState: LoupGarouSecrets = {
          ...state,
          phase: 'night',
          dayNumber: state.dayNumber + 1,
          pendingNightSteps: [...NIGHT_ORDER],
          currentNightActor: null,
        }
        const advanced = advanceNightStep(nextState, group)
        return { session: { ...session, status: 'playing', phase: 'night', roundData: advanced } }
      }
      return { session }
    }

    // First round — assign roles and start
    const roleByMember = assignRoles(group.members)
    const alive = group.members.map(m => m.id)

    const state: LoupGarouSecrets = {
      roleByMember,
      currentNightStep: null as NightStep | null,
      lovers: null,
      voyanteChecks: [],
      salvateurLastProtect: null,
      sorciereHealUsed: false,
      sorciereKillUsed: false,
      killTarget: null,
      protectedTarget: null,
      healedThisNight: false,
      nightVotes: {},
      cupidonChoice: null,
      voyanteChoice: null,
      salvateurChoice: null,
      sorciereAction: null,
      dayVotes: {},
      hunterShotTarget: null,
      nightDeaths: [],
      dayNumber: 1,
      currentNightActor: null as string | null,
      pendingNightSteps: [...NIGHT_ORDER],
      alive,
      dead: [],
      phase: 'role-reveal',
      winner: null,
      history: [],
    }

    return {
      session: { ...session, status: 'playing', phase: 'role-reveal', round: 1, roundData: state },
    }
  },

  handleAction(group, session, memberId, action) {
    const state = getState(session)
    const act = action as { type: string; payload: unknown }

    // Start game (host)
    if (act.type === 'start') {
      const nextState = advanceNightStep(state, group)
      return { session: { ...session, phase: 'night', roundData: nextState } }
    }

    // Cupidon links two players
    if (act.type === 'cupidon-link') {
      if (state.currentNightStep !== 'cupidon' || memberId !== state.currentNightActor) return { session }
      const { target1, target2 } = act.payload as { target1: string; target2: string }
      const nextState = advanceNightStep({ ...state, lovers: [target1, target2] }, group)
      return {
        session: { ...session, roundData: nextState },
        xpAwards: [{ memberId, amount: NIGHT_ACTION_XP, reason: 'Cupidon a lié deux amoureux' }],
      }
    }

    // Voyante checks a player
    if (act.type === 'voyante-check') {
      if (state.currentNightStep !== 'voyante' || memberId !== state.currentNightActor) return { session }
      const { targetId } = act.payload as { targetId: string }
      const nextState = advanceNightStep({
        ...state,
        voyanteChecks: [...state.voyanteChecks, targetId],
        voyanteChoice: targetId,
      }, group)
      // Store the result for the client state to pick up
      return {
        session: { ...session, roundData: { ...nextState, voyanteChoice: targetId } },
        xpAwards: [{ memberId, amount: NIGHT_ACTION_XP, reason: 'Voyante a examiné un joueur' }],
      }
    }

    // Salvateur protects
    if (act.type === 'salvateur-protect') {
      if (state.currentNightStep !== 'salvateur' || memberId !== state.currentNightActor) return { session }
      const { targetId } = act.payload as { targetId: string }
      const nextState = advanceNightStep({
        ...state,
        protectedTarget: targetId,
        salvateurLastProtect: targetId,
        salvateurChoice: targetId,
      }, group)
      return {
        session: { ...session, roundData: nextState },
        xpAwards: [{ memberId, amount: NIGHT_ACTION_XP, reason: 'Salvateur a protégé un joueur' }],
      }
    }

    // Loup votes for a target
    if (act.type === 'loup-vote') {
      if (state.currentNightStep !== 'loups') return { session }
      const role = state.roleByMember[memberId]
      if (role !== 'loup-garou' || !state.alive.includes(memberId)) return { session }
      const { targetId } = act.payload as { targetId: string }
      const nightVotes = { ...state.nightVotes, [memberId]: targetId }

      // Check if all alive loups have voted
      const aliveLoups = state.alive.filter(id => state.roleByMember[id] === 'loup-garou')
      const allVoted = aliveLoups.every(id => id in nightVotes)

      if (allVoted) {
        // Tally votes
        const voteCounts: Record<string, number> = {}
        for (const target of Object.values(nightVotes)) {
          voteCounts[target] = (voteCounts[target] ?? 0) + 1
        }
        let killTarget: string | null = null
        let maxVotes = 0
        for (const [id, count] of Object.entries(voteCounts)) {
          if (count > maxVotes) { maxVotes = count; killTarget = id }
        }
        const nextState = advanceNightStep({ ...state, nightVotes, killTarget }, group)
        return { session: { ...session, roundData: nextState } }
      }

      return { session: { ...session, roundData: { ...state, nightVotes } } }
    }

    // Sorciere action
    if (act.type === 'sorciere-heal') {
      if (state.currentNightStep !== 'sorciere' || memberId !== state.currentNightActor) return { session }
      const nextState = advanceNightStep({
        ...state,
        sorciereHealUsed: true,
        healedThisNight: true,
        sorciereAction: { heal: true, killTarget: null },
      }, group)
      return { session: { ...session, roundData: nextState } }
    }

    if (act.type === 'sorciere-kill') {
      if (state.currentNightStep !== 'sorciere' || memberId !== state.currentNightActor) return { session }
      const { targetId } = act.payload as { targetId: string }
      const nextState = advanceNightStep({
        ...state,
        sorciereKillUsed: true,
        sorciereAction: { heal: false, killTarget: targetId },
      }, group)
      return { session: { ...session, roundData: nextState } }
    }

    if (act.type === 'sorciere-pass') {
      if (state.currentNightStep !== 'sorciere' || memberId !== state.currentNightActor) return { session }
      const nextState = advanceNightStep({ ...state, sorciereAction: { heal: false, killTarget: null } }, group)
      return { session: { ...session, roundData: nextState } }
    }

    // Day vote
    if (act.type === 'day-vote') {
      if (state.phase !== 'vote' || !state.alive.includes(memberId)) return { session }
      const { targetId } = act.payload as { targetId: string }
      const dayVotes = { ...state.dayVotes, [memberId]: targetId }

      // Check if all alive have voted
      if (Object.keys(dayVotes).length >= state.alive.length) {
        const resolved = resolveDayVote({ ...state, dayVotes }, group)
        return {
          session: { ...session, phase: resolved.phase, roundData: resolved },
          xpAwards: state.alive.map(id => ({ memberId: id, amount: DAY_VOTE_XP, reason: 'A participé au vote' })),
        }
      }

      return { session: { ...session, roundData: { ...state, dayVotes } } }
    }

    // Hunter shoots
    if (act.type === 'hunter-shoot') {
      if (state.phase !== 'hunter-shot') return { session }
      const { targetId } = act.payload as { targetId: string }
      let nextState = { ...state, phase: 'reveal' as Phase }
      if (state.alive.includes(targetId)) {
        const { state: afterDeath } = handleDeath(nextState, targetId, 'chasseur')
        nextState = afterDeath
      }
      nextState.hunterShotTarget = targetId

      // Check win
      const winner = checkWinCondition(nextState)
      if (winner) {
        nextState.winner = winner
        nextState.phase = 'ended'
      }

      return { session: { ...session, phase: nextState.phase, roundData: nextState } }
    }

    // Advance (host moves to next phase)
    if (act.type === 'advance') {
      // This is handled by initRound being called again
      return { session }
    }

    return { session }
  },

  isRoundComplete(_group, session) {
    const state = getState(session)
    return state.phase === 'ended'
  },

  isAwaitingInput(_group, session) {
    const state = getState(session)
    return state.phase !== 'ended'
  },

  resolveRound(_group, session) {
    const state = getState(session)
    if (state.winner) {
      const xpAwards: XpAward[] = state.alive.map(id => ({
        memberId: id,
        amount: WIN_XP,
        reason: `Victoire du camp ${state.winner}`,
      }))
      return {
        session: { ...session, status: 'ended', phase: 'ended', roundData: state },
        xpAwards,
      }
    }
    return { session }
  },
}