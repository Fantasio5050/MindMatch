import { readDb, writeDb } from './db'
import type { StoredGroup, StoredMember } from './types'
import type { Group, Member } from '../src/types'
import { computeScores, getArchetypeId } from '../src/lib/scoring'
import { questions } from '../src/data/questions'

const MEMBER_COLORS = ['#f472b6', '#60a5fa', '#fb923c', '#34d399', '#a78bfa', '#fbbf24', '#38bdf8', '#f87171']
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomString(length: number, alphabet: string): string {
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function makeId(): string {
  return randomString(12, 'abcdefghijklmnopqrstuvwxyz0123456789')
}

function makeToken(): string {
  return randomString(32, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
}

function generateUniqueCode(db: { groups: StoredGroup[] }): string {
  let code = randomString(5, CODE_CHARS)
  while (db.groups.some((g) => g.code === code)) {
    code = randomString(5, CODE_CHARS)
  }
  return code
}

export type ApiError = { error: string; status: number }

export function isApiError(x: unknown): x is ApiError {
  return typeof x === 'object' && x !== null && 'error' in x && 'status' in x
}

export function sanitizeMember(member: StoredMember, isSelf: boolean): Member {
  const { token, answers, ...rest } = member
  void token
  return {
    ...rest,
    answers: isSelf ? answers : {},
  }
}

export function sanitizeGroup(group: StoredGroup, requestingMemberId: string | null): Group {
  return {
    ...group,
    members: group.members.map((m) => sanitizeMember(m, m.id === requestingMemberId)),
  }
}

export function createGroup(groupName: string, pseudo: string): { group: Group; memberId: string; memberToken: string } {
  const db = readDb()
  const groupId = makeId()
  const memberId = makeId()
  const token = makeToken()

  const member: StoredMember = {
    id: memberId,
    pseudo: pseudo.trim().slice(0, 24),
    color: MEMBER_COLORS[0],
    answers: {},
    scores: null,
    archetypeId: null,
    finishedAt: null,
    token,
  }

  const group: StoredGroup = {
    id: groupId,
    code: generateUniqueCode(db),
    name: groupName.trim().slice(0, 40) || 'Mon groupe',
    createdAt: Date.now(),
    members: [member],
  }

  db.groups.push(group)
  writeDb(db)

  return { group: sanitizeGroup(group, memberId), memberId, memberToken: token }
}

export function joinGroup(
  code: string,
  pseudo: string,
): { group: Group; memberId: string; memberToken: string } | ApiError {
  const db = readDb()
  const normalized = code.trim().toUpperCase()
  const group = db.groups.find((g) => g.code === normalized)
  if (!group) return { error: 'Code introuvable. Vérifie et réessaie.', status: 404 }

  const trimmedPseudo = pseudo.trim().slice(0, 24)
  if (group.members.some((m) => m.pseudo.toLowerCase() === trimmedPseudo.toLowerCase())) {
    return { error: 'Ce pseudo est déjà pris dans ce groupe.', status: 409 }
  }

  const memberId = makeId()
  const token = makeToken()
  const member: StoredMember = {
    id: memberId,
    pseudo: trimmedPseudo,
    color: MEMBER_COLORS[group.members.length % MEMBER_COLORS.length],
    answers: {},
    scores: null,
    archetypeId: null,
    finishedAt: null,
    token,
  }
  group.members.push(member)
  writeDb(db)

  return { group: sanitizeGroup(group, memberId), memberId, memberToken: token }
}

function findAuthorizedMember(
  db: { groups: StoredGroup[] },
  groupId: string,
  memberId: string,
  memberToken: string,
): { group: StoredGroup; member: StoredMember } | ApiError {
  const group = db.groups.find((g) => g.id === groupId)
  if (!group) return { error: 'Groupe introuvable.', status: 404 }
  const member = group.members.find((m) => m.id === memberId)
  if (!member) return { error: 'Membre introuvable.', status: 404 }
  if (member.token !== memberToken) return { error: 'Non autorisé.', status: 403 }
  return { group, member }
}

export function getGroup(groupId: string, memberId: string | null, memberToken: string | null): Group | ApiError {
  const db = readDb()
  const group = db.groups.find((g) => g.id === groupId)
  if (!group) return { error: 'Groupe introuvable.', status: 404 }

  let verifiedMemberId: string | null = null
  if (memberId && memberToken) {
    const member = group.members.find((m) => m.id === memberId)
    if (member && member.token === memberToken) verifiedMemberId = memberId
  }
  return sanitizeGroup(group, verifiedMemberId)
}

export function saveAnswer(
  groupId: string,
  memberId: string,
  memberToken: string,
  questionId: string,
  optionId: string,
): { ok: true } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result

  const question = questions.find((q) => q.id === questionId)
  if (!question || !question.options.some((o) => o.id === optionId)) {
    return { error: 'Question ou réponse invalide.', status: 400 }
  }
  if (result.member.finishedAt) {
    return { error: 'Questionnaire déjà terminé.', status: 409 }
  }

  result.member.answers[questionId] = optionId
  writeDb(db)
  return { ok: true }
}

export function finishMember(
  groupId: string,
  memberId: string,
  memberToken: string,
): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result

  const scores = computeScores(result.member.answers)
  result.member.scores = scores
  result.member.archetypeId = getArchetypeId(scores)
  result.member.finishedAt = Date.now()
  writeDb(db)

  return { group: sanitizeGroup(result.group, memberId) }
}
