import { readDb, writeDb } from './db'
import type { MusicSession, MusicSource, MusicTrack } from '../src/types'
import { findAuthorizedMember, isApiError, type ApiError } from './store'
import {
  orderedQueue,
  skipThreshold,
  isValidSourceId,
  MUSIC_HISTORY_CAP,
  MAX_QUEUE_PER_PLAYER,
  MAX_TRACK_TITLE,
  MAX_TRACK_ARTIST,
} from '../src/lib/jukebox'

type Ok = { ok: true }
const OK: Ok = { ok: true }

function makeTrackId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function clampText(value: unknown, max: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().slice(0, max)
  return trimmed || fallback
}

/** Moves to the next track by fair (round-robin) order, retiring the current one into history and
 * bumping its owner's played count so the rotation stays even. Called on natural end, vote-skip and
 * host skip alike — the single place the "what plays next" rule lives on the server. */
function advance(session: MusicSession): void {
  const next = orderedQueue(session)[0] ?? null

  if (session.current) {
    session.history.unshift(session.current)
    if (session.history.length > MUSIC_HISTORY_CAP) session.history.length = MUSIC_HISTORY_CAP
  }

  if (next) {
    session.queue = session.queue.filter((t) => t.id !== next.id)
    session.playedCounts[next.addedById] = (session.playedCounts[next.addedById] ?? 0) + 1
    session.current = next
    session.currentStartedAt = Date.now()
    session.isPlaying = true
  } else {
    session.current = null
    session.currentStartedAt = null
    session.isPlaying = false
  }
  session.skipVotes = []
}

// ---- Host lifecycle -------------------------------------------------------

export function startMusic(
  groupId: string,
  memberId: string,
  memberToken: string,
  source: MusicSource,
): Ok | ApiError {
  const db = readDb()
  const auth = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(auth)) return auth
  const { group } = auth

  if (group.party.hostMemberId !== memberId) {
    return { error: "Seul·e l'hôte peut lancer le mode soirée.", status: 403 }
  }
  if (group.party.status === 'playing') {
    return { error: 'Termine la partie en cours avant de lancer le mode soirée.', status: 400 }
  }
  if (source !== 'youtube' && source !== 'spotify') {
    return { error: 'Source musicale invalide.', status: 400 }
  }

  group.music = {
    source,
    hostMemberId: memberId,
    queue: [],
    current: null,
    history: [],
    isPlaying: false,
    skipVotes: [],
    playedCounts: {},
    platineId: null,
    currentStartedAt: null,
    startedAt: Date.now(),
  }
  writeDb(db)
  return OK
}

export function stopMusic(groupId: string, memberId: string, memberToken: string): Ok | ApiError {
  const db = readDb()
  const auth = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(auth)) return auth
  const { group } = auth

  if (!group.music) return OK
  if (group.music.hostMemberId !== memberId && group.party.hostMemberId !== memberId) {
    return { error: "Seul·e l'hôte peut arrêter le mode soirée.", status: 403 }
  }
  group.music = null
  writeDb(db)
  return OK
}

// ---- Player actions -------------------------------------------------------

interface AddTrackPayload {
  source?: string
  sourceId?: string
  title?: string
  artist?: string
  thumbnail?: string | null
  durationMs?: number | null
}

export function musicAction(
  groupId: string,
  memberId: string,
  memberToken: string,
  type: string,
  payload: unknown,
): Ok | ApiError {
  const db = readDb()
  const auth = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(auth)) return auth
  const { group } = auth
  const session = group.music
  if (!session) return { error: 'Aucun mode soirée en cours.', status: 400 }
  const isHost = session.hostMemberId === memberId || group.party.hostMemberId === memberId

  switch (type) {
    case 'add': {
      const p = (payload ?? {}) as AddTrackPayload
      const source = p.source as MusicSource
      const sourceId = typeof p.sourceId === 'string' ? p.sourceId.trim() : ''
      if (source !== session.source) return { error: 'Mauvaise source musicale.', status: 400 }
      if (!isValidSourceId(source, sourceId)) return { error: 'Lien ou identifiant invalide.', status: 400 }

      const mine = session.queue.filter((t) => t.addedById === memberId).length
      if (mine >= MAX_QUEUE_PER_PLAYER) {
        return { error: `Maximum ${MAX_QUEUE_PER_PLAYER} musiques en attente par personne.`, status: 400 }
      }
      // De-dupe: same track already queued or currently playing.
      if (
        session.queue.some((t) => t.sourceId === sourceId) ||
        session.current?.sourceId === sourceId
      ) {
        return { error: 'Cette musique est déjà dans la file.', status: 409 }
      }

      const track: MusicTrack = {
        id: makeTrackId(),
        source,
        sourceId,
        title: clampText(p.title, MAX_TRACK_TITLE, 'Titre inconnu'),
        artist: clampText(p.artist, MAX_TRACK_ARTIST, ''),
        thumbnail: typeof p.thumbnail === 'string' && p.thumbnail.startsWith('http') ? p.thumbnail : null,
        durationMs: typeof p.durationMs === 'number' && p.durationMs > 0 ? p.durationMs : null,
        addedById: memberId,
        bumpVotes: [],
        addedAt: Date.now(),
      }
      session.queue.push(track)
      // First song of the session (or after the queue drained): promote it straight to now-playing.
      if (!session.current) advance(session)
      break
    }

    case 'remove': {
      const trackId = (payload as { trackId?: string })?.trackId
      const idx = session.queue.findIndex((t) => t.id === trackId)
      if (idx < 0) return { error: 'Musique introuvable dans la file.', status: 404 }
      if (session.queue[idx].addedById !== memberId && !isHost) {
        return { error: 'Tu ne peux retirer que tes propres musiques.', status: 403 }
      }
      session.queue.splice(idx, 1)
      break
    }

    case 'bump': {
      const trackId = (payload as { trackId?: string })?.trackId
      const track = session.queue.find((t) => t.id === trackId)
      if (!track) return { error: 'Musique introuvable dans la file.', status: 404 }
      if (track.addedById === memberId) {
        return { error: 'Tu ne peux pas voter pour ta propre musique.', status: 400 }
      }
      const i = track.bumpVotes.indexOf(memberId)
      if (i >= 0) track.bumpVotes.splice(i, 1)
      else track.bumpVotes.push(memberId)
      break
    }

    case 'voteSkip': {
      if (!session.current) return { error: 'Rien à passer.', status: 400 }
      const i = session.skipVotes.indexOf(memberId)
      if (i >= 0) session.skipVotes.splice(i, 1)
      else session.skipVotes.push(memberId)
      if (session.skipVotes.length >= skipThreshold(group.members.length)) advance(session)
      break
    }

    case 'hostSkip': {
      if (!isHost) return { error: "Seul·e l'hôte peut forcer le passage.", status: 403 }
      if (!session.current) return { error: 'Rien à passer.', status: 400 }
      advance(session)
      break
    }

    case 'setPlayback': {
      if (!isHost) return { error: "Seul·e l'hôte contrôle la lecture.", status: 403 }
      if (!session.current) return { error: 'Rien à lire.', status: 400 }
      session.isPlaying = !!(payload as { isPlaying?: boolean })?.isPlaying
      break
    }

    default:
      return { error: 'Action musicale inconnue.', status: 400 }
  }

  writeDb(db)
  return OK
}

// ---- Platine (playback device) actions — no member auth, keyed by opaque platineId -------------

export function claimPlatine(groupId: string, platineId: string): Ok | ApiError {
  if (!platineId) return { error: 'Platine invalide.', status: 400 }
  const db = readDb()
  const group = db.groups.find((g) => g.id === groupId)
  if (!group || !group.music) return { error: 'Aucun mode soirée en cours.', status: 400 }
  group.music.platineId = platineId
  writeDb(db)
  return OK
}

/** The platine reports that the current track finished playing — advance to the next one, but only
 * if this really is the active platine and the ended track is still the current one (guards against
 * a stale/duplicate platine double-skipping). */
export function platineTrackEnded(groupId: string, platineId: string, trackId: string): Ok | ApiError {
  const db = readDb()
  const group = db.groups.find((g) => g.id === groupId)
  if (!group || !group.music) return { error: 'Aucun mode soirée en cours.', status: 400 }
  const session = group.music
  if (session.platineId && session.platineId !== platineId) return OK
  if (!session.current || session.current.id !== trackId) return OK
  advance(session)
  writeDb(db)
  return OK
}
