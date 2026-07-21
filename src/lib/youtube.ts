/**
 * Thin wrapper around the free YouTube IFrame Player API (no API key, no login needed to *play*).
 * The platine page uses this to host the actual player; phones only ever send video ids.
 *
 * Search and rich metadata are optional niceties: metadata comes from the keyless oEmbed endpoint,
 * and search only lights up when a YouTube Data API key is provided at build time
 * (VITE_YOUTUBE_API_KEY). Without a key, users add songs by pasting a link — which always works.
 */

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
export const youtubeSearchEnabled = !!YOUTUBE_API_KEY

export interface YouTubeSearchResult {
  videoId: string
  title: string
  artist: string
  thumbnail: string
}

/** Searches YouTube (music category) via the Data API. Only usable when a key is configured. */
export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
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
      thumbnail: it.snippet.thumbnails.medium?.url ?? it.snippet.thumbnails.default?.url ?? '',
    }))
}
