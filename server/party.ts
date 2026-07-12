import { readDb, writeDb, appendGameHistory } from './db'
import type { StoredGroup } from './types'
import type { Group, PartySession } from '../src/types'
import { findAuthorizedMember, sanitizeGroup, isApiError, type ApiError } from './store'
import { getGame } from './games/registry'
import { evaluateBadges } from './badges'
import type { GameModule, XpAward } from './games/types'

const TRAIT_NUDGE = 4

function applyXpAwards(group: StoredGroup, awards: XpAward[] | undefined): void {
  if (!awards) return
  for (const award of awards) {
    const member = group.members.find((m) => m.id === award.memberId)
    if (!member) continue

    member.xp += award.amount
    if (award.trait && member.scores) {
      const current = member.scores[award.trait]
      member.scores[award.trait] = Math.max(0, Math.min(100, current + TRAIT_NUDGE))
    }
    if (award.statIncrements) {
      for (const [key, amount] of Object.entries(award.statIncrements)) {
        member.gameStats[key] = (member.gameStats[key] ?? 0) + amount
      }
    }
    member.badges = evaluateBadges(member)
  }
}

/** Applies a round transition (session + xpAwards), then auto-resolves if the game says it's
 * already trivially complete (e.g. nobody in the room could act this round). Also records a
 * durable game_history entry the moment a game naturally finishes (status flips to 'ended') —
 * separate from `group.party.roundData`, which gets overwritten the next time a game starts. */
function settle(group: StoredGroup, game: GameModule, session: PartySession, xpAwards: XpAward[] | undefined): void {
  const wasEnded = group.party.status === 'ended'
  applyXpAwards(group, xpAwards)
  group.party = session
  if (game.isRoundComplete(group, group.party)) {
    const resolved = game.resolveRound(group, group.party)
    applyXpAwards(group, resolved.xpAwards)
    group.party = resolved.session
  }
  if (!wasEnded && group.party.status === 'ended') {
    appendGameHistory({
      groupId: group.id,
      gameId: game.id,
      gameName: game.name,
      endedAt: Date.now(),
      roundsPlayed: group.party.round,
    })
  }
}

function emptySession(hostMemberId: string, gameId: string | null): PartySession {
  return { status: 'lobby', hostMemberId, currentGameId: gameId, phase: null, round: 0, roundData: null }
}

export function startGame(
  groupId: string,
  memberId: string,
  memberToken: string,
  gameId: string,
  config?: unknown,
): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result
  const { group } = result

  if (group.party.hostMemberId !== memberId) {
    return { error: "Seul·e l'hôte peut lancer une partie.", status: 403 }
  }
  const game = getGame(gameId)
  if (!game) return { error: 'Jeu introuvable.', status: 404 }
  if (group.members.length < game.minPlayers) {
    return { error: `Il faut au moins ${game.minPlayers} joueurs pour ce jeu.`, status: 400 }
  }
  const canStartError = game.canStart?.(group)
  if (canStartError) return { error: canStartError, status: 400 }

  const { session, xpAwards } = game.initRound(group, emptySession(group.party.hostMemberId, gameId), config)
  settle(group, game, session, xpAwards)
  writeDb(db)

  return { group: sanitizeGroup(group, memberId) }
}

export function submitAction(
  groupId: string,
  memberId: string,
  memberToken: string,
  actionType: string,
  payload: unknown,
): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result
  const { group } = result

  const game = group.party.currentGameId ? getGame(group.party.currentGameId) : null
  if (!game) return { error: 'Aucune partie en cours.', status: 400 }

  const actionResult = game.handleAction(group, group.party, memberId, { type: actionType, payload })
  settle(group, game, actionResult.session, actionResult.xpAwards)

  writeDb(db)
  return { group: sanitizeGroup(group, memberId) }
}

export function hostAdvance(groupId: string, memberId: string, memberToken: string): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result
  const { group } = result

  if (group.party.hostMemberId !== memberId) {
    return { error: "Seul·e l'hôte peut faire avancer la partie.", status: 403 }
  }
  const game = group.party.currentGameId ? getGame(group.party.currentGameId) : null
  if (!game) return { error: 'Aucune partie en cours.', status: 400 }

  if (game.isAwaitingInput(group, group.party)) {
    const resolved = game.resolveRound(group, group.party)
    settle(group, game, resolved.session, resolved.xpAwards)
  } else {
    const next = game.initRound(group, group.party)
    settle(group, game, next.session, next.xpAwards)
  }

  writeDb(db)
  return { group: sanitizeGroup(group, memberId) }
}

export function endGame(groupId: string, memberId: string, memberToken: string): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result
  const { group } = result

  if (group.party.hostMemberId !== memberId) {
    return { error: "Seul·e l'hôte peut terminer la partie.", status: 403 }
  }
  group.party = emptySession(group.party.hostMemberId, null)
  writeDb(db)
  return { group: sanitizeGroup(group, memberId) }
}

export function setAdultMode(
  groupId: string,
  memberId: string,
  memberToken: string,
  enabled: boolean,
): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result
  const { group } = result

  if (group.party.hostMemberId !== memberId) {
    return { error: "Seul·e l'hôte peut changer ce réglage.", status: 403 }
  }
  group.adultModeEnabled = enabled
  writeDb(db)
  return { group: sanitizeGroup(group, memberId) }
}
