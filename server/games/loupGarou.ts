import type { Group, PartySession } from '../../src/types'
import type { GameModule, XpAward } from './types'
import { NIGHT_ORDER, computeRoleCounts, type NightStep, type RoleId } from '../../src/data/loupGarou'

/**
 * Loup-Garou de Thiercelieux — serveur autoritaire.
 *
 * Réécrit : la version précédente était injouable et, surtout, publique.
 *  - Tous les rôles partaient en clair à chaque téléphone et à la TV (`roleByMember`), comme la
 *    cible des loups, leurs votes et le couple d'amoureux. Le client, lui, attendait un `yourRole`
 *    que rien ne produisait : personne ne connaissait son rôle à l'écran.
 *  - La nuit ne finissait jamais : l'étape « petite fille » était toujours appelée, mais aucune
 *    action ne permettait de la terminer.
 *  - Le passage du jour au vote était inatteignable (le bouton de l'hôte ne faisait rien).
 *  - Cupidon relançait un couple chaque nuit ; le chasseur mort la nuit ne tirait pas ; la
 *    sorcière pouvait réutiliser ses potions ; le salvateur protéger deux fois de suite la même
 *    personne ; la voyante ne voyait jamais son résultat (l'étape passait avant l'affichage).
 *
 * Choix de règles (application de soirée, sans meneur humain) :
 *  - Petite fille : chaque nuit elle choisit d'espionner ou de dormir. Espionner lui montre UN
 *    loup vivant au hasard — mais les loups apprennent la nuit suivante qu'ils ont été vus, et
 *    par qui. Grosse information, gros risque. (L'ancienne version lui donnait la liste complète
 *    des loups dès la première nuit : partie pliée.)
 *  - Égalité au vote du village : personne n'est éliminé. Égalité chez les loups : tirage au sort.
 *  - L'hôte peut toujours débloquer : sauter l'étape d'un joueur absent, clore un vote.
 */

type Phase = 'role-reveal' | 'night' | 'day' | 'vote' | 'reveal' | 'hunter-shot' | 'ended'
type Winner = 'village' | 'loups' | 'lovers'

const VOTE_XP = 1
const WIN_XP = 10

interface Death {
  memberId: string
  role: RoleId
  cause: string
  day: number
}

interface LoupGarouState {
  phase: Phase
  players: string[]
  roleByMember: Record<string, RoleId>
  alive: string[]
  dead: Death[]
  dayNumber: number
  lovers: [string, string] | null
  /** Étapes de nuit restantes (l'étape courante en tête). */
  nightQueue: NightStep[]
  step: NightStep | null
  nightVotes: Record<string, string>
  killTarget: string | null
  protectedTarget: string | null
  salvateurLast: string | null
  healUsed: boolean
  poisonUsed: boolean
  healedTonight: boolean
  poisonTarget: string | null
  voyanteResult: { memberId: string; role: RoleId } | null
  /** Nuit de la dernière consultation : une seule par nuit. */
  voyanteCheckedNight: number | null
  petiteFilleSeen: string | null
  /** La petite fille a espionné : les loups l'apprennent la nuit suivante. */
  spiedBy: string | null
  spyRevealedToWolves: boolean
  dayVotes: Record<string, string>
  voteResults: Record<string, number> | null
  lastNightDeaths: string[]
  /** Morts depuis l'ouverture du vote (élu du village, tir du chasseur, chagrin) — index dans `dead`. */
  voteDeathsFrom: number
  pendingHunter: string | null
  afterHunter: 'day' | 'reveal'
  winner: Winner | null
  history: { day: number; event: string }[]
}

function getState(session: PartySession): LoupGarouState | null {
  return session.roundData as LoupGarouState | null
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const STEP_ROLE: Record<NightStep, RoleId> = {
  cupidon: 'cupidon',
  voyante: 'voyante',
  salvateur: 'salvateur',
  loups: 'loup-garou',
  sorciere: 'sorciere',
  'petite-fille': 'petite-fille',
}

function assignRoles(players: string[]): Record<string, RoleId> {
  const counts = computeRoleCounts(players.length)
  const pool: RoleId[] = []
  // Les loups d'abord : si la table est trop petite pour tous les rôles, ce sont les rôles
  // spéciaux (en fin de liste) qui sautent, jamais les loups.
  const order: RoleId[] = ['loup-garou', 'voyante', 'sorciere', 'chasseur', 'cupidon', 'salvateur', 'petite-fille', 'villageois']
  for (const role of order) for (let i = 0; i < (counts[role] ?? 0); i++) pool.push(role)
  while (pool.length < players.length) pool.push('villageois')
  const dealt = shuffle(pool.slice(0, players.length))
  return Object.fromEntries(players.map((id, i) => [id, dealt[i]]))
}

const isWolf = (s: LoupGarouState, id: string) => s.roleByMember[id] === 'loup-garou'
const aliveWith = (s: LoupGarouState, role: RoleId) => s.alive.filter((id) => s.roleByMember[id] === role)
const actorOf = (s: LoupGarouState, step: NightStep) => aliveWith(s, STEP_ROLE[step])[0] ?? null

function clone(s: LoupGarouState): LoupGarouState {
  return {
    ...s,
    alive: [...s.alive],
    dead: [...s.dead],
    nightQueue: [...s.nightQueue],
    nightVotes: { ...s.nightVotes },
    dayVotes: { ...s.dayVotes },
    history: [...s.history],
  }
}

function checkWinner(s: LoupGarouState): Winner | null {
  const wolves = s.alive.filter((id) => isWolf(s, id)).length
  const others = s.alive.length - wolves
  if (s.lovers && s.alive.length === 2 && s.lovers.every((id) => s.alive.includes(id))) {
    const mixed = isWolf(s, s.lovers[0]) !== isWolf(s, s.lovers[1])
    if (mixed) return 'lovers'
  }
  if (wolves === 0) return 'village'
  if (wolves >= others) return 'loups'
  return null
}

/** Tue un joueur (et son amoureux·se, par chagrin). Retourne les morts, dans l'ordre. */
function kill(s: LoupGarouState, id: string, cause: string): string[] {
  if (!s.alive.includes(id)) return []
  s.alive = s.alive.filter((x) => x !== id)
  s.dead.push({ memberId: id, role: s.roleByMember[id], cause, day: s.dayNumber })
  const out = [id]
  if (s.lovers?.includes(id)) {
    const other = s.lovers.find((x) => x !== id)!
    out.push(...kill(s, other, 'chagrin d’amour'))
  }
  // Le chasseur tire en mourant, quelle que soit la cause de sa mort.
  if (s.roleByMember[id] === 'chasseur') s.pendingHunter = id
  return out
}

function finishIfWon(s: LoupGarouState): boolean {
  const w = checkWinner(s)
  if (!w) return false
  s.winner = w
  s.phase = 'ended'
  s.step = null
  s.pendingHunter = null
  return true
}

/** Passe à l'étape de nuit suivante dont l'acteur est vivant ; plus d'étape = aube. */
function nextStep(s: LoupGarouState): void {
  while (s.nightQueue.length > 0) {
    const step = s.nightQueue.shift()!
    if (actorOf(s, step)) {
      s.step = step
      return
    }
  }
  s.step = null
  dawn(s)
}

function beginNight(s: LoupGarouState, first: boolean): void {
  if (!first) s.dayNumber += 1
  s.phase = 'night'
  s.nightVotes = {}
  s.killTarget = null
  s.protectedTarget = null
  s.healedTonight = false
  s.poisonTarget = null
  s.petiteFilleSeen = null
  s.voteResults = null
  s.dayVotes = {}
  // Les loups apprennent qu'on les a espionnés la nuit suivant l'espionnage.
  s.spyRevealedToWolves = !!s.spiedBy
  s.nightQueue = NIGHT_ORDER.filter((step) => step !== 'cupidon' || (first && !s.lovers))
  nextStep(s)
}

/** Fin de nuit : on applique les morts, puis le chasseur éventuel, puis le jour. */
function dawn(s: LoupGarouState): void {
  const deaths: string[] = []
  const eaten = s.killTarget && s.killTarget !== s.protectedTarget && !s.healedTonight ? s.killTarget : null
  if (eaten) deaths.push(...kill(s, eaten, 'dévoré·e par les loups'))
  if (s.poisonTarget) deaths.push(...kill(s, s.poisonTarget, 'empoisonné·e'))
  s.lastNightDeaths = deaths
  s.history.push({ day: s.dayNumber, event: deaths.length ? `Nuit ${s.dayNumber} : ${deaths.length} mort(s)` : `Nuit ${s.dayNumber} : aucun mort` })
  if (finishIfWon(s)) return
  if (s.pendingHunter) {
    s.phase = 'hunter-shot'
    s.afterHunter = 'day'
  } else {
    s.phase = 'day'
  }
}

function tallyVote(s: LoupGarouState): XpAward[] {
  s.voteDeathsFrom = s.dead.length
  const counts: Record<string, number> = {}
  for (const t of Object.values(s.dayVotes)) counts[t] = (counts[t] ?? 0) + 1
  s.voteResults = counts
  const max = Math.max(0, ...Object.values(counts))
  const top = Object.keys(counts).filter((id) => counts[id] === max)
  const xp: XpAward[] = Object.keys(s.dayVotes).map((id) => ({ memberId: id, amount: VOTE_XP, reason: 'A voté au conseil du village' }))
  if (top.length === 1 && max > 0) {
    kill(s, top[0], 'vote du village')
    s.history.push({ day: s.dayNumber, event: `Jour ${s.dayNumber} : le village élimine un joueur` })
  } else {
    s.history.push({ day: s.dayNumber, event: `Jour ${s.dayNumber} : égalité, personne n'est éliminé` })
  }
  if (finishIfWon(s)) return xp
  if (s.pendingHunter) {
    s.phase = 'hunter-shot'
    s.afterHunter = 'reveal'
  } else {
    s.phase = 'reveal'
  }
  return xp
}

function winXp(s: LoupGarouState): XpAward[] {
  if (!s.winner) return []
  const winners = s.players.filter((id) =>
    s.winner === 'lovers' ? s.lovers?.includes(id) : s.winner === 'loups' ? isWolf(s, id) : !isWolf(s, id),
  )
  return winners.map((id) => ({ memberId: id, amount: WIN_XP, statIncrements: { 'loupGarou.wins': 1 }, reason: 'Victoire au Loup-Garou' }))
}

function out(session: PartySession, s: LoupGarouState, xp: XpAward[] = []): { session: PartySession; xpAwards: XpAward[] } {
  const ended = s.phase === 'ended'
  return {
    session: { ...session, status: ended ? 'ended' : 'playing', phase: s.phase, round: s.dayNumber, roundData: s },
    xpAwards: ended ? [...xp, ...winXp(s)] : xp,
  }
}

export const loupGarou: GameModule = {
  id: 'loup-garou',
  name: 'Loup-Garou',
  icon: '🐺',
  minPlayers: 8,

  initRound(_group: Group, session) {
    const state = getState(session)
    if (session.round === 0 || !state) {
      const players = [...session.participantIds]
      const s: LoupGarouState = {
        phase: 'role-reveal',
        players,
        roleByMember: assignRoles(players),
        alive: [...players],
        dead: [],
        dayNumber: 1,
        lovers: null,
        nightQueue: [],
        step: null,
        nightVotes: {},
        killTarget: null,
        protectedTarget: null,
        salvateurLast: null,
        healUsed: false,
        poisonUsed: false,
        healedTonight: false,
        poisonTarget: null,
        voteResults: null,
        voyanteResult: null,
        voyanteCheckedNight: null,
        petiteFilleSeen: null,
        spiedBy: null,
        spyRevealedToWolves: false,
        dayVotes: {},
        lastNightDeaths: [],
        voteDeathsFrom: 0,
        pendingHunter: null,
        afterHunter: 'day',
        winner: null,
        history: [],
      }
      return { session: { ...session, status: 'playing', phase: s.phase, round: 1, roundData: s } }
    }
    // Hôte : les transitions « hors saisie » — lancer la nuit, ouvrir le vote.
    const s = clone(state)
    if (s.phase === 'role-reveal') beginNight(s, true)
    else if (s.phase === 'day') {
      s.phase = 'vote'
      s.dayVotes = {}
    } else if (s.phase === 'reveal') beginNight(s, false)
    else return { session }
    return out(session, s)
  },

  handleAction(_group, session, memberId, action) {
    const state = getState(session)
    if (!state || !state.players.includes(memberId)) return { session }
    const payload = (action.payload ?? {}) as { targetId?: string; target1?: string; target2?: string }
    const alive = (id?: string): id is string => !!id && state.alive.includes(id)
    const isHost = memberId === session.hostMemberId

    if (action.type === 'start' && isHost && state.phase === 'role-reveal') {
      const s = clone(state)
      beginNight(s, true)
      return out(session, s)
    }

    // ─── Nuit ────────────────────────────────────────────────────────────
    if (state.phase === 'night' && state.step) {
      const step = state.step
      const actor = actorOf(state, step)
      const s = clone(state)

      if (step === 'loups' && action.type === 'loup-vote') {
        if (!isWolf(state, memberId) || !alive(memberId) || !alive(payload.targetId) || isWolf(state, payload.targetId)) return { session }
        s.nightVotes[memberId] = payload.targetId
        const pack = aliveWith(s, 'loup-garou')
        if (pack.every((id) => id in s.nightVotes)) {
          const counts: Record<string, number> = {}
          for (const t of Object.values(s.nightVotes)) counts[t] = (counts[t] ?? 0) + 1
          const max = Math.max(...Object.values(counts))
          const top = Object.keys(counts).filter((id) => counts[id] === max)
          s.killTarget = top[Math.floor(Math.random() * top.length)]
          nextStep(s)
        }
        return out(session, s)
      }

      if (memberId !== actor) return { session }

      if (step === 'cupidon' && action.type === 'cupidon-link') {
        const { target1, target2 } = payload
        if (!alive(target1) || !alive(target2) || target1 === target2) return { session }
        s.lovers = [target1, target2]
        nextStep(s)
        return out(session, s)
      }

      if (step === 'voyante') {
        // L'examen et la fin de tour sont deux gestes : sinon l'étape passait avant que la voyante
        // ait vu son résultat.
        if (action.type === 'voyante-check') {
          if (state.voyanteCheckedNight === state.dayNumber) return { session }
          if (!alive(payload.targetId) || payload.targetId === memberId) return { session }
          s.voyanteResult = { memberId: payload.targetId, role: s.roleByMember[payload.targetId] }
          s.voyanteCheckedNight = s.dayNumber
          return out(session, s)
        }
        if (action.type === 'voyante-done') {
          nextStep(s)
          return out(session, s)
        }
        return { session }
      }

      if (step === 'salvateur' && action.type === 'salvateur-protect') {
        if (!alive(payload.targetId) || payload.targetId === state.salvateurLast) return { session }
        s.protectedTarget = payload.targetId
        s.salvateurLast = payload.targetId
        nextStep(s)
        return out(session, s)
      }

      if (step === 'sorciere') {
        if (action.type === 'sorciere-heal') {
          if (state.healUsed || !state.killTarget) return { session }
          s.healUsed = true
          s.healedTonight = true
          return out(session, s)
        }
        if (action.type === 'sorciere-kill') {
          if (state.poisonUsed || !alive(payload.targetId)) return { session }
          s.poisonUsed = true
          s.poisonTarget = payload.targetId
          return out(session, s)
        }
        if (action.type === 'sorciere-pass' || action.type === 'sorciere-done') {
          nextStep(s)
          return out(session, s)
        }
        return { session }
      }

      if (step === 'petite-fille') {
        if (action.type === 'petite-fille-spy') {
          const pack = aliveWith(s, 'loup-garou')
          s.petiteFilleSeen = pack[Math.floor(Math.random() * pack.length)] ?? null
          s.spiedBy = memberId
          return out(session, s)
        }
        if (action.type === 'petite-fille-sleep' || action.type === 'petite-fille-done') {
          nextStep(s)
          return out(session, s)
        }
        return { session }
      }
      return { session }
    }

    // ─── Vote du village ─────────────────────────────────────────────────
    if (state.phase === 'vote' && action.type === 'day-vote') {
      if (!alive(memberId) || !alive(payload.targetId) || payload.targetId === memberId) return { session }
      const s = clone(state)
      s.dayVotes[memberId] = payload.targetId
      if (s.alive.every((id) => id in s.dayVotes)) return out(session, s, tallyVote(s))
      return out(session, s)
    }

    // ─── Tir du chasseur ─────────────────────────────────────────────────
    if (state.phase === 'hunter-shot' && action.type === 'hunter-shoot' && memberId === state.pendingHunter) {
      if (!alive(payload.targetId)) return { session }
      const s = clone(state)
      s.pendingHunter = null
      kill(s, payload.targetId, 'abattu·e par le chasseur')
      if (!finishIfWon(s)) {
        // Un amoureux chasseur emporté par chagrin a lui aussi droit à son tir.
        if (!s.pendingHunter) s.phase = s.afterHunter
      }
      return out(session, s)
    }

    return { session }
  },

  isRoundComplete() {
    return false
  },

  isAwaitingInput(_group, session) {
    const p = getState(session)?.phase
    return p === 'night' || p === 'vote' || p === 'hunter-shot'
  },

  /** Hôte : sauter l'étape d'un joueur absent, clore le vote, ou le chasseur renonce à tirer. */
  resolveRound(_group, session) {
    const state = getState(session)
    if (!state) return { session }
    const s = clone(state)
    if (s.phase === 'night') {
      // Loups indécis : la cible la plus votée jusqu'ici (s'il y en a une).
      if (s.step === 'loups' && Object.keys(s.nightVotes).length > 0) {
        const counts: Record<string, number> = {}
        for (const t of Object.values(s.nightVotes)) counts[t] = (counts[t] ?? 0) + 1
        const max = Math.max(...Object.values(counts))
        const top = Object.keys(counts).filter((id) => counts[id] === max)
        s.killTarget = top[Math.floor(Math.random() * top.length)]
      }
      nextStep(s)
      return out(session, s)
    }
    if (s.phase === 'vote') return out(session, s, tallyVote(s))
    if (s.phase === 'hunter-shot') {
      s.pendingHunter = null
      s.phase = s.afterHunter
      return out(session, s)
    }
    return { session }
  },

  viewFor(group, session, memberId) {
    const s = getState(session)
    if (!s) return null
    const me = memberId && s.players.includes(memberId) ? memberId : null
    const role = me ? s.roleByMember[me] : null
    const iAmAlive = !!me && s.alive.includes(me)
    const wolf = role === 'loup-garou'
    const ended = s.phase === 'ended'
    const step = s.phase === 'night' ? s.step : null
    const yourStep = !!step && iAmAlive && (step === 'loups' ? wolf : actorOf(s, step) === me)
    const lover = me && s.lovers?.includes(me) ? s.lovers.find((x) => x !== me)! : null
    const loverMember = lover ? group.members.find((m) => m.id === lover) : null

    return {
      phase: s.phase,
      dayNumber: s.dayNumber,
      alive: s.alive,
      dead: s.dead,
      players: s.players,
      // Narration (TV comprise) : quelle étape se joue, jamais qui la joue.
      currentNightStep: step,
      nightStep: step,
      yourStep,
      currentVoter: yourStep ? me : null,
      yourRole: role,
      yourLover: loverMember ? { memberId: loverMember.id, pseudo: loverMember.pseudo } : null,
      // Ce qui n'appartient qu'à un rôle :
      loupsMembers: wolf || ended ? aliveWith(s, 'loup-garou').concat(s.dead.filter((d) => d.role === 'loup-garou').map((d) => d.memberId)) : null,
      nightVotes: wolf && step === 'loups' ? s.nightVotes : {},
      spiedBy: wolf && s.spyRevealedToWolves ? s.spiedBy : null,
      killTarget: (wolf && step === 'loups') || (role === 'sorciere' && step === 'sorciere') ? s.killTarget : null,
      sorciereHealUsed: role === 'sorciere' ? s.healUsed : false,
      sorciereKillUsed: role === 'sorciere' ? s.poisonUsed : false,
      healedThisNight: role === 'sorciere' && step === 'sorciere' ? s.healedTonight : false,
      poisonTarget: role === 'sorciere' && step === 'sorciere' ? s.poisonTarget : null,
      salvateurLast: role === 'salvateur' ? s.salvateurLast : null,
      protectedTarget: null,
      voyanteResult: role === 'voyante' ? s.voyanteResult : null,
      voyanteCheckedTonight: role === 'voyante' && step === 'voyante' && s.voyanteCheckedNight === s.dayNumber,
      petiteFilleInfo: role === 'petite-fille' && s.petiteFilleSeen ? [s.petiteFilleSeen] : null,
      // Public :
      lastNightDeaths: s.lastNightDeaths,
      dayDeaths: s.phase === 'reveal' || (s.phase === 'hunter-shot' && s.afterHunter === 'reveal') ? s.dead.slice(s.voteDeathsFrom) : [],
      dayVotes: s.phase === 'vote' || s.phase === 'reveal' || s.phase === 'hunter-shot' ? s.dayVotes : {},
      voteResults: s.voteResults,
      hunterId: s.phase === 'hunter-shot' ? s.pendingHunter : null,
      winner: s.winner,
      history: s.history,
      // Fin de partie : tout se dévoile.
      allRoles: ended ? s.roleByMember : null,
      lovers: ended ? s.lovers : null,
    }
  },
}
