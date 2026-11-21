import { create } from 'zustand'
import type { Socket } from 'socket.io-client'
import type { Group, Member, MusicAnchor, MusicOutput, PlatineStatus } from '../types'
import type { EmoteEvent } from '../data/emotes'
import { useAppStore } from './useAppStore'
import { connectSocket, disconnectSocket } from '../lib/socket'

const EMOTE_LIFETIME_MS = 4000
const MUSIC_REACTION_LIFETIME_MS = 3600
const ACK_TIMEOUT_MS = 8000

/** Réponse du serveur à une action du Mode Soirée. */
export interface MusicAck {
  ok: boolean
  error?: string
  /** `add` / `replay` : l'id du morceau créé. */
  trackId?: string
}

/** Une réaction au morceau en cours, le temps qu'elle s'envole sur les écrans. */
export interface MusicReactionEvent {
  id: string
  memberId: string
  emoji: string
  trackId: string
  counts: Record<string, number>
}

/** Ce qu'un appareil-platine (page `/platine` ou TV) présente pour revendiquer le rôle. */
export interface PlatineRole {
  platineId: string
  /** Secret du lien de l'hôte : permet de reprendre une platine déjà en ligne. */
  key?: string | null
  kind: MusicOutput
}

interface PartyState {
  socket: Socket | null
  connected: boolean
  group: Group | null
  onlinePlayerIds: string[]
  isSpectator: boolean
  error: string | null
  /** Live emoji reactions currently floating on screen — each auto-expires after a few seconds. */
  emotes: EmoteEvent[]
  /** État vivant de la platine (en ligne ou non), diffusé avec chaque mise à jour de la salle. */
  platine: PlatineStatus | null
  /** Écart entre l'horloge du serveur et la nôtre : sert à extrapoler la position de lecture ancrée. */
  clockOffset: number
  /** Réactions au morceau en cours en train de s'envoler (chacune expire d'elle-même). */
  musicReactions: MusicReactionEvent[]
  /** Dernier refus du serveur sur une action du Mode Soirée (affiché en toast par la page). */
  musicError: string | null
  /** Rôle de platine demandé par CET appareil — redemandé à chaque reconnexion. */
  platineRole: PlatineRole | null
  /** Vrai tant que cet appareil EST la platine active (le serveur l'a accepté et ne l'a pas délogé). */
  platineActive: boolean
  /** Dernier événement de jeu que la TV a fini d'animer (remis à zéro à chaque nouvelle partie). */
  screenProgress: { game: string; seq: number; at: number } | null
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
  // Mode Soirée (jukebox)
  startMusic: (source: string) => Promise<MusicAck>
  stopMusic: () => Promise<MusicAck>
  musicAction: (type: string, payload?: unknown) => Promise<MusicAck>
  clearMusicError: () => void
  /** Demande le rôle de platine pour cet appareil (et le redemande à chaque reconnexion). */
  claimPlatine: (role: PlatineRole) => Promise<MusicAck>
  /** Rend le rôle (« Quitter ») et oublie la demande. */
  releasePlatine: () => void
  /** Message de la platine active : fin de morceau, position, lecture, passage, réglages. */
  platineSend: (type: string, payload?: Record<string, unknown>) => void
  /** Horloge du serveur, estimée. */
  serverNow: () => number
  reportScreenProgress: (game: string, seq: number) => void
  clearError: () => void
  clearKicked: () => void

  currentMember: () => Member | null
  isHost: () => boolean
}

export const usePartyStore = create<PartyState>((set, get) => {
  /**
   * Action de jeu : envoyée seulement si la connexion est là. Socket.io met sinon les envois en
   * file pendant une coupure (téléphone en veille, réseau qui saute) et les rejoue tous à la
   * reconnexion — un coup tapé il y a trente secondes arrivait alors sur une partie qui avait
   * avancé. Mieux vaut le dire au joueur et le laisser rejouer sur l'état à jour.
   */
  function play(event: string, payload?: unknown) {
    const socket = get().socket
    if (!socket) return
    if (!socket.connected) {
      set({ error: 'Connexion perdue — reconnexion en cours, réessaie dans un instant.' })
      return
    }
    if (payload === undefined) socket.emit(event)
    else socket.emit(event, payload)
  }

  /** Émission avec accusé de réception : la promesse rend la réponse du serveur (ou un échec si la
   * connexion manque ou si le serveur ne répond pas). Un refus est aussi rangé dans `musicError`. */
  function request(event: string, payload: unknown): Promise<MusicAck> {
    return new Promise((resolve) => {
      const socket = get().socket
      const fail = (error: string) => {
        set({ musicError: error })
        resolve({ ok: false, error })
      }
      if (!socket) return fail('Pas connecté à la salle.')
      if (!socket.connected) return fail('Connexion perdue — reconnexion en cours, réessaie dans un instant.')
      const timer = setTimeout(() => fail('Le serveur ne répond pas — réessaie.'), ACK_TIMEOUT_MS)
      socket.emit(event, payload, (res: MusicAck | undefined) => {
        clearTimeout(timer)
        if (!res?.ok) return fail(res?.error ?? 'Action impossible pour le moment.')
        resolve(res)
      })
    })
  }

  function sendClaim(socket: Socket, role: PlatineRole): Promise<MusicAck> {
    return new Promise((resolve) => {
      socket.emit('music:platine', { type: 'claim', ...role }, (res: MusicAck | undefined) => {
        const ack = res ?? { ok: false, error: 'Pas de réponse du serveur.' }
        set({ platineActive: ack.ok })
        resolve(ack)
      })
    })
  }

  function wire(socket: Socket) {
    socket.on('connect', () => {
      set({ connected: true })
      // Reconnexion d'une platine : elle redemande sa place (le serveur la lui rend si c'est bien le
      // même appareil, ou si la place est restée libre).
      const role = get().platineRole
      if (role) void sendClaim(socket, role)
    })
    socket.on('disconnect', () => set({ connected: false, platineActive: false }))
    socket.on('room:update', (msg: { group: Group; onlinePlayerIds: string[]; platine?: PlatineStatus; serverNow?: number }) => {
      const prev = get().group?.party
      const next = msg.group.party
      // Nouvelle partie : la progression de la TV de la précédente ne veut plus rien dire.
      const fresh = !prev || prev.currentGameId !== next.currentGameId || (prev.status !== 'playing' && next.status === 'playing')
      set({
        group: msg.group,
        onlinePlayerIds: msg.onlinePlayerIds,
        platine: msg.platine ?? null,
        ...(typeof msg.serverNow === 'number' ? { clockOffset: msg.serverNow - Date.now() } : {}),
        ...(fresh ? { screenProgress: null } : {}),
      })
    })
    socket.on('party:error', (msg: { error: string }) => set({ error: msg.error }))
    socket.on('party:emote', (msg: EmoteEvent) => {
      set((s) => ({ emotes: [...s.emotes, msg] }))
      setTimeout(() => set((s) => ({ emotes: s.emotes.filter((e) => e.id !== msg.id) })), EMOTE_LIFETIME_MS)
    })
    socket.on('party:kicked', () => {
      disconnectSocket()
      set({ socket: null, connected: false, group: null, emotes: [], kicked: true })
    })
    // Battement de la platine : seule l'ancre de lecture change, on la recolle dans l'état connu.
    socket.on('music:anchor', (msg: { trackId: string; anchor: MusicAnchor | null; durationMs: number | null; serverNow: number }) => {
      const group = get().group
      const music = group?.music
      set({ clockOffset: msg.serverNow - Date.now() })
      if (!group || !music?.current || music.current.id !== msg.trackId) return
      set({
        group: { ...group, music: { ...music, anchor: msg.anchor, current: { ...music.current, durationMs: msg.durationMs } } },
      })
    })
    socket.on('music:reaction', (msg: MusicReactionEvent) => {
      const group = get().group
      const music = group?.music
      set((s) => ({ musicReactions: [...s.musicReactions, msg].slice(-40) }))
      setTimeout(() => set((s) => ({ musicReactions: s.musicReactions.filter((r) => r.id !== msg.id) })), MUSIC_REACTION_LIFETIME_MS)
      if (group && music?.current && music.current.id === msg.trackId) {
        set({ group: { ...group, music: { ...music, current: { ...music.current, reactions: msg.counts } } } })
      }
    })
    // Une autre platine a pris la main (lien de l'hôte, TV) : on passe en veille immédiatement.
    socket.on('music:platine-released', () => set({ platineActive: false }))
    socket.on('screen:progress', (msg: { game: string; seq: number }) => {
      set({ screenProgress: { ...msg, at: Date.now() } })
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
    platine: null,
    clockOffset: 0,
    musicReactions: [],
    musicError: null,
    platineRole: null,
    platineActive: false,
    screenProgress: null,
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
      set({ socket: null, connected: false, group: null, emotes: [], platine: null, platineRole: null, platineActive: false, musicReactions: [] })
    },

    startGame: (gameId, config) => play('party:start', { gameId, config }),
    sendAction: (type, payload) => play('party:action', { type, payload }),
    sendEmote: (emoji) => get().socket?.emit('party:emote', { emoji }),
    kickMember: (targetMemberId) => play('party:kick', { targetMemberId }),
    hostAdvance: () => play('party:hostAdvance'),
    endGame: () => play('party:endGame'),
    setAdultMode: (enabled) => play('party:setAdultMode', { enabled }),
    startMusic: (source) => request('music:start', { source }),
    stopMusic: () => request('music:stop', {}),
    musicAction: (type, payload) => request('music:action', { type, payload }),
    clearMusicError: () => set({ musicError: null }),
    claimPlatine: (role) => {
      set({ platineRole: role })
      const socket = get().socket
      if (!socket?.connected) return Promise.resolve({ ok: false, error: 'Connexion à la salle en cours…' })
      return sendClaim(socket, role)
    },
    releasePlatine: () => {
      if (get().platineActive) get().socket?.emit('music:platine', { type: 'release' })
      set({ platineRole: null, platineActive: false })
    },
    platineSend: (type, payload) => {
      if (!get().platineActive) return
      get().socket?.emit('music:platine', { ...payload, type })
    },
    serverNow: () => Date.now() + get().clockOffset,
    reportScreenProgress: (game, seq) => get().socket?.volatile.emit('screen:progress', { game, seq }),
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
