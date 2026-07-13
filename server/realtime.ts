import { Server, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { readDb } from './db'
import { findAuthorizedMember, sanitizeGroup, isApiError, kickMember } from './store'
import { startGame, submitAction, hostAdvance, endGame, setAdultMode } from './party'
import { EMOTES } from '../src/data/emotes'

const EMOTE_COOLDOWN_MS = 400

interface HandshakeAuth {
  groupId?: string
  memberId?: string
  memberToken?: string
  spectatorCode?: string
}

interface SocketData {
  groupId: string
  memberId: string | null
}

// Socket.IO typed events aren't worth modeling in full here — every event payload is
// validated at the handler boundary instead, so the wire-level maps stay permissive.
type AnyHandlerMap = Record<string, (...args: any[]) => void>
type PartySocket = Socket<AnyHandlerMap, AnyHandlerMap, Record<string, never>, SocketData>

export function attachRealtime(httpServer: HttpServer): { broadcastRoom: (groupId: string) => void } {
  const io = new Server<AnyHandlerMap, AnyHandlerMap, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: '*' },
  })

  function broadcastRoom(groupId: string): void {
    const db = readDb()
    const group = db.groups.find((g) => g.id === groupId)
    if (!group) return
    const room = io.sockets.adapter.rooms.get(groupId)
    if (!room) return

    const onlinePlayerIds = new Set<string>()
    for (const socketId of room) {
      const memberId = io.sockets.sockets.get(socketId)?.data.memberId
      if (memberId) onlinePlayerIds.add(memberId)
    }

    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId)
      if (!socket) continue
      socket.emit('room:update', {
        group: sanitizeGroup(group, socket.data.memberId),
        onlinePlayerIds: Array.from(onlinePlayerIds),
      })
    }
  }

  io.on('connection', (socket: PartySocket) => {
    const auth = socket.handshake.auth as HandshakeAuth

    // Spectator / "Party Screen" TV mode: join by room code only, read-only, no vote privacy needed.
    if (auth.spectatorCode) {
      const db = readDb()
      const group = db.groups.find((g) => g.code === auth.spectatorCode!.toUpperCase())
      if (!group) {
        socket.emit('party:error', { error: 'Salle introuvable.' })
        socket.disconnect()
        return
      }
      socket.data.groupId = group.id
      socket.data.memberId = null
      socket.join(group.id)
      broadcastRoom(group.id)
      return
    }

    const { groupId, memberId, memberToken } = auth
    if (!groupId || !memberId || !memberToken) {
      socket.emit('party:error', { error: 'Authentification invalide.' })
      socket.disconnect()
      return
    }
    const db = readDb()
    const authResult = findAuthorizedMember(db, groupId, memberId, memberToken)
    if (isApiError(authResult)) {
      socket.emit('party:error', { error: authResult.error })
      socket.disconnect()
      return
    }

    socket.data.groupId = groupId
    socket.data.memberId = memberId
    socket.join(groupId)
    broadcastRoom(groupId)

    socket.on('party:start', (payload: { gameId?: string; config?: unknown }) => {
      if (!socket.data.memberId) return
      const result = startGame(groupId, socket.data.memberId, memberToken, payload?.gameId ?? '', payload?.config)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    })

    socket.on('party:setAdultMode', (payload: { enabled?: boolean }) => {
      if (!socket.data.memberId) return
      const result = setAdultMode(groupId, socket.data.memberId, memberToken, !!payload?.enabled)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    })

    socket.on('party:action', (payload: { type?: string; payload?: unknown }) => {
      if (!socket.data.memberId) return
      const result = submitAction(groupId, socket.data.memberId, memberToken, payload?.type ?? '', payload?.payload)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    })

    socket.on('party:hostAdvance', () => {
      if (!socket.data.memberId) return
      const result = hostAdvance(groupId, socket.data.memberId, memberToken)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    })

    // Ephemeral emoji reactions: broadcast straight to the room, never persisted — they're pure
    // ambiance, so no db write, no room:update, just a fire-and-forget event with a cooldown.
    let lastEmoteAt = 0
    socket.on('party:emote', (payload: { emoji?: string }) => {
      if (!socket.data.memberId) return
      const emoji = payload?.emoji
      if (!emoji || !(EMOTES as readonly string[]).includes(emoji)) return
      const now = Date.now()
      if (now - lastEmoteAt < EMOTE_COOLDOWN_MS) return
      lastEmoteAt = now
      io.to(groupId).emit('party:emote', {
        id: `em-${now}-${Math.random().toString(36).slice(2, 7)}`,
        memberId: socket.data.memberId,
        emoji,
      })
    })

    // Host removes a stuck/ghost/disruptive player. The target's own socket(s) get an explicit
    // notice + forced disconnect so their app bounces home immediately, instead of silently
    // showing them a room that no longer includes them.
    socket.on('party:kick', (payload: { targetMemberId?: string }) => {
      if (!socket.data.memberId) return
      const targetMemberId = payload?.targetMemberId
      if (!targetMemberId) return
      const result = kickMember(groupId, socket.data.memberId, memberToken, targetMemberId)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }

      const room = io.sockets.adapter.rooms.get(groupId)
      if (room) {
        for (const socketId of room) {
          const targetSocket = io.sockets.sockets.get(socketId)
          if (targetSocket?.data.memberId === targetMemberId) {
            targetSocket.emit('party:kicked')
            targetSocket.leave(groupId)
            targetSocket.disconnect(true)
          }
        }
      }
      broadcastRoom(groupId)
    })

    socket.on('party:endGame', () => {
      if (!socket.data.memberId) return
      const result = endGame(groupId, socket.data.memberId, memberToken)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    })

    socket.on('disconnect', () => {
      broadcastRoom(groupId)
    })
  })

  return { broadcastRoom }
}
