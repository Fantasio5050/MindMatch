import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Group, Member } from '../types'
import { computeScores, getArchetypeId } from '../lib/scoring'

const MEMBER_COLORS = ['#f472b6', '#60a5fa', '#fb923c', '#34d399', '#a78bfa', '#fbbf24', '#38bdf8', '#f87171']

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

interface AppState {
  groups: Group[]
  currentGroupId: string | null
  currentMemberId: string | null

  createGroup: (groupName: string, pseudo: string) => { groupId: string; memberId: string }
  joinGroup: (code: string, pseudo: string) => { groupId: string; memberId: string } | { error: string }
  saveAnswer: (questionId: string, optionId: string) => void
  finishQuestionnaire: () => void
  resetQuestionnaire: () => void
  leaveGroup: () => void
  setCurrentMember: (groupId: string, memberId: string) => void

  currentGroup: () => Group | null
  currentMember: () => Member | null
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      groups: [],
      currentGroupId: null,
      currentMemberId: null,

      createGroup: (groupName, pseudo) => {
        const groupId = makeId()
        const memberId = makeId()
        const member: Member = {
          id: memberId,
          pseudo: pseudo.trim(),
          color: MEMBER_COLORS[0],
          answers: {},
          scores: null,
          archetypeId: null,
          finishedAt: null,
        }
        const group: Group = {
          id: groupId,
          code: randomCode(),
          name: groupName.trim() || 'Mon groupe',
          createdAt: Date.now(),
          members: [member],
        }
        set((s) => ({
          groups: [...s.groups, group],
          currentGroupId: groupId,
          currentMemberId: memberId,
        }))
        return { groupId, memberId }
      },

      joinGroup: (code, pseudo) => {
        const normalized = code.trim().toUpperCase()
        const group = get().groups.find((g) => g.code === normalized)
        if (!group) return { error: 'Code introuvable. Vérifie et réessaie.' }
        if (group.members.some((m) => m.pseudo.toLowerCase() === pseudo.trim().toLowerCase())) {
          return { error: 'Ce pseudo est déjà pris dans ce groupe.' }
        }
        const memberId = makeId()
        const member: Member = {
          id: memberId,
          pseudo: pseudo.trim(),
          color: MEMBER_COLORS[group.members.length % MEMBER_COLORS.length],
          answers: {},
          scores: null,
          archetypeId: null,
          finishedAt: null,
        }
        set((s) => ({
          groups: s.groups.map((g) => (g.id === group.id ? { ...g, members: [...g.members, member] } : g)),
          currentGroupId: group.id,
          currentMemberId: memberId,
        }))
        return { groupId: group.id, memberId }
      },

      saveAnswer: (questionId, optionId) => {
        const { currentGroupId, currentMemberId } = get()
        if (!currentGroupId || !currentMemberId) return
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id !== currentGroupId
              ? g
              : {
                  ...g,
                  members: g.members.map((m) =>
                    m.id !== currentMemberId ? m : { ...m, answers: { ...m.answers, [questionId]: optionId } },
                  ),
                },
          ),
        }))
      },

      finishQuestionnaire: () => {
        const { currentGroupId, currentMemberId } = get()
        if (!currentGroupId || !currentMemberId) return
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id !== currentGroupId
              ? g
              : {
                  ...g,
                  members: g.members.map((m) => {
                    if (m.id !== currentMemberId) return m
                    const scores = computeScores(m.answers)
                    return { ...m, scores, archetypeId: getArchetypeId(scores), finishedAt: Date.now() }
                  }),
                },
          ),
        }))
      },

      resetQuestionnaire: () => {
        const { currentGroupId, currentMemberId } = get()
        if (!currentGroupId || !currentMemberId) return
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id !== currentGroupId
              ? g
              : {
                  ...g,
                  members: g.members.map((m) =>
                    m.id !== currentMemberId
                      ? m
                      : { ...m, answers: {}, scores: null, archetypeId: null, finishedAt: null },
                  ),
                },
          ),
        }))
      },

      leaveGroup: () => set({ currentGroupId: null, currentMemberId: null }),

      setCurrentMember: (groupId, memberId) => set({ currentGroupId: groupId, currentMemberId: memberId }),

      currentGroup: () => {
        const { groups, currentGroupId } = get()
        return groups.find((g) => g.id === currentGroupId) ?? null
      },
      currentMember: () => {
        const { groups, currentGroupId, currentMemberId } = get()
        const group = groups.find((g) => g.id === currentGroupId)
        return group?.members.find((m) => m.id === currentMemberId) ?? null
      },
    }),
    { name: 'mindmatch-storage' },
  ),
)
