/**
 * Thin wrapper around the free YouTube IFrame Player API (no API key, no login needed to *play*).
 * The platine page uses this to host the actual player; phones only ever send video ids.
 *
 * La recherche et les métadonnées passent par NOTRE serveur (`/api/youtube/*`, voir
 * server/youtube.ts) : clé officielle facultative, instances publiques interrogées côté serveur, et
 * cache partagé par tous les téléphones. Le collage d'un lien, lui, ne dépend de rien.
 */

import { tidyYouTubeTitle, youtubeThumb } from './jukebox'

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  loadVideoById(id: string, startSeconds?: number): void
  cueVideoById(id: string, startSeconds?: number): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setVolume(volume: number): void
  destroy(): void
}

interface YTPlayerOptions {
  videoId?: string
  height?: string | number
  width?: string | number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: YTPlayer }) => void
    onStateChange?: (e: { data: number; target: YTPlayer }) => void
    onError?: (e: { data: number }) => void
  }
}

interface YTNamespace {
  Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayer
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number; UNSTARTED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

export type { YTNamespace, YTPlayerOptions }

let apiPromise: Promise<YTNamespace> | null = null

/** Loads the IFrame API exactly once (idempotent across the whole app) and resolves when YT is ready. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    if (!document.querySelector('script[data-yt-iframe-api]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.setAttribute('data-yt-iframe-api', '1')
      document.head.appendChild(tag)
    }
  })
  return apiPromise
}

export interface YouTubeMeta {
  title: string
  artist: string
}

async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Titre et chaîne d'une vidéo (lien collé). Le serveur d'abord (cache, oEmbed côté serveur), sinon
 * l'oEmbed public directement depuis le navigateur. Best-effort : null en cas d'échec, l'appelant
 * retombe sur un titre générique. */
export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta | null> {
  try {
    const res = await fetchWithTimeout(`/api/youtube/meta?id=${encodeURIComponent(videoId)}`, 5000)
    if (res.ok) {
      const data = (await res.json()) as { title?: string; artist?: string }
      if (data.title) return { title: data.title, artist: data.artist ?? '' }
    }
  } catch {
    /* on tente le navigateur */
  }
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      4000,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { title?: string; author_name?: string }
    if (!data.title) return null
    return tidyYouTubeTitle(data.title, data.author_name ?? '')
  } catch {
    return null
  }
}

export const YOUTUBE_API_KEY: string | undefined = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

export interface YouTubeSearchResult {
  videoId: string
  title: string
  artist: string
  thumbnail: string
  durationMs: number | null
}

/** Dernier recours, seulement si une clé est fournie au build (VITE_YOUTUBE_API_KEY) : l'API
 * officielle depuis le navigateur. Sans durée (il faudrait un second appel). */
async function searchViaOfficialApi(query: string, signal?: AbortSignal): Promise<YouTubeSearchResult[]> {
  if (!YOUTUBE_API_KEY) throw new Error('YouTube search is not configured')
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12` +
    `&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
  const res = await fetchWithTimeout(url, 6000, signal)
  if (!res.ok) throw new Error('La recherche YouTube a échoué.')
  const data = (await res.json()) as {
    items: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string }; default?: { url: string } } } }[]
  }
  return data.items
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id.videoId,
      ...tidyYouTubeTitle(it.snippet.title, it.snippet.channelTitle),
      thumbnail: it.snippet.thumbnails.medium?.url ?? it.snippet.thumbnails.default?.url ?? youtubeThumb(it.id.videoId),
      durationMs: null,
    }))
}

/**
 * Recherche YouTube : le serveur d'abord (il essaie la clé officielle puis les instances publiques,
 * et met les réponses en cache pour toute la soirée), puis l'API officielle depuis le navigateur si
 * une clé a été fournie au build. Sinon : erreur, et l'interface propose de coller un lien.
 */
export async function searchYouTube(query: string, signal?: AbortSignal): Promise<YouTubeSearchResult[]> {
  try {
    const res = await fetchWithTimeout(`/api/youtube/search?q=${encodeURIComponent(query)}`, 12_000, signal)
    if (res.ok) {
      const data = (await res.json()) as { results?: YouTubeSearchResult[] }
      return data.results ?? []
    }
  } catch (e) {
    if (signal?.aborted) throw e
  }
  if (YOUTUBE_API_KEY) return searchViaOfficialApi(query, signal)
  throw new Error('Recherche indisponible pour le moment — colle un lien YouTube.')
}
