import type { Group, GameHistoryEntry } from '../types'

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('Impossible de contacter le serveur. Vérifie ta connexion.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error || `Erreur serveur (${res.status})`)
  }
  return res.json() as Promise<T>
}

export interface JoinResult {
  group: Group
  memberId: string
  memberToken: string
}

export function apiCreateGroup(groupName: string, pseudo: string): Promise<JoinResult> {
  return request<JoinResult>('/groups', { method: 'POST', body: JSON.stringify({ groupName, pseudo }) })
}

export function apiJoinGroup(code: string, pseudo: string): Promise<JoinResult> {
  return request<JoinResult>('/groups/join', { method: 'POST', body: JSON.stringify({ code, pseudo }) })
}

export async function apiGetGroup(groupId: string, memberId: string, memberToken: string): Promise<Group> {
  const params = new URLSearchParams({ memberId, memberToken })
  const { group } = await request<{ group: Group }>(`/groups/${groupId}?${params.toString()}`)
  return group
}

export function apiSaveAnswer(
  groupId: string,
  memberId: string,
  memberToken: string,
  questionId: string,
  optionId: string,
): Promise<{ ok: true }> {
  return request(`/groups/${groupId}/members/${memberId}/answer`, {
    method: 'PUT',
    body: JSON.stringify({ memberToken, questionId, optionId }),
  })
}

export async function apiFinish(groupId: string, memberId: string, memberToken: string): Promise<Group> {
  const { group } = await request<{ group: Group }>(`/groups/${groupId}/members/${memberId}/finish`, {
    method: 'POST',
    body: JSON.stringify({ memberToken }),
  })
  return group
}

export async function apiGetGameHistory(
  groupId: string,
  memberId: string,
  memberToken: string,
): Promise<GameHistoryEntry[]> {
  const params = new URLSearchParams({ memberId, memberToken })
  const { history } = await request<{ history: GameHistoryEntry[] }>(`/groups/${groupId}/history?${params.toString()}`)
  return history
}
