import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Group, Member } from '../types'
import { apiCreateGroup, apiJoinGroup, apiGetGroup, apiSaveAnswer, apiFinish, apiRestartQuiz, ApiError } from '../lib/api'

interface Identity {
  groupId: string
  memberId: string
  memberToken: string
}

interface AppState {
  identity: Identity | null
  group: Group | null
  loading: boolean
  error: string | null

  createGroup: (groupName: string, pseudo: string) => Promise<void>
  joinGroup: (code: string, pseudo: string) => Promise<void>
  refreshGroup: () => Promise<void>
  saveAnswer: (questionId: string, optionId: string) => Promise<void>
  finishQuestionnaire: () => Promise<void>
  /** Efface les réponses et passe au tirage suivant. */
  restartQuiz: () => Promise<void>
  leaveGroup: () => void
  clearError: () => void

  currentGroup: () => Group | null
  currentMember: () => Member | null
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      identity: null,
      group: null,
      loading: false,
      error: null,

      createGroup: async (groupName, pseudo) => {
        set({ loading: true, error: null })
        try {
          const { group, memberId, memberToken } = await apiCreateGroup(groupName, pseudo)
          set({ identity: { groupId: group.id, memberId, memberToken }, group, loading: false })
        } catch (e) {
          set({ loading: false, error: e instanceof ApiError ? e.message : 'Une erreur est survenue.' })
          throw e
        }
      },

      joinGroup: async (code, pseudo) => {
        set({ loading: true, error: null })
        try {
          const { group, memberId, memberToken } = await apiJoinGroup(code, pseudo)
          set({ identity: { groupId: group.id, memberId, memberToken }, group, loading: false })
        } catch (e) {
          set({ loading: false, error: e instanceof ApiError ? e.message : 'Une erreur est survenue.' })
          throw e
        }
      },

      refreshGroup: async () => {
        const { identity } = get()
        if (!identity) return
        try {
          const group = await apiGetGroup(identity.groupId, identity.memberId, identity.memberToken)
          set({ group, error: null })
        } catch (e) {
          set({ error: e instanceof ApiError ? e.message : 'Une erreur est survenue.' })
        }
      },

      saveAnswer: async (questionId, optionId) => {
        const { identity, group } = get()
        if (!identity || !group) return

        set({
          group: {
            ...group,
            members: group.members.map((m) =>
              m.id !== identity.memberId ? m : { ...m, answers: { ...m.answers, [questionId]: optionId } },
            ),
          },
        })

        await apiSaveAnswer(identity.groupId, identity.memberId, identity.memberToken, questionId, optionId)
      },

      finishQuestionnaire: async () => {
        const { identity } = get()
        if (!identity) return
        const group = await apiFinish(identity.groupId, identity.memberId, identity.memberToken)
        set({ group })
      },

      restartQuiz: async () => {
        const { identity } = get()
        if (!identity) return
        const group = await apiRestartQuiz(identity.groupId, identity.memberId, identity.memberToken)
        set({ group })
      },

      leaveGroup: () => set({ identity: null, group: null, error: null }),
      clearError: () => set({ error: null }),

      currentGroup: () => get().group,
      currentMember: () => {
        const { group, identity } = get()
        if (!group || !identity) return null
        return group.members.find((m) => m.id === identity.memberId) ?? null
      },
    }),
    {
      name: 'mindmatch-storage',
      partialize: (state) => ({ identity: state.identity }),
    },
  ),
)
