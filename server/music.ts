import { readDb, readMusic, writeMusic } from './db'
import type {
  MusicFeedEvent,
  MusicFeedKind,
  MusicOutput,
  MusicRecap,
  MusicSession,
  MusicSource,
  MusicTrack,
  PlatineStatus,
} from '../src/types'
import { findAuthorizedMember, isApiError, type ApiError } from './store'
import {
  orderedQueue,
  skipStatus,
  anchorPosition,
  isValidSourceId,
  cleanDedication,
  newMusicSession,
  MUSIC_HISTORY_CAP,
  MUSIC_FEED_CAP,
  MUSIC_POOL_CAP,
  MAX_QUEUE_PER_PLAYER,
  MAX_TRACK_TITLE,
  MAX_TRACK_ARTIST,
  MAX_CROSSFADE_SEC,
  MUSIC_REACTIONS,
  REACTIONS_PER_MEMBER_CAP,
  YOUTUBE_PLAYLIST_MAX,
} from '../src/lib/jukebox'

/**
 * Mode Soirée — la logique serveur de la platine partagée.
 *
 * Trois sortes d'appelants :
 *  - les membres (téléphones), authentifiés par jeton : ajouter, voter, réagir, et pour l'hôte,
 *    piloter la lecture et les réglages ;
 *  - LA platine : un appareil sans compte (page `/platine` ou TV) qui a revendiqué le rôle. Elle est
 *    liée à SA connexion socket : seule cette connexion peut signaler une fin de morceau ou une
 *    position. Avant, n'importe quel appareil connaissant le code de la salle pouvait le faire ;
 *  - le serveur temps réel lui-même (déconnexions : platine qui tombe, votant qui part).
 *
 * Chaque fonction rend un résultat qui dit QUOI diffuser : l'état complet (`room`), la seule ancre
 * de lecture (`anchor`, léger) ou rien — une réaction voyage dans son propre petit événement.
 */

export interface MusicReactionEvent {
  id: string
  memberId: string
  emoji: string
  trackId: string
  /** Totaux du morceau après cette réaction (les écrans se recalent dessus). */
  counts: Record<string, number>
}

export type MusicOk = {
  ok: true
  broadcast: 'room' | 'anchor' | 'none'
  /** `add` / `replay` : l'id du morceau créé (le téléphone en déduit son rang dans la file). */
  trackId?: string
  reaction?: MusicReactionEvent
  /** Connexion de platine qui vient de perdre le rôle : le serveur temps réel la prévient. */
  displacedSocketId?: string
}
export type MusicResult = MusicOk | ApiError

const ROOM: MusicOk = { ok: true, broadcast: 'room' }
const NONE: MusicOk = { ok: true, broadcast: 'none' }

/** Délai minimal entre deux réactions d'un même membre. */
const REACTION_COOLDOWN_MS = 350

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function clampText(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().slice(0, max)
  return trimmed || fallback
}

function fail(error: string, status = 400): ApiError {
  return { error, status }
}

// ---- Fil d'activité ---------------------------------------------------------

function pushFeed(session: MusicSession, kind: MusicFeedKind, data: Omit<MusicFeedEvent, 'id' | 'at' | 'kind'>, now: number): void {
  // Un vote qui en suit un autre sur le même morceau REMPLACE la ligne précédente : le fil dit
  // « 3 votes pour passer », pas trois lignes « 1 vote », « 2 votes », « 3 votes ».
  if (kind === 'skipVote') session.feed = session.feed.filter((e) => !(e.kind === 'skipVote' && e.title === data.title))
  session.feed.push({ id: makeId('ev'), at: now, kind, ...data })
  if (session.feed.length > MUSIC_FEED_CAP) session.feed.splice(0, session.feed.length - MUSIC_FEED_CAP)
}

// ---- Réservoir (mode continu + récap) ---------------------------------------

function recordPlay(session: MusicSession, track: MusicTrack, now: number): void {
  session.playCount += 1
  const pool = (session.pool ??= [])
  let entry = pool.find((e) => e.sourceId === track.sourceId)
  if (!entry) {
    entry = {
      sourceId: track.sourceId,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
      durationMs: track.durationMs,
      addedById: track.addedById,
      reactions: 0,
      plays: 0,
      firstPlayedAt: now,
      lastPlay: 0,
    }
    pool.push(entry)
    if (pool.length > MUSIC_POOL_CAP) {
      // On oublie d'abord le morceau le moins applaudi, à égalité le plus ancien.
      let drop = 0
      for (let i = 1; i < pool.length; i++) {
        const a = pool[i]
        const b = pool[drop]
        if (a.sourceId === track.sourceId) continue
        if (a.reactions < b.reactions || (a.reactions === b.reactions && a.lastPlay < b.lastPlay)) drop = i
      }
      pool.splice(drop, 1)
    }
  }
  entry.plays += 1
  entry.lastPlay = session.playCount
  if (!entry.durationMs && track.durationMs) entry.durationMs = track.durationMs
}

/**
 * Ce que le mode continu jouera si la file reste vide : parmi les morceaux déjà passés ce soir, le
 * plus applaudi qui n'est pas passé récemment (à égalité : le moins joué, puis le plus ancien).
 *
 * Le choix est STABLE : tant qu'il reste valable on ne le recalcule pas, même si les réactions
 * changent le classement. La platine l'annonce et le lance en fondu enchaîné — s'il changeait sous
 * ses pieds, le serveur avancerait vers un autre morceau que celui qu'elle vient de démarrer.
 * (Il n'y a pas de « titres similaires » : l'API de recommandations Spotify n'existe plus.)
 */
function refreshAutoNext(session: MusicSession, now: number): void {
  if (!session.settings.continuous || session.queue.length > 0 || session.endedAt) {
    session.autoNext = null
    return
  }
  const pool = session.pool ?? []
  const keep = session.autoNext
  if (keep && keep.sourceId !== session.current?.sourceId && pool.some((e) => e.sourceId === keep.sourceId)) return
  // Fenêtre anti-répétition : la moitié du réservoir, entre 1 et 6 passages.
  const recent = Math.min(6, Math.max(1, Math.floor(pool.length / 2)))
  const candidates = pool
    .filter((e) => e.sourceId !== session.current?.sourceId && e.lastPlay <= session.playCount - recent)
    .sort((a, b) => b.reactions - a.reactions || a.plays - b.plays || a.lastPlay - b.lastPlay)
  const pick = candidates[0]
  session.autoNext = pick
    ? {
        id: makeId('tr'),
        source: session.source,
        sourceId: pick.sourceId,
        title: pick.title,
        artist: pick.artist,
        thumbnail: pick.thumbnail,
        durationMs: pick.durationMs,
        addedById: pick.addedById,
        bumpVotes: [],
        addedAt: now,
        auto: true,
      }
    : null
}

// ---- Enchaînement ------------------------------------------------------------

function startTrack(session: MusicSession, track: MusicTrack, now: number): void {
  session.current = { ...track, bumpVotes: [], reactions: {}, reactedBy: {}, pinnedAt: null, playedAt: now }
  session.currentStartedAt = now
  session.isPlaying = true
  // Le morceau CHARGE : l'ancre n'avance qu'une fois que la platine signale la lecture effective.
  session.anchor = { positionMs: 0, at: now, playing: false }
  session.skipVotes = []
  recordPlay(session, track, now)
}

/**
 * Passe au morceau suivant — fin naturelle, vote, hôte : la SEULE règle « qu'est-ce qui passe
 * ensuite » côté serveur.
 *
 * `preferId` est le morceau que la platine a DÉJÀ lancé en fondu enchaîné. On le respecte s'il est
 * encore dans la file (ou si c'est la proposition du mode continu) : avant, le serveur recalculait la
 * tête de file à la réception, et si elle avait bougé pendant le fondu (un vote, un ajout), la
 * platine devait couper net le morceau qu'elle venait d'ouvrir pour charger l'autre.
 */
function advance(session: MusicSession, now: number, preferId?: string | null): MusicTrack | null {
  if (session.current) {
    session.history.unshift(session.current)
    if (session.history.length > MUSIC_HISTORY_CAP) session.history.length = MUSIC_HISTORY_CAP
  }

  const queue = orderedQueue(session)
  let next: MusicTrack | null = null
  if (preferId) next = queue.find((t) => t.id === preferId) ?? (session.autoNext?.id === preferId ? session.autoNext : null)
  if (!next) next = queue[0] ?? (session.settings.continuous ? session.autoNext : null)

  if (next) {
    if (!next.auto) {
      const picked = next
      session.queue = session.queue.filter((t) => t.id !== picked.id)
      session.playedCounts[picked.addedById] = (session.playedCounts[picked.addedById] ?? 0) + 1
    }
    session.autoNext = null
    startTrack(session, next, now)
    if (next.auto) pushFeed(session, 'auto', { title: next.title, memberId: next.addedById }, now)
  } else {
    session.current = null
    session.currentStartedAt = null
    session.isPlaying = false
    session.anchor = null
    session.skipVotes = []
  }
  return next
}

function setPlayback(session: MusicSession, playing: boolean, now: number): void {
  // Réancrage : la position est figée à l'instant de la pause (ou repart de là à la reprise).
  const pos = anchorPosition(session.anchor, now, session.current?.durationMs)
  session.isPlaying = playing
  session.anchor = { positionMs: pos, at: now, playing: playing && !!session.anchor?.playing }
}

/** Plus personne ne joue : la position se fige là où la platine en était (les barres de progression
 * des téléphones s'arrêtent au lieu d'avancer dans le vide). */
function freezeAnchor(session: MusicSession, now: number): void {
  if (session.anchor?.playing) {
    session.anchor = { positionMs: anchorPosition(session.anchor, now, session.current?.durationMs), at: now, playing: false }
  }
}

function commit(groupId: string, session: MusicSession, now: number): void {
  refreshAutoNext(session, now)
  writeMusic(groupId, session)
}

// ---- Liaison platine ↔ connexion --------------------------------------------
//
// En mémoire, volontairement : c'est l'état d'une CONNEXION, il n'a aucun sens après un redémarrage
// du serveur. La platine se reconnecte toute seule et revendique à nouveau son rôle.

interface Binding {
  socketId: string
  platineId: string
  kind: MusicOutput
}
const bindings = new Map<string, Binding>()

export function platineStatus(groupId: string): PlatineStatus {
  const b = bindings.get(groupId)
  return b ? { online: true, kind: b.kind } : { online: false, kind: null }
}

/** Libère la platine liée à cette connexion (déconnexion, « Quitter »). Rend le groupe concerné. */
export function releasePlatineSocket(socketId: string, now = Date.now()): string | null {
  for (const [groupId, b] of bindings) {
    if (b.socketId !== socketId) continue
    bindings.delete(groupId)
    const session = readMusic(groupId)
    if (session && !session.endedAt) {
      pushFeed(session, 'platineOff', {}, now)
      freezeAnchor(session, now)
      commit(groupId, session, now)
    }
    return groupId
  }
  return null
}

/** Remet à zéro les liaisons (tests). */
export function resetPlatineBindings(): void {
  bindings.clear()
}

/**
 * Une platine (page `/platine` ou TV) demande le rôle. Règles, de la plus forte à la plus faible :
 *  - le lien de l'hôte (clé secrète) prend la main dans tous les cas ;
 *  - une TV prend la main si l'hôte a choisi « le son sur la TV » ;
 *  - le même appareil qui se reconnecte reprend sa place (sa connexion précédente n'est peut-être
 *    pas encore tombée côté serveur) ;
 *  - sinon, la place doit être libre : premier arrivé, premier servi.
 * Un appareil qui ne connaît que le code de la salle ne peut donc plus voler une platine en ligne.
 */
export function claimPlatine(
  groupId: string,
  socketId: string,
  payload: { platineId?: unknown; key?: unknown; kind?: unknown },
  now = Date.now(),
): MusicResult {
  const platineId = typeof payload?.platineId === 'string' ? payload.platineId : ''
  if (!/^[\w-]{6,80}$/.test(platineId)) return fail('Platine invalide.')
  const kind: MusicOutput = payload?.kind === 'tv' ? 'tv' : 'device'
  const session = readMusic(groupId)
  if (!session || session.endedAt) return fail('Aucun mode soirée en cours.')

  const bound = bindings.get(groupId) ?? null
  const withKey = typeof payload?.key === 'string' && payload.key.length > 0 && payload.key === session.platineKey
  const sameDevice = !!bound && bound.platineId === platineId
  const free = !bound || bound.socketId === socketId || sameDevice

  if (kind === 'tv') {
    if (session.source !== 'youtube') return fail('La TV ne lit que la source YouTube.')
    if (session.settings.output !== 'tv') return fail("L'hôte n'a pas choisi de jouer le son sur la TV.", 403)
    // Le choix de l'hôte prime sur une platine-appareil ; une autre TV déjà en route garde la main.
    if (bound && bound.kind === 'tv' && !free && !withKey) return fail('Une autre TV joue déjà le son.', 409)
  } else if (!withKey) {
    if (session.settings.output === 'tv') {
      return fail("Le son passe par la TV. L'hôte peut le renvoyer sur la platine depuis son téléphone.", 409)
    }
    if (!free) {
      return fail("Une platine joue déjà. Pour la remplacer, ouvre le lien de la platine depuis le téléphone de l'hôte.", 409)
    }
  }

  // Le lien de l'hôte ramène le son sur la platine-appareil s'il passait par la TV.
  if (kind === 'device' && withKey && session.settings.output === 'tv') {
    session.settings.output = 'device'
    pushFeed(session, 'output', { detail: 'device' }, now)
  }

  const displaced = bound && bound.socketId !== socketId ? bound.socketId : undefined
  const wasOnline = !!bound
  bindings.set(groupId, { socketId, platineId, kind })
  session.platineId = platineId
  if (!wasOnline) pushFeed(session, 'platineOn', { detail: kind }, now)
  commit(groupId, session, now)
  return { ok: true, broadcast: 'room', displacedSocketId: displaced }
}

/**
 * Ce que seule la platine ACTIVE peut faire : signaler une fin de morceau (avec le suivant qu'elle a
 * lancé), sa position, une pause / un passage décidés sur place, ses réglages, ou rendre la main.
 */
export function platineEvent(groupId: string, socketId: string, type: string, payload: unknown, now = Date.now()): MusicResult {
  const b = bindings.get(groupId)
  if (!b || b.socketId !== socketId) return fail("Cet appareil n'est pas la platine active.", 403)
  const session = readMusic(groupId)
  if (!session || session.endedAt) return fail('Aucun mode soirée en cours.')
  const p = (payload ?? {}) as Record<string, unknown>

  switch (type) {
    case 'ended': {
      // Fin d'un morceau qui n'est plus le morceau en cours (doublon, fin tardive d'un deck en fondu) :
      // on ignore, sinon on sauterait deux morceaux d'un coup.
      if (!session.current || session.current.id !== p.trackId) return NONE
      if (p.reason === 'unplayable') pushFeed(session, 'unplayable', { title: session.current.title }, now)
      advance(session, now, typeof p.nextTrackId === 'string' ? p.nextTrackId : null)
      commit(groupId, session, now)
      return ROOM
    }

    case 'position': {
      if (!session.current || session.current.id !== p.trackId) return NONE
      const positionMs = Number(p.positionMs)
      if (!Number.isFinite(positionMs) || positionMs < 0) return NONE
      const durationMs = Number(p.durationMs)
      session.anchor = { positionMs: Math.round(positionMs), at: now, playing: !!p.playing }
      // Un lien collé arrive sans durée : la platine, elle, la connaît dès que la vidéo est chargée.
      if (Number.isFinite(durationMs) && durationMs > 0 && Math.abs((session.current.durationMs ?? 0) - durationMs) > 2000) {
        session.current.durationMs = Math.round(durationMs)
      }
      writeMusic(groupId, session)
      return { ok: true, broadcast: 'anchor' }
    }

    case 'playback': {
      if (!session.current) return NONE
      setPlayback(session, !!p.playing, now)
      commit(groupId, session, now)
      return ROOM
    }

    case 'skip': {
      if (!session.current) return NONE
      pushFeed(session, 'hostSkip', { memberId: null, title: session.current.title }, now)
      advance(session, now)
      commit(groupId, session, now)
      return ROOM
    }

    case 'settings': {
      // Sur place, la platine règle son volume et son fondu ; le reste est l'affaire de l'hôte.
      applySettings(session, { volume: p.volume, crossfadeSec: p.crossfadeSec }, now)
      commit(groupId, session, now)
      return ROOM
    }

    case 'release': {
      bindings.delete(groupId)
      pushFeed(session, 'platineOff', {}, now)
      freezeAnchor(session, now)
      commit(groupId, session, now)
      return ROOM
    }

    default:
      return fail('Message de platine inconnu.')
  }
}

function applySettings(session: MusicSession, p: Record<string, unknown>, now: number): { outputChanged: boolean } {
  const s = session.settings
  if (typeof p.volume === 'number' && Number.isFinite(p.volume)) s.volume = Math.max(0, Math.min(100, Math.round(p.volume)))
  if (typeof p.crossfadeSec === 'number' && Number.isFinite(p.crossfadeSec)) {
    s.crossfadeSec = Math.max(0, Math.min(MAX_CROSSFADE_SEC, Math.round(p.crossfadeSec)))
  }
  if (typeof p.duck === 'boolean') s.duck = p.duck
  if (typeof p.continuous === 'boolean') s.continuous = p.continuous
  let outputChanged = false
  if ((p.output === 'tv' || p.output === 'device') && p.output !== s.output) {
    if (p.output === 'tv' && session.source !== 'youtube') return { outputChanged }
    s.output = p.output
    outputChanged = true
    pushFeed(session, 'output', { detail: p.output }, now)
  }
  return { outputChanged }
}

// ---- Cycle de vie (hôte) ---------------------------------------------------------

export function startMusic(
  groupId: string,
  memberId: string,
  memberToken: string,
  source: MusicSource,
  now = Date.now(),
): MusicResult {
  const db = readDb({ groupId })
  const auth = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(auth)) return auth
  const { group } = auth

  if (group.party.hostMemberId !== memberId) {
    return fail("Seul·e l'hôte peut lancer le mode soirée.", 403)
  }
  // Plus de refus pendant une partie : la musique continue (et peut démarrer) pendant les jeux.
  if (source !== 'youtube' && source !== 'spotify') return fail('Source musicale invalide.')
  if (group.music && !group.music.endedAt) return fail('Le mode soirée est déjà lancé.', 409)

  writeMusic(groupId, newMusicSession(source, memberId, now))
  return ROOM
}

/** Récap de fin de soirée, calculé une fois pour toutes à l'arrêt. */
function buildRecap(session: MusicSession, now: number): MusicRecap {
  const pool = session.pool ?? []
  const djIds = new Set([...Object.keys(session.playedCounts), ...Object.keys(session.djReactions)])
  return {
    source: session.source,
    startedAt: session.startedAt,
    endedAt: now,
    tracksPlayed: session.playCount,
    totalReactions: pool.reduce((sum, e) => sum + e.reactions, 0),
    topTracks: [...pool]
      .sort((a, b) => b.reactions - a.reactions || b.plays - a.plays || a.firstPlayedAt - b.firstPlayedAt)
      .slice(0, 5)
      .map((e) => ({
        sourceId: e.sourceId,
        title: e.title,
        artist: e.artist,
        thumbnail: e.thumbnail,
        addedById: e.addedById,
        reactions: e.reactions,
        plays: e.plays,
      })),
    djs: [...djIds]
      .map((id) => ({ memberId: id, plays: session.playedCounts[id] ?? 0, reactions: session.djReactions[id] ?? 0 }))
      .filter((d) => d.plays > 0 || d.reactions > 0)
      .sort((a, b) => b.reactions - a.reactions || b.plays - a.plays),
    playlist: [...pool]
      .sort((a, b) => a.firstPlayedAt - b.firstPlayedAt)
      .slice(0, YOUTUBE_PLAYLIST_MAX)
      .map((e) => ({ sourceId: e.sourceId, title: e.title, artist: e.artist })),
  }
}

/**
 * Fin de soirée. La session n'est pas effacée : elle passe en récap (morceaux les plus applaudis,
 * meilleurs DJ, export) jusqu'à ce que l'hôte la referme. La platine est libérée.
 */
export function stopMusic(groupId: string, memberId: string, memberToken: string, now = Date.now()): MusicResult {
  const db = readDb({ groupId })
  const auth = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(auth)) return auth
  const { group } = auth
  const session = group.music

  if (!session) return ROOM
  if (session.hostMemberId !== memberId && group.party.hostMemberId !== memberId) {
    return fail("Seul·e l'hôte peut arrêter le mode soirée.", 403)
  }
  if (session.endedAt) return ROOM

  if (session.current) session.history.unshift(session.current)
  if (session.history.length > MUSIC_HISTORY_CAP) session.history.length = MUSIC_HISTORY_CAP
  session.recap = buildRecap(session, now)
  session.endedAt = now
  session.current = null
  session.queue = []
  session.isPlaying = false
  session.anchor = null
  session.skipVotes = []
  session.autoNext = null
  const bound = bindings.get(groupId)
  bindings.delete(groupId)
  writeMusic(groupId, session)
  return { ok: true, broadcast: 'room', displacedSocketId: bound?.socketId }
}

// ---- Actions des membres ----------------------------------------------------

interface AddTrackPayload {
  source?: string
  sourceId?: string
  title?: string
  artist?: string
  thumbnail?: string | null
  durationMs?: number | null
  dedication?: string | null
}

export interface MusicContext {
  /** Membres connectés en ce moment (sockets ouvertes) — le vote pour passer se décide entre eux. */
  onlineIds: string[]
}

const lastReactionAt = new Map<string, number>()

export function musicAction(
  groupId: string,
  memberId: string,
  memberToken: string,
  type: string,
  payload: unknown,
  ctx: MusicContext,
  now = Date.now(),
): MusicResult {
  const db = readDb({ groupId })
  const auth = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(auth)) return auth
  const { group } = auth
  const session = group.music
  if (!session) return fail('Aucun mode soirée en cours.')
  const isHost = session.hostMemberId === memberId || group.party.hostMemberId === memberId

  if (type === 'dismiss') {
    if (!isHost) return fail("Seul·e l'hôte peut refermer la soirée.", 403)
    if (!session.endedAt) return fail("La soirée n'est pas terminée.")
    writeMusic(groupId, null)
    return ROOM
  }
  if (session.endedAt) return fail('La soirée est terminée.')

  const p = (payload ?? {}) as Record<string, unknown>
  let result: MusicOk = ROOM

  switch (type) {
    case 'add':
    case 'replay': {
      let input: AddTrackPayload
      if (type === 'replay') {
        // Rejouer un morceau de l'historique : il repart dans la file, au nom de celui qui le relance.
        const past = session.history.find((t) => t.id === p.trackId)
        if (!past) return fail("Ce morceau n'est plus dans l'historique.", 404)
        input = { ...past, dedication: null }
      } else {
        input = p as AddTrackPayload
      }
      const source = input.source as MusicSource
      const sourceId = typeof input.sourceId === 'string' ? input.sourceId.trim() : ''
      if (source !== session.source) return fail('Mauvaise source musicale.')
      if (!isValidSourceId(source, sourceId)) return fail('Lien ou identifiant invalide.')

      const mine = session.queue.filter((t) => t.addedById === memberId).length
      if (mine >= MAX_QUEUE_PER_PLAYER) {
        return fail(`Maximum ${MAX_QUEUE_PER_PLAYER} musiques en attente par personne.`)
      }
      // De-dupe: same track already queued or currently playing.
      if (session.queue.some((t) => t.sourceId === sourceId) || session.current?.sourceId === sourceId) {
        return fail('Cette musique est déjà dans la file.', 409)
      }

      const dedication = type === 'add' ? cleanDedication(input.dedication) : null
      const track: MusicTrack = {
        id: makeId('tr'),
        source,
        sourceId,
        title: clampText(input.title, MAX_TRACK_TITLE, 'Titre inconnu'),
        artist: clampText(input.artist, MAX_TRACK_ARTIST, ''),
        thumbnail: typeof input.thumbnail === 'string' && input.thumbnail.startsWith('https://') ? input.thumbnail : null,
        durationMs: typeof input.durationMs === 'number' && input.durationMs > 0 ? Math.round(input.durationMs) : null,
        addedById: memberId,
        bumpVotes: [],
        addedAt: now,
        dedication,
      }
      session.queue.push(track)
      pushFeed(session, type, { memberId, title: track.title, detail: dedication ?? undefined }, now)
      // First song of the session (or after the queue drained): promote it straight to now-playing.
      if (!session.current) advance(session, now)
      result = { ok: true, broadcast: 'room', trackId: track.id }
      break
    }

    case 'remove': {
      const idx = session.queue.findIndex((t) => t.id === p.trackId)
      if (idx < 0) return fail('Musique introuvable dans la file.', 404)
      const track = session.queue[idx]
      if (track.addedById !== memberId && !isHost) {
        return fail('Tu ne peux retirer que tes propres musiques.', 403)
      }
      session.queue.splice(idx, 1)
      if (track.addedById !== memberId) pushFeed(session, 'remove', { memberId, title: track.title }, now)
      break
    }

    case 'bump': {
      const track = session.queue.find((t) => t.id === p.trackId)
      if (!track) return fail('Musique introuvable dans la file.', 404)
      if (track.addedById === memberId) {
        return fail('Tu ne peux pas voter pour ta propre musique.')
      }
      const i = track.bumpVotes.indexOf(memberId)
      if (i >= 0) track.bumpVotes.splice(i, 1)
      else track.bumpVotes.push(memberId)
      break
    }

    case 'voteSkip': {
      const current = session.current
      if (!current) return fail('Rien à passer.')
      const i = session.skipVotes.indexOf(memberId)
      if (i >= 0) session.skipVotes.splice(i, 1)
      else session.skipVotes.push(memberId)
      // Le seuil se calcule sur la salle RÉELLE : les membres connectés, pas tous ceux qui sont
      // passés un jour par le salon (avant, quatre absents suffisaient à rendre le vote impossible).
      const { votes, needed } = skipStatus(session, ctx.onlineIds, group.members.length)
      if (votes >= needed) {
        pushFeed(session, 'skip', { title: current.title, count: votes }, now)
        advance(session, now)
      } else if (i < 0) {
        pushFeed(session, 'skipVote', { memberId, title: current.title, count: votes, needed }, now)
      }
      break
    }

    case 'hostSkip': {
      if (!isHost) return fail("Seul·e l'hôte peut forcer le passage.", 403)
      if (!session.current) return fail('Rien à passer.')
      pushFeed(session, 'hostSkip', { memberId, title: session.current.title }, now)
      advance(session, now)
      break
    }

    case 'setPlayback': {
      if (!isHost) return fail("Seul·e l'hôte contrôle la lecture.", 403)
      if (!session.current) return fail('Rien à lire.')
      setPlayback(session, !!p.isPlaying, now)
      break
    }

    case 'playNext': {
      if (!isHost) return fail("Seul·e l'hôte peut choisir le morceau suivant.", 403)
      const track = session.queue.find((t) => t.id === p.trackId)
      if (!track) return fail('Musique introuvable dans la file.', 404)
      // Deuxième appui : on rend le morceau à l'ordre équitable.
      track.pinnedAt = track.pinnedAt ? null : now
      if (track.pinnedAt) pushFeed(session, 'playNext', { memberId, title: track.title }, now)
      break
    }

    case 'settings': {
      if (!isHost) return fail("Seul·e l'hôte règle la platine.", 403)
      if (p.output === 'tv' && session.source !== 'youtube') return fail('La TV ne lit que la source YouTube.')
      const { outputChanged } = applySettings(session, p, now)
      // Le son quitte la TV : on la libère tout de suite, la platine-appareil (en veille) reprend.
      const bound = bindings.get(groupId)
      if (outputChanged && session.settings.output === 'device' && bound?.kind === 'tv') {
        bindings.delete(groupId)
        freezeAnchor(session, now)
        result = { ok: true, broadcast: 'room', displacedSocketId: bound.socketId }
      }
      break
    }

    case 'react': {
      const current = session.current
      const emoji = typeof p.emoji === 'string' ? p.emoji : ''
      if (!(MUSIC_REACTIONS as readonly string[]).includes(emoji)) return fail('Réaction inconnue.')
      if (!current) return fail('Rien à applaudir pour le moment.')
      const key = `${groupId}:${memberId}`
      if (now - (lastReactionAt.get(key) ?? 0) < REACTION_COOLDOWN_MS) return NONE
      lastReactionAt.set(key, now)

      const reactedBy = (current.reactedBy ??= {})
      const counts = (current.reactions ??= {})
      // Au-delà du plafond, la réaction s'affiche encore (elle s'envole sur les écrans) mais ne compte
      // plus : une seule personne ne peut pas faire d'un morceau « le plus applaudi de la soirée ».
      if ((reactedBy[memberId] ?? 0) < REACTIONS_PER_MEMBER_CAP) {
        reactedBy[memberId] = (reactedBy[memberId] ?? 0) + 1
        counts[emoji] = (counts[emoji] ?? 0) + 1
        const entry = session.pool?.find((e) => e.sourceId === current.sourceId)
        if (entry) entry.reactions += 1
        session.djReactions[current.addedById] = (session.djReactions[current.addedById] ?? 0) + 1
        writeMusic(groupId, session)
      }
      return {
        ok: true,
        broadcast: 'none',
        reaction: { id: makeId('rx'), memberId, emoji, trackId: current.id, counts: { ...counts } },
      }
    }

    default:
      return fail('Action musicale inconnue.')
  }

  commit(groupId, session, now)
  return result
}

/**
 * Un membre vient de partir : le seuil du vote pour passer baisse peut-être assez pour que les voix
 * déjà exprimées suffisent. Rend vrai si le morceau a changé.
 */
export function recheckSkip(groupId: string, onlineIds: string[], memberCount: number, now = Date.now()): boolean {
  if (onlineIds.length === 0) return false
  const session = readMusic(groupId)
  if (!session?.current || session.endedAt || session.skipVotes.length === 0) return false
  const { votes, needed } = skipStatus(session, onlineIds, memberCount)
  if (votes < needed) return false
  pushFeed(session, 'skip', { title: session.current.title, count: votes }, now)
  advance(session, now)
  commit(groupId, session, now)
  return true
}
