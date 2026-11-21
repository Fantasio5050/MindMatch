import { Server, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { readDb } from './db'
import { findAuthorizedMember, sanitizeGroup, isApiError, kickMember } from './store'
import { startGame, submitAction, hostAdvance, endGame, setAdultMode } from './party'
import {
  startMusic,
  stopMusic,
  musicAction,
  claimPlatine,
  platineEvent,
  platineStatus,
  releasePlatineSocket,
  recheckSkip,
  type MusicResult,
} from './music'
import { readMusic } from './db'
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

/** Réponse d'accusé de réception d'un événement (`socket.emit(…, payload, ack)`), facultative. */
type Ack = ((response: unknown) => void) | undefined

export function attachRealtime(httpServer: HttpServer): { broadcastRoom: (groupId: string) => void } {
  const io = new Server<AnyHandlerMap, AnyHandlerMap, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: '*' },
  })

  function onlineMemberIds(groupId: string): string[] {
    const room = io.sockets.adapter.rooms.get(groupId)
    const ids = new Set<string>()
    if (room) {
      for (const socketId of room) {
        const memberId = io.sockets.sockets.get(socketId)?.data.memberId
        if (memberId) ids.add(memberId)
      }
    }
    return Array.from(ids)
  }

  function broadcastRoom(groupId: string): void {
    const room = io.sockets.adapter.rooms.get(groupId)
    if (!room) return
    const group = readDb({ groupId }).groups[0]
    if (!group) return

    const onlinePlayerIds = onlineMemberIds(groupId)
    // L'état vivant de la platine (en ligne ou non) et l'horloge serveur, qui permet à chaque appareil
    // d'extrapoler la position de lecture ancrée sans que la platine la diffuse en continu.
    const platine = platineStatus(groupId)
    const serverNow = Date.now()

    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId)
      if (!socket) continue
      socket.emit('room:update', {
        group: sanitizeGroup(group, socket.data.memberId),
        onlinePlayerIds,
        platine,
        serverNow,
      })
    }
  }

  /** Applique le résultat d'une opération du Mode Soirée : diffusion, réaction, platine délogée.
   * `quiet` : un refus sans accusé de réception n'est PAS remonté comme erreur de page (une platine
   * qui vient de perdre la main peut encore envoyer un battement : ce n'est pas un drame). */
  function settleMusic(socket: PartySocket, groupId: string, result: MusicResult, ack: Ack, quiet = false): void {
    if (isApiError(result)) {
      if (typeof ack === 'function') ack({ ok: false, error: result.error })
      else if (!quiet) socket.emit('party:error', { error: result.error })
      return
    }
    if (result.displacedSocketId && result.displacedSocketId !== socket.id) {
      io.sockets.sockets.get(result.displacedSocketId)?.emit('music:platine-released')
    }
    if (result.broadcast === 'room') broadcastRoom(groupId)
    else if (result.broadcast === 'anchor') {
      // Battement de la platine : seule l'ancre voyage, pas l'état complet de la salle.
      const music = readMusic(groupId)
      if (music?.current) {
        io.to(groupId).emit('music:anchor', {
          trackId: music.current.id,
          anchor: music.anchor,
          durationMs: music.current.durationMs,
          serverNow: Date.now(),
        })
      }
    }
    if (result.reaction) io.to(groupId).emit('music:reaction', result.reaction)
    if (typeof ack === 'function') ack({ ok: true, trackId: result.trackId })
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

      // Platine (jukebox playback device) : une page spectatrice (`/platine` ou la TV) peut revendiquer
      // le rôle d'unique lecteur. Il est lié à CETTE connexion : seule elle peut ensuite signaler une fin
      // de morceau, une position ou une pause (voir server/music.ts).
      socket.on('music:platine', guarded(socket, 'music:platine', (payload: { type?: string } & Record<string, unknown>, ack?: Ack) => {
        const type = payload?.type ?? ''
        const result = type === 'claim'
          ? claimPlatine(group.id, socket.id, payload as { platineId?: unknown; key?: unknown; kind?: unknown })
          : platineEvent(group.id, socket.id, type, payload)
        settleMusic(socket, group.id, result, ack, type !== 'claim')
      }))

      // La platine qui tombe (onglet fermé, réseau coupé) libère sa place : tout le monde le voit, et
      // une autre platine — ou la même, à son retour — peut reprendre.
      socket.on('disconnect', guarded(socket, 'disconnect', () => {
        const released = releasePlatineSocket(socket.id)
        if (released) broadcastRoom(released)
      }))

      // Où en est l'animation de la TV dans les événements de la partie : les téléphones attendent
      // que le pion ait atterri à l'écran pour dévoiler la case. Relais pur, comme les émotes.
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
    socket.on('music:start', guarded(socket, 'music:start', (payload: { source?: string }, ack?: Ack) => {
      if (!socket.data.memberId) return
      const result = startMusic(groupId, socket.data.memberId, memberToken, (payload?.source ?? 'youtube') as MusicSource)
      settleMusic(socket, groupId, result, ack)
    }))

    socket.on('music:stop', guarded(socket, 'music:stop', (_payload?: unknown, ack?: Ack) => {
      if (!socket.data.memberId) return
      const result = stopMusic(groupId, socket.data.memberId, memberToken)
      settleMusic(socket, groupId, result, ack)
    }))

    socket.on('music:action', guarded(socket, 'music:action', (payload: { type?: string; payload?: unknown }, ack?: Ack) => {
      if (!socket.data.memberId) return
      const result = musicAction(groupId, socket.data.memberId, memberToken, payload?.type ?? '', payload?.payload, {
        onlineIds: onlineMemberIds(groupId),
      })
      settleMusic(socket, groupId, result, ack)
    }))

    socket.on('disconnect', guarded(socket, 'disconnect', () => {
      // Un votant de moins : le seuil du vote pour passer suit la salle connectée.
      recheckSkip(groupId, onlineMemberIds(groupId), readDb({ groupId }).groups[0]?.members.length ?? 0)
      broadcastRoom(groupId)
    }))
  })

  return { broadcastRoom }
}
