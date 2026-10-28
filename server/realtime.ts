import { Server, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { readDb } from './db'
import { findAuthorizedMember, sanitizeGroup, isApiError, kickMember } from './store'
import { startGame, submitAction, hostAdvance, endGame, setAdultMode } from './party'
import { startMusic, stopMusic, musicAction, claimPlatine, platineTrackEnded } from './music'
import { EMOTES } from '../src/data/emotes'
import type { MusicSource } from '../src/types'

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

/**
 * Enveloppe un gestionnaire d'événement socket. Une exception levée dans un gestionnaire socket.io
 * n'est pas rattrapée : elle devient une `uncaughtException` et arrête le processus — toutes les
 * salles tombent pour l'erreur d'une seule. Ici l'erreur est journalisée et signalée à l'émetteur.
 */
function guarded<A extends unknown[]>(socket: PartySocket, event: string, handler: (...args: A) => void) {
  return (...args: A) => {
    try {
      handler(...args)
    } catch (error) {
      console.error(`[socket] ${event} a échoué`, { groupId: socket.data.groupId, memberId: socket.data.memberId, error })
      socket.emit('party:error', { error: 'Action impossible pour le moment.' })
    }
  }
}

export function attachRealtime(httpServer: HttpServer): { broadcastRoom: (groupId: string) => void } {
  const io = new Server<AnyHandlerMap, AnyHandlerMap, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: '*' },
  })

  function broadcastRoom(groupId: string): void {
    const room = io.sockets.adapter.rooms.get(groupId)
    if (!room) return
    const group = readDb({ groupId }).groups[0]
    if (!group) return

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
      const group = readDb({ code: String(auth.spectatorCode).toUpperCase() }).groups[0]
      if (!group) {
        socket.emit('party:error', { error: 'Salle introuvable.' })
        socket.disconnect()
        return
      }
      socket.data.groupId = group.id
      socket.data.memberId = null
      socket.join(group.id)
      broadcastRoom(group.id)

      // Platine (jukebox playback device): a read-only spectator page can claim the single
      // playback-authority role and report when a track ends, so the server advances the queue.
      socket.on('music:platine', guarded(socket, 'music:platine', (payload: { type?: string; platineId?: string; trackId?: string }) => {
        const platineId = payload?.platineId
        if (!platineId) return
        const result =
          payload?.type === 'claim'
            ? claimPlatine(group.id, platineId)
            : payload?.type === 'ended'
              ? platineTrackEnded(group.id, platineId, payload?.trackId ?? '')
              : null
        if (!result) return
        if (isApiError(result)) {
          socket.emit('party:error', { error: result.error })
          return
        }
        broadcastRoom(group.id)
      }))

      // Live playback position — pure ambiance for the phones' now-playing bar, so it's a
      // fire-and-forget broadcast (no db write, no full room snapshot) like the emotes.
      socket.on('music:position', guarded(socket, 'music:position', (payload: { positionMs?: number; durationMs?: number; isPlaying?: boolean }) => {
        io.to(group.id).emit('music:position', {
          positionMs: typeof payload?.positionMs === 'number' ? payload.positionMs : 0,
          durationMs: typeof payload?.durationMs === 'number' ? payload.durationMs : null,
          isPlaying: !!payload?.isPlaying,
        })
      }))

      // Où en est l'animation de la TV dans les événements de la partie : les téléphones attendent
      // que le pion ait atterri à l'écran pour dévoiler la case. Relais pur, comme la position.
      socket.on('screen:progress', guarded(socket, 'screen:progress', (payload: { game?: string; seq?: number }) => {
        const game = typeof payload?.game === 'string' ? payload.game.slice(0, 40) : ''
        const seq = Number(payload?.seq)
        if (!game || !Number.isInteger(seq) || seq < 0) return
        io.to(group.id).emit('screen:progress', { game, seq })
      }))
      return
    }

    const { groupId, memberId, memberToken } = auth
    if (!groupId || !memberId || !memberToken) {
      socket.emit('party:error', { error: 'Authentification invalide.' })
      socket.disconnect()
      return
    }
    const authResult = findAuthorizedMember(readDb({ groupId }), groupId, memberId, memberToken)
    if (isApiError(authResult)) {
      socket.emit('party:error', { error: authResult.error })
      socket.disconnect()
      return
    }

    socket.data.groupId = groupId
    socket.data.memberId = memberId
    socket.join(groupId)
    broadcastRoom(groupId)

    socket.on('party:start', guarded(socket, 'party:start', (payload: { gameId?: string; config?: unknown }) => {
      if (!socket.data.memberId) return
      const result = startGame(groupId, socket.data.memberId, memberToken, payload?.gameId ?? '', payload?.config)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    }))

    socket.on('party:setAdultMode', guarded(socket, 'party:setAdultMode', (payload: { enabled?: boolean }) => {
      if (!socket.data.memberId) return
      const result = setAdultMode(groupId, socket.data.memberId, memberToken, !!payload?.enabled)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    }))

    socket.on('party:action', guarded(socket, 'party:action', (payload: { type?: string; payload?: unknown }) => {
      if (!socket.data.memberId) return
      const result = submitAction(groupId, socket.data.memberId, memberToken, payload?.type ?? '', payload?.payload)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    }))

    socket.on('party:hostAdvance', guarded(socket, 'party:hostAdvance', () => {
      if (!socket.data.memberId) return
      const result = hostAdvance(groupId, socket.data.memberId, memberToken)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    }))

    // Ephemeral emoji reactions: broadcast straight to the room, never persisted — they're pure
    // ambiance, so no db write, no room:update, just a fire-and-forget event with a cooldown.
    let lastEmoteAt = 0
    socket.on('party:emote', guarded(socket, 'party:emote', (payload: { emoji?: string }) => {
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
    }))

    // Host removes a stuck/ghost/disruptive player. The target's own socket(s) get an explicit
    // notice + forced disconnect so their app bounces home immediately, instead of silently
    // showing them a room that no longer includes them.
    socket.on('party:kick', guarded(socket, 'party:kick', (payload: { targetMemberId?: string }) => {
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
    }))

    socket.on('party:endGame', guarded(socket, 'party:endGame', () => {
      if (!socket.data.memberId) return
      const result = endGame(groupId, socket.data.memberId, memberToken)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    }))

    // ---- Mode Soirée (jukebox) ----
    socket.on('music:start', guarded(socket, 'music:start', (payload: { source?: string }) => {
      if (!socket.data.memberId) return
      const result = startMusic(groupId, socket.data.memberId, memberToken, (payload?.source ?? 'youtube') as MusicSource)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    }))

    socket.on('music:stop', guarded(socket, 'music:stop', () => {
      if (!socket.data.memberId) return
      const result = stopMusic(groupId, socket.data.memberId, memberToken)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    }))

    socket.on('music:action', guarded(socket, 'music:action', (payload: { type?: string; payload?: unknown }) => {
      if (!socket.data.memberId) return
      const result = musicAction(groupId, socket.data.memberId, memberToken, payload?.type ?? '', payload?.payload)
      if (isApiError(result)) {
        socket.emit('party:error', { error: result.error })
        return
      }
      broadcastRoom(groupId)
    }))

    socket.on('disconnect', guarded(socket, 'disconnect', () => {
      broadcastRoom(groupId)
    }))
  })

  return { broadcastRoom }
}
