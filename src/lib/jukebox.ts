import type { MusicAnchor, MusicSession, MusicSettings, MusicTrack } from '../types'

/** Cap on the "already played" history we keep in the session (small, so broadcasts stay light). */
export const MUSIC_HISTORY_CAP = 30
export const MAX_QUEUE_PER_PLAYER = 8
export const MAX_TRACK_TITLE = 160
export const MAX_TRACK_ARTIST = 120
/** Une dédicace tient sur une ligne de téléphone : au-delà, ce n'est plus un mot, c'est un message. */
export const MAX_DEDICATION = 80
export const MAX_CROSSFADE_SEC = 12
/** Fil d'activité : on ne garde que les derniers faits, l'écran n'en montre jamais plus de trois. */
export const MUSIC_FEED_CAP = 12
/** Réservoir du mode continu et du récap (serveur seulement). */
export const MUSIC_POOL_CAP = 150
/** Une même personne ne peut pas faire « applaudir » un morceau à elle seule : au-delà de ce nombre
 * de réactions sur un passage, les siennes s'affichent encore mais ne comptent plus. */
export const REACTIONS_PER_MEMBER_CAP = 12
/** Durée supposée d'un morceau dont on ignore la durée (lien collé, avant que la platine la lise). */
export const AVERAGE_TRACK_MS = 3.5 * 60_000
/** Volume relatif de la platine pendant une partie quand « baisser pendant les jeux » est actif. */
export const DUCK_FACTOR = 0.45

/** Les réactions au morceau en cours. Des emojis, et c'est voulu : c'est de l'expression humaine,
 * pas de l'interface (voir docs/design-system.md). Toutes comptent comme des applaudissements. */
export const MUSIC_REACTIONS = ['🔥', '❤️', '🙌', '💃', '🤘', '😂'] as const
export type MusicReaction = (typeof MUSIC_REACTIONS)[number]

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  volume: 80,
  crossfadeSec: 5,
  duck: true,
  continuous: true,
  output: 'device',
}

/**
 * Fair play order (round-robin) derived from the raw insertion-ordered queue.
 *
 * Each pending track gets an `rrRank` = (how many songs its owner has already had played this
 * session) + (this track's index among that owner's *other* pending tracks). So everyone's next
 * song competes at the same depth, and whoever has had the least airtime comes first — nobody can
 * hog the speaker by spamming 5 songs in a row. Bump votes only break ties within the same depth,
 * so voting nudges a song up without ever letting one person jump the whole rotation.
 *
 * Seule exception : « jouer ensuite » de l'hôte. Un morceau épinglé passe devant tout le monde (le
 * dernier épinglé d'abord — c'est le sens de « ensuite »), le reste garde l'ordre équitable.
 */
export function orderedQueue(session: Pick<MusicSession, 'queue' | 'playedCounts'>): MusicTrack[] {
  const pinned = session.queue.filter((t) => t.pinnedAt).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
  const perOwnerSeen: Record<string, number> = {}
  const decorated = session.queue
    .filter((t) => !t.pinnedAt)
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
  return [...pinned, ...decorated.map((d) => d.track)]
}

/** Le morceau qui passera après celui en cours : la tête de la file, sinon la proposition du mode
 * continu. C'est ce que la platine lance en fondu enchaîné — et ce qu'elle annonce au serveur. */
export function peekNext(session: MusicSession): MusicTrack | null {
  return orderedQueue(session)[0] ?? (session.settings.continuous ? session.autoNext : null)
}

/** Votes needed to skip the current track, among the members actually CONNECTED: majority, min 2
 * as soon as two people are there — but a lone listener can skip on their own. Host can always force. */
export function skipThreshold(onlineCount: number): number {
  if (onlineCount <= 1) return 1
  return Math.max(2, Math.ceil(onlineCount / 2))
}

/** Où en est le vote pour passer. Seules les voix des membres connectés comptent : quelqu'un qui a
 * voté puis fermé son téléphone ne pèse plus, et le seuil suit la salle réelle. Sans liste de
 * présence (vue REST), tout le monde est réputé là. */
export function skipStatus(
  session: Pick<MusicSession, 'skipVotes'>,
  onlineIds: readonly string[],
  memberCount: number,
): { votes: number; needed: number } {
  if (onlineIds.length === 0) return { votes: session.skipVotes.length, needed: skipThreshold(memberCount) }
  const online = new Set(onlineIds)
  return {
    votes: session.skipVotes.filter((id) => online.has(id)).length,
    needed: skipThreshold(online.size),
  }
}

/** Position courante déduite de l'ancre, bornée à la durée connue. `serverNow` = horloge serveur. */
export function anchorPosition(anchor: MusicAnchor | null, serverNow: number, durationMs?: number | null): number {
  if (!anchor) return 0
  const pos = anchor.playing ? anchor.positionMs + Math.max(0, serverNow - anchor.at) : anchor.positionMs
  return durationMs ? Math.min(pos, durationMs) : pos
}

/** Délai avant le passage de chaque morceau de la file (ms, à partir de `serverNow`). Une durée
 * inconnue compte pour un morceau moyen : c'est une estimation, l'écran l'affiche avec un « ~ ». */
export function queueEtas(session: MusicSession, serverNow: number): Record<string, number> {
  let t = 0
  if (session.current) {
    const dur = session.current.durationMs ?? AVERAGE_TRACK_MS
    t = Math.max(0, dur - anchorPosition(session.anchor, serverNow, dur))
  }
  const etas: Record<string, number> = {}
  for (const track of orderedQueue(session)) {
    etas[track.id] = t
    t += track.durationMs ?? AVERAGE_TRACK_MS
  }
  return etas
}

/** Volume réellement envoyé au lecteur (0-100) : le volume maître, baissé pendant une partie. */
export function effectiveVolume(settings: MusicSettings, gameRunning: boolean): number {
  return Math.round(settings.volume * (settings.duck && gameRunning ? DUCK_FACTOR : 1))
}

function isInvisible(c: number): boolean {
  return (
    c < 0x20 ||
    (c >= 0x7f && c <= 0x9f) ||
    (c >= 0x200b && c <= 0x200f) ||
    (c >= 0x2028 && c <= 0x202e) ||
    (c >= 0x2060 && c <= 0x206f) ||
    c === 0xfeff
  )
}

/** Nettoie une dédicace : sans caractères de contrôle ni invisibles, sur une seule ligne, courte. */
export function cleanDedication(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = Array.from(raw.slice(0, MAX_DEDICATION * 4))
    // Contrôles, séparateurs de ligne et caractères invisibles (zéro-largeur, marques de sens) :
    // remplacés par une espace, pour qu'une dédicace ne puisse ni casser la ligne ni se déguiser.
    .map((ch) => (isInvisible(ch.codePointAt(0) ?? 0) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return Array.from(text).slice(0, MAX_DEDICATION).join('').trim()
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
    const host = url.hostname.replace(/^(www|m|music)\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1, 12)
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = url.searchParams.get('v')
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
      const m = url.pathname.match(/\/(?:shorts|embed|v|live)\/([a-zA-Z0-9_-]{11})/)
      if (m) return m[1]
    }
  } catch {
    return null
  }
  return null
}

/** Mentions qui encombrent les titres YouTube sans rien dire du morceau. */
const TITLE_NOISE =
  /\s*[([【]\s*(?:official|officiel(?:le)?|clip|lyrics?|paroles|audio|video|vidéo|visuali[sz]er|music video|hd|hq|4k|remaster(?:ed)?|explicit)[^)\]】]*[)\]】]/gi

/**
 * Remet un titre YouTube en forme de morceau : « Daft Punk - Get Lucky (Official Audio) » publié par
 * « DaftPunkVEVO » devient « Get Lucky » de « Daft Punk ». Prudent : on ne coupe que sur un tiret
 * unique entouré d'espaces, et on retombe sur le titre brut plutôt que sur un titre vide.
 */
export function tidyYouTubeTitle(rawTitle: string, channel: string): { title: string; artist: string } {
  const cleanChannel = channel.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim()
  let title = rawTitle.replace(TITLE_NOISE, '').replace(/\s+/g, ' ').trim()
  let artist = cleanChannel
  const parts = title.split(/\s+[-–—]\s+/)
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    artist = parts[0].trim()
    title = parts[1].trim()
  }
  return { title: title || rawTitle.trim() || 'Vidéo YouTube', artist }
}

/** Ressemble-t-il à un lien (plutôt qu'à une recherche) ? Sert à reconnaître un collage. */
export function looksLikeUrl(input: string): boolean {
  return /^(https?:\/\/|www\.|youtu\.?be|m\.youtube|music\.youtube|open\.spotify)/i.test(input.trim())
}

/** Identifiant d'un titre Spotify depuis un lien collé (`open.spotify.com/track/…`, `spotify:track:…`). */
export function parseSpotifyTrackId(input: string): string | null {
  const m = input.trim().match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/|spotify:track:)([a-zA-Z0-9]{22})/)
  return m ? m[1] : null
}

/** Les miniatures YouTube (`hqdefault`) sont en 4/3 avec des bandes noires autour d'une vidéo 16/9 :
 * recadrées en carré ou en rond, il faut zoomer d'un tiers pour que les bandes disparaissent. */
export function isLetterboxedThumb(url: string | null | undefined): boolean {
  return !!url && /ytimg\.com\/vi\/[^/]+\/(?:hq|mq|sd)?default/.test(url)
}

/** Deterministic thumbnail URL for a YouTube video — no API key needed. */
export function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/** Playlist YouTube SANS compte : un simple lien qui enchaîne jusqu'à 50 vidéos. */
export const YOUTUBE_PLAYLIST_MAX = 50
export function youtubePlaylistUrl(videoIds: readonly string[]): string {
  const ids = videoIds.filter((id) => /^[a-zA-Z0-9_-]{11}$/.test(id)).slice(0, YOUTUBE_PLAYLIST_MAX)
  return `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`
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

/** Position de lecture `m:ss`, `0:00` quand elle est inconnue (barre de progression). */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** « dans ~8 min », « dans un instant » — une attente approximative, jamais une fausse précision. */
export function formatEta(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min <= 0) return 'dans un instant'
  if (min < 60) return `dans ~${min} min`
  const h = Math.floor(min / 60)
  return `dans ~${h} h ${String(min % 60).padStart(2, '0')}`
}

/** Durée d'une soirée : « 2 h 14 », « 38 min ». */
export function formatSpan(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

/** 1er, 2ᵉ, 3ᵉ… */
export function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}ᵉ`
}

/** Sum of known durations (unknown ones count as 0). */
export function totalDurationMs(tracks: { durationMs: number | null }[]): number {
  return tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0)
}

/** Total des réactions d'un morceau. */
export function reactionTotal(track: Pick<MusicTrack, 'reactions'> | null | undefined): number {
  if (!track?.reactions) return 0
  return Object.values(track.reactions).reduce((a, b) => a + b, 0)
}

function randomKey(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/**
 * Migration douce à la lecture : une session enregistrée avant la refonte (ou par une version
 * future qui aurait ajouté un champ) est complétée avec des valeurs par défaut au lieu de casser.
 * Appelée par la base à chaque lecture — le reste du code peut donc compter sur des champs présents.
 */
export function normalizeMusicSession(raw: unknown): MusicSession | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<MusicSession>
  if (s.source !== 'youtube' && s.source !== 'spotify') return null
  const settings = { ...DEFAULT_MUSIC_SETTINGS, ...(s.settings ?? {}) }
  if (s.source !== 'youtube') settings.output = 'device'
  return {
    source: s.source,
    hostMemberId: s.hostMemberId ?? '',
    queue: Array.isArray(s.queue) ? s.queue : [],
    current: s.current ?? null,
    history: Array.isArray(s.history) ? s.history : [],
    isPlaying: !!s.isPlaying,
    skipVotes: Array.isArray(s.skipVotes) ? s.skipVotes : [],
    playedCounts: s.playedCounts ?? {},
    platineId: s.platineId ?? null,
    currentStartedAt: s.currentStartedAt ?? null,
    startedAt: s.startedAt ?? Date.now(),
    platineKey: s.platineKey || randomKey(),
    anchor:
      s.anchor ?? (s.current ? { positionMs: 0, at: s.currentStartedAt ?? Date.now(), playing: !!s.isPlaying } : null),
    settings,
    feed: Array.isArray(s.feed) ? s.feed : [],
    autoNext: s.autoNext ?? null,
    playCount: s.playCount ?? 0,
    djReactions: s.djReactions ?? {},
    pool: Array.isArray(s.pool) ? s.pool : [],
    endedAt: s.endedAt ?? null,
    recap: s.recap ?? null,
  }
}

/** Ce que reçoit un appareil : sans le réservoir (serveur seulement, et lourd), sans l'identifiant de
 * l'appareil-platine (qui permettrait de se faire passer pour lui), et sans le secret du lien de la
 * platine sauf pour l'hôte. */
export function sanitizeMusicSession(session: MusicSession, isHost: boolean): MusicSession {
  const { pool, platineKey, ...rest } = session
  void pool
  return isHost ? { ...rest, platineId: null, platineKey } : { ...rest, platineId: null }
}

export function newMusicSession(source: MusicSession['source'], hostMemberId: string, now = Date.now()): MusicSession {
  return {
    source,
    hostMemberId,
    queue: [],
    current: null,
    history: [],
    isPlaying: false,
    skipVotes: [],
    playedCounts: {},
    platineId: null,
    currentStartedAt: null,
    startedAt: now,
    platineKey: randomKey(),
    anchor: null,
    settings: { ...DEFAULT_MUSIC_SETTINGS, output: 'device' },
    feed: [],
    autoNext: null,
    playCount: 0,
    djReactions: {},
    pool: [],
    endedAt: null,
    recap: null,
  }
}
