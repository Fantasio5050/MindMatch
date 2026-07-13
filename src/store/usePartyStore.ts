import { create } from 'zustand'
import type { Socket } from 'socket.io-client'
import type { Group, Member } from '../types'
import type { EmoteEvent } from '../data/emotes'
import { useAppStore } from './useAppStore'
import { connectSocket, disconnectSocket } from '../lib/socket'

const EMOTE_LIFETIME_MS = 4000

interface PartyState {
  socket: Socket | null
  connected: boolean
  group: Group | null
  onlinePlayerIds: string[]
  isSpectator: boolean
  error: string | null
  /** Live emoji reactions currently floating on screen — each auto-expires after a few seconds. */
  emotes: EmoteEvent[]
  /** True right after the host kicks THIS client out of the room — a page-level watcher redirects
   * home and shows a message, then clears it. */
  kicked: boolean

  connectAsPlayer: () => void
  connectAsSpectator: (code: string) => void
  disconnect: () => void
  startGame: (gameId: string, config?: unknown) => void
  sendAction: (type: string, payload: unknown) => void
  sendEmote: (emoji: string) => void
  kickMember: (targetMemberId: string) => void
  hostAdvance: () => void
  endGame: () => void
  setAdultMode: (enabled: boolean) => void
  clearError: () => void
  clearKicked: () => void

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
    socket.on('party:emote', (msg: EmoteEvent) => {
      set((s) => ({ emotes: [...s.emotes, msg] }))
      setTimeout(() => set((s) => ({ emotes: s.emotes.filter((e) => e.id !== msg.id) })), EMOTE_LIFETIME_MS)
    })
    socket.on('party:kicked', () => {
      disconnectSocket()
      set({ socket: null, connected: false, group: null, emotes: [], kicked: true })
    })
  }

  return {
    socket: null,
    connected: false,
    group: null,
    onlinePlayerIds: [],
    isSpectator: false,
    error: null,
    emotes: [],
    kicked: false,

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
      set({ socket: null, connected: false, group: null, emotes: [] })
    },

    startGame: (gameId, config) => get().socket?.emit('party:start', { gameId, config }),
    sendAction: (type, payload) => get().socket?.emit('party:action', { type, payload }),
    sendEmote: (emoji) => get().socket?.emit('party:emote', { emoji }),
    kickMember: (targetMemberId) => get().socket?.emit('party:kick', { targetMemberId }),
    hostAdvance: () => get().socket?.emit('party:hostAdvance'),
    endGame: () => get().socket?.emit('party:endGame'),
    setAdultMode: (enabled) => get().socket?.emit('party:setAdultMode', { enabled }),
    clearError: () => set({ error: null }),
    clearKicked: () => set({ kicked: false }),

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
