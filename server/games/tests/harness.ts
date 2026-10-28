/**
 * Banc d'essai des modules de jeu : rejoue exactement la boucle de `server/party.ts` (action →
 * settle → auto-résolution) sans socket ni base, et passe chaque vue par `sanitizeGroup` — ce que
 * reçoit réellement un téléphone. Deux garde-fous gratuits au passage :
 *  - l'état est sérialisé en JSON à chaque étape, comme en base : un module qui mute son état
 *    ou y range autre chose que des données simples casse ici, pas en soirée ;
 *  - `leaks()` cherche une valeur secrète dans la vue d'un joueur qui ne devrait pas la voir.
 */
import { getGame } from '../registry'
import { sanitizeGroup } from '../../store'
import type { StoredGroup, StoredMember } from '../../types'
import type { Group, PartySession } from '../../../src/types'
import type { GameModule, XpAward } from '../types'

export interface Room {
  group: StoredGroup
  ids: string[]
  host: string
  xp: Record<string, number>
  start(gameId: string, config?: unknown): void
  act(memberId: string, type: string, payload?: unknown): void
  advance(): void
  /** Ce que reçoit ce membre (`null` = la TV). */
  view<T = Record<string, unknown>>(memberId: string | null): T
  /** Le roundData brut côté serveur. */
  raw<T = Record<string, unknown>>(): T
  readonly phase: string | null
  readonly status: string
}

function member(i: number): StoredMember {
  return {
    id: `p${i}`,
    pseudo: `Joueur${i}`,
    color: '#fff',
    answers: {},
    scores: null,
    archetypeId: null,
    finishedAt: null,
    quizAttempt: 0,
    xp: 0,
    badges: [],
    gameStats: {},
    photoUrl: null,
    token: `t${i}`,
  }
}

export function makeRoom(players: number, opts: { adult?: boolean } = {}): Room {
  const members = Array.from({ length: players }, (_, i) => member(i))
  const group: StoredGroup = {
    id: 'g1',
    code: 'ABCDE',
    name: 'Test',
    createdAt: 0,
    members,
    adultModeEnabled: !!opts.adult,
    music: null,
    party: { status: 'lobby', hostMemberId: 'p0', currentGameId: null, phase: null, round: 0, roundData: null, participantIds: [] },
  }
  const xp: Record<string, number> = {}
  let game: GameModule | null = null

  const persist = () => {
    group.party = JSON.parse(JSON.stringify(group.party)) as PartySession
  }
  const award = (awards?: XpAward[]) => {
    for (const a of awards ?? []) xp[a.memberId] = (xp[a.memberId] ?? 0) + a.amount
  }
  const settle = (session: PartySession, awards?: XpAward[]) => {
    if (!game) throw new Error('no game')
    award(awards)
    group.party = session
    if (game.isRoundComplete(group as unknown as Group, group.party)) {
      const r = game.resolveRound(group as unknown as Group, group.party)
      award(r.xpAwards)
      group.party = r.session
    }
    persist()
  }

  return {
    group,
    ids: members.map((m) => m.id),
    host: 'p0',
    xp,
    start(gameId, config) {
      game = getGame(gameId)
      if (!game) throw new Error(`unknown game ${gameId}`)
      const err = game.canStart?.(group as unknown as Group)
      if (err) throw new Error(err)
      const session: PartySession = {
        status: 'lobby',
        hostMemberId: 'p0',
        currentGameId: gameId,
        phase: null,
        round: 0,
        roundData: null,
        participantIds: members.map((m) => m.id),
      }
      const r = game.initRound(group as unknown as Group, session, config)
      settle(r.session, r.xpAwards)
    },
    act(memberId, type, payload = {}) {
      if (!game) throw new Error('no game')
      const r = game.handleAction(group as unknown as Group, group.party, memberId, { type, payload })
      settle(r.session, r.xpAwards)
    },
    advance() {
      if (!game) throw new Error('no game')
      const g = group as unknown as Group
      const r = game.isAwaitingInput(g, group.party) ? game.resolveRound(g, group.party) : game.initRound(g, group.party)
      settle(r.session, r.xpAwards)
    },
    view<T>(memberId: string | null) {
      return sanitizeGroup(group, memberId).party.roundData as T
    },
    raw<T>() {
      return group.party.roundData as T
    },
    get phase() {
      return group.party.phase
    },
    get status() {
      return group.party.status
    },
  }
}

/** Vrai si `needle` apparaît quelque part dans la vue sérialisée. */
export function leaks(view: unknown, needle: string): boolean {
  return JSON.stringify(view).includes(needle)
}

/** Remonte le temps : décale toutes les échéances (`…EndsAt`, `…Deadline`) du roundData. */
export function expireTimers(room: Room, ms = 10 * 60_000): void {
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object') return
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === 'number' && /(EndsAt|endsAt|Deadline|deadline|EndTime|endTime)$/.test(k)) {
        ;(o as Record<string, unknown>)[k] = v - ms
      } else walk(v)
    }
  }
  walk(room.group.party.roundData)
}
