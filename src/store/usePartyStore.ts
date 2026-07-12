import { create } from 'zustand'
import type { Socket } from 'socket.io-client'
import type { Group, Member } from '../types'
import { useAppStore } from './useAppStore'
import { connectSocket, disconnectSocket } from '../lib/socket'

interface PartyState {
  socket: Socket | null
  connected: boolean
  group: Group | null
  onlinePlayerIds: string[]
  isSpectator: boolean
  error: string | null

  connectAsPlayer: () => void
  connectAsSpectator: (code: string) => void
  disconnect: () => void
  startGame: (gameId: string, config?: unknown) => void
  sendAction: (type: string, payload: unknown) => void
  hostAdvance: () => void
  endGame: () => void
  setAdultMode: (enabled: boolean) => void
  clearError: () => void

  currentMember: () => Member | null
  isHost: () => boolean
}

export const usePartyStore = create<PartyState>((set, get) => {
  function wire(socket: Socket) {
    socket.on('connect', () => set({ connected: true }))
    socket.on('disconnect', () => set({ connected: false }))
    socket.on('room:update', (msg: { group: Group; onlinePlayerIds: string[] }) =>
      set({ group: msg.group, onlinePlayerIds: msg.onlinePlayerIds }),
    )
    socket.on('party:error', (msg: { error: string }) => set({ error: msg.error }))
  }

  return {
    socket: null,
    connected: false,
    group: null,
    onlinePlayerIds: [],
    isSpectator: false,
    error: null,

    connectAsPlayer: () => {
      if (get().socket && !get().isSpectator) return // already connected, reused across party pages
      const identity = useAppStore.getState().identity
      if (!identity) return
      const socket = connectSocket({
        groupId: identity.groupId,
        memberId: identity.memberId,
        memberToken: identity.memberToken,
      })
      wire(socket)
      set({ socket, isSpectator: false, error: null })
    },

    connectAsSpectator: (code) => {
      const socket = connectSocket({ spectatorCode: code })
      wire(socket)
      set({ socket, isSpectator: true, error: null })
    },

    disconnect: () => {
      disconnectSocket()
      set({ socket: null, connected: false, group: null })
    },

    startGame: (gameId, config) => get().socket?.emit('party:start', { gameId, config }),
    sendAction: (type, payload) => get().socket?.emit('party:action', { type, payload }),
    hostAdvance: () => get().socket?.emit('party:hostAdvance'),
    endGame: () => get().socket?.emit('party:endGame'),
    setAdultMode: (enabled) => get().socket?.emit('party:setAdultMode', { enabled }),
    clearError: () => set({ error: null }),

    currentMember: () => {
      const { group } = get()
      const memberId = useAppStore.getState().identity?.memberId
      if (!group || !memberId) return null
      return group.members.find((m) => m.id === memberId) ?? null
    },

    isHost: () => {
      const { group } = get()
      const memberId = useAppStore.getState().identity?.memberId
      return !!group && !!memberId && group.party.hostMemberId === memberId
    },
  }
})
