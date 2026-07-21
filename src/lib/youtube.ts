/**
 * Thin wrapper around the free YouTube IFrame Player API (no API key, no login needed to *play*).
 * The platine page uses this to host the actual player; phones only ever send video ids.
 *
 * Search and rich metadata are optional niceties: metadata comes from the keyless oEmbed endpoint,
 * and search only lights up when a YouTube Data API key is provided at build time
 * (VITE_YOUTUBE_API_KEY). Without a key, users add songs by pasting a link — which always works.
 */

import { youtubeThumb } from './jukebox'

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  loadVideoById(id: string): void
  cueVideoById(id: string): void
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

/** Keyless title/author lookup via YouTube's oEmbed endpoint. Best-effort — returns null on any
 * failure (offline, CORS, deleted video), and callers fall back to a placeholder title. */
export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: controller.signal },
    ).finally(() => clearTimeout(timeout))
    if (!res.ok) return null
    const data = (await res.json()) as { title?: string; author_name?: string }
    return { title: data.title ?? '', artist: data.author_name ?? '' }
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

function splitEnv(value: unknown, fallback: string[]): string[] {
  if (typeof value !== 'string' || !value.trim()) return fallback
  return value.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
}

/** Instances publiques (open-source) qui exposent une recherche YouTube en JSON, sans clé. Ces
 * instances vont et viennent — surchargeables via VITE_PIPED_INSTANCES / VITE_INVIDIOUS_INSTANCES. */
const PIPED_INSTANCES = splitEnv(import.meta.env.VITE_PIPED_INSTANCES, [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.private.coffee',
])
const INVIDIOUS_INSTANCES = splitEnv(import.meta.env.VITE_INVIDIOUS_INSTANCES, [
  'https://invidious.fdn.fr',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
])

async function fetchJson(url: string, ms = 5000): Promise<unknown | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ms)
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout))
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

interface PipedItem { url?: string; title?: string; uploaderName?: string; duration?: number; thumbnail?: string }
async function searchViaPiped(query: string): Promise<YouTubeSearchResult[] | null> {
  for (const base of PIPED_INSTANCES) {
    const data = await fetchJson(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`)
    const items = (data as { items?: PipedItem[] } | null)?.items
    if (!Array.isArray(items) || items.length === 0) continue
    const results = items
      .map((it): YouTubeSearchResult | null => {
        const q = it.url?.split('?')[1]
        const videoId = q ? new URLSearchParams(q).get('v') ?? '' : ''
        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null
        return {
          videoId,
          title: it.title ?? 'Vidéo YouTube',
          artist: it.uploaderName ?? '',
          thumbnail: it.thumbnail || youtubeThumb(videoId),
          durationMs: typeof it.duration === 'number' && it.duration > 0 ? it.duration * 1000 : null,
        }
      })
      .filter((r): r is YouTubeSearchResult => r !== null)
    if (results.length) return results.slice(0, 15)
  }
  return null
}

interface InvidiousItem { videoId?: string; title?: string; author?: string; lengthSeconds?: number; videoThumbnails?: { url?: string }[] }
async function searchViaInvidious(query: string): Promise<YouTubeSearchResult[] | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    const data = await fetchJson(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`)
    if (!Array.isArray(data) || data.length === 0) continue
    const results = (data as InvidiousItem[])
      .map((it): YouTubeSearchResult | null => {
        const videoId = it.videoId ?? ''
        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null
        return {
          videoId,
          title: it.title ?? 'Vidéo YouTube',
          artist: it.author ?? '',
          thumbnail: it.videoThumbnails?.[0]?.url || youtubeThumb(videoId),
          durationMs: typeof it.lengthSeconds === 'number' && it.lengthSeconds > 0 ? it.lengthSeconds * 1000 : null,
        }
      })
      .filter((r): r is YouTubeSearchResult => r !== null)
    if (results.length) return results.slice(0, 15)
  }
  return null
}

/** Official YouTube Data API search — only when a key is configured. No duration (that needs a
 * second contentDetails call), so durationMs stays null here. */
async function searchViaOfficialApi(query: string): Promise<YouTubeSearchResult[]> {
  if (!YOUTUBE_API_KEY) throw new Error('YouTube search is not configured')
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=12` +
    `&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('La recherche YouTube a échoué.')
  const data = (await res.json()) as {
    items: { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string }; default?: { url: string } } } }[]
  }
  return data.items
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id.videoId,
      title: it.snippet.title,
      artist: it.snippet.channelTitle,
      thumbnail: it.snippet.thumbnails.medium?.url ?? it.snippet.thumbnails.default?.url ?? youtubeThumb(it.id.videoId),
      durationMs: null,
    }))
}

/**
 * Recherche YouTube "hybride" : on tente d'abord une instance publique sans clé (Piped puis
 * Invidious), et on retombe sur l'API officielle si une clé est configurée. Les joueurs n'ont
 * ainsi jamais à coller de lien ni à configurer quoi que ce soit.
 */
export async function searchYouTubeHybrid(query: string): Promise<YouTubeSearchResult[]> {
  const piped = await searchViaPiped(query)
  if (piped && piped.length) return piped
  const invidious = await searchViaInvidious(query)
  if (invidious && invidious.length) return invidious
  if (YOUTUBE_API_KEY) return searchViaOfficialApi(query)
  throw new Error('Recherche indisponible pour le moment — colle un lien YouTube.')
}
