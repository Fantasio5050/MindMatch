import type { MusicSession, MusicTrack } from '../types'

/** Cap on the "already played" history we keep in the session (small, so broadcasts stay light). */
export const MUSIC_HISTORY_CAP = 30
export const MAX_QUEUE_PER_PLAYER = 8
export const MAX_TRACK_TITLE = 160
export const MAX_TRACK_ARTIST = 120

/**
 * Fair play order (round-robin) derived from the raw insertion-ordered queue.
 *
 * Each pending track gets an `rrRank` = (how many songs its owner has already had played this
 * session) + (this track's index among that owner's *other* pending tracks). So everyone's next
 * song competes at the same depth, and whoever has had the least airtime comes first — nobody can
 * hog the speaker by spamming 5 songs in a row. Bump votes only break ties within the same depth,
 * so voting nudges a song up without ever letting one person jump the whole rotation.
 */
export function orderedQueue(session: MusicSession): MusicTrack[] {
  const perOwnerSeen: Record<string, number> = {}
  const decorated = [...session.queue]
    .sort((a, b) => a.addedAt - b.addedAt)
    .map((track) => {
      const ownerIndex = perOwnerSeen[track.addedById] ?? 0
      perOwnerSeen[track.addedById] = ownerIndex + 1
      const rrRank = (session.playedCounts[track.addedById] ?? 0) + ownerIndex
      return { track, rrRank }
    })

  decorated.sort(
    (a, b) =>
      a.rrRank - b.rrRank ||
      b.track.bumpVotes.length - a.track.bumpVotes.length ||
      a.track.addedAt - b.track.addedAt,
  )
  return decorated.map((d) => d.track)
}

/** Votes needed to skip the current track (majority of the room, min 2). Host can always force. */
export function skipThreshold(memberCount: number): number {
  return Math.max(2, Math.ceil(memberCount / 2))
}

/** Extracts a YouTube video id from any common URL shape (watch, youtu.be, shorts, embed) or from
 * a bare 11-char id. Returns null if nothing usable is found. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  // Bare id.
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1, 12)
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = url.searchParams.get('v')
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
      const m = url.pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/)
      if (m) return m[1]
    }
  } catch {
    return null
  }
  return null
}

/** Deterministic thumbnail URL for a YouTube video — no API key needed. */
export function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function isValidSourceId(source: MusicSession['source'], sourceId: string): boolean {
  if (source === 'youtube') return /^[a-zA-Z0-9_-]{11}$/.test(sourceId)
  if (source === 'spotify') return /^[a-zA-Z0-9]{22}$/.test(sourceId)
  return false
}

/** Formats a duration in ms as `m:ss` (or `h:mm:ss`), or `—` when unknown. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** Sum of known durations (unknown ones count as 0). */
export function totalDurationMs(tracks: { durationMs: number | null }[]): number {
  return tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0)
}
