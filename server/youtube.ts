import type { Request, Response } from 'express'
import { tidyYouTubeTitle } from '../src/lib/jukebox'

/**
 * Recherche YouTube côté SERVEUR, pour le Mode Soirée.
 *
 * Avant, chaque téléphone interrogeait lui-même des instances publiques Piped / Invidious : souvent
 * en panne, parfois bloquées par le navigateur (CORS), et chaque téléphone redécouvrait la panne en
 * attendant cinq secondes par instance. Ici :
 *  - une clé officielle facultative (`YOUTUBE_API_KEY`, jamais exposée au navigateur) passe d'abord,
 *    avec les durées (deuxième appel `contentDetails`) ;
 *  - sinon les instances publiques, interrogées depuis le serveur, avec un disjoncteur : une instance
 *    qui vient d'échouer est sautée pendant quelques minutes, pour tous les téléphones à la fois ;
 *  - un cache de 10 minutes, comme pour Spotify : huit téléphones qui tapent « Daft Punk » ne coûtent
 *    qu'une requête.
 * Le collage d'un lien, lui, marche toujours — il ne dépend d'aucun service.
 */

const API_KEY = process.env.YOUTUBE_API_KEY?.trim() || null

function splitEnv(value: string | undefined, fallback: string[]): string[] {
  if (!value?.trim()) return fallback
  return value.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
}

/** Instances publiques (open-source) qui exposent une recherche YouTube en JSON, sans clé. Elles vont
 * et viennent — surchargeables via PIPED_INSTANCES / INVIDIOUS_INSTANCES. */
const PIPED_INSTANCES = splitEnv(process.env.PIPED_INSTANCES, [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.private.coffee',
])
const INVIDIOUS_INSTANCES = splitEnv(process.env.INVIDIOUS_INSTANCES, [
  'https://invidious.fdn.fr',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
])

const REQUEST_TIMEOUT_MS = 3500
/** Budget total d'une recherche : au-delà, mieux vaut dire « colle un lien » que faire attendre. */
const SEARCH_BUDGET_MS = 8000
const INSTANCE_COOLDOWN_MS = 5 * 60_000
const MAX_RESULTS = 12

export interface YouTubeResult {
  videoId: string
  title: string
  artist: string
  thumbnail: string
  durationMs: number | null
}

const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/

function thumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/** Durée ISO 8601 de l'API officielle (`PT1H3M12S`) en millisecondes. */
export function parseIsoDuration(iso: string | undefined): number | null {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return null
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0))
  const ms = (((d * 24 + h) * 60 + min) * 60 + s) * 1000
  return ms > 0 ? ms : null
}

function result(videoId: string, rawTitle: string, channel: string, thumbnail: string | undefined, durationMs: number | null): YouTubeResult {
  const { title, artist } = tidyYouTubeTitle(rawTitle, channel)
  return { videoId, title, artist, thumbnail: thumbnail?.startsWith('https://') ? thumbnail : thumb(videoId), durationMs }
}

// ---- Disjoncteur des instances ---------------------------------------------

const downUntil = new Map<string, number>()
const isDown = (base: string) => (downUntil.get(base) ?? 0) > Date.now()
const markDown = (base: string) => downUntil.set(base, Date.now() + INSTANCE_COOLDOWN_MS)

async function fetchJson(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---- Sources ------------------------------------------------------------------

async function searchOfficial(q: string): Promise<YouTubeResult[] | null> {
  if (!API_KEY) return null
  const search = (await fetchJson(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=${MAX_RESULTS}` +
      `&q=${encodeURIComponent(q)}&key=${API_KEY}`,
  )) as { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> } }[] } | null
  if (!search) return null
  const items = (search.items ?? []).filter((it) => VIDEO_ID.test(it.id?.videoId ?? ''))
  if (items.length === 0) return []
  // Les durées demandent un second appel, peu coûteux en quota (1 unité contre 100 pour la recherche).
  const ids = items.map((it) => it.id!.videoId!).join(',')
  const details = (await fetchJson(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${API_KEY}`)) as {
    items?: { id?: string; contentDetails?: { duration?: string } }[]
  } | null
  const durations = new Map((details?.items ?? []).map((d) => [d.id, parseIsoDuration(d.contentDetails?.duration)]))
  return items.map((it) => {
    const id = it.id!.videoId!
    const thumbs = it.snippet?.thumbnails ?? {}
    return result(id, decodeEntities(it.snippet?.title ?? ''), it.snippet?.channelTitle ?? '', thumbs.high?.url ?? thumbs.medium?.url, durations.get(id) ?? null)
  })
}

interface PipedItem { url?: string; title?: string; uploaderName?: string; duration?: number; thumbnail?: string; type?: string }
async function searchPiped(q: string, deadline: number): Promise<YouTubeResult[] | null> {
  for (const base of PIPED_INSTANCES) {
    if (isDown(base) || Date.now() > deadline) continue
    const data = (await fetchJson(`${base}/search?q=${encodeURIComponent(q)}&filter=videos`)) as { items?: PipedItem[] } | null
    if (!Array.isArray(data?.items)) {
      markDown(base)
      continue
    }
    const out = data.items
      .map((it) => {
        const query = it.url?.split('?')[1]
        const id = query ? (new URLSearchParams(query).get('v') ?? '') : ''
        if (!VIDEO_ID.test(id)) return null
        const ms = typeof it.duration === 'number' && it.duration > 0 ? it.duration * 1000 : null
        return result(id, it.title ?? '', it.uploaderName ?? '', it.thumbnail, ms)
      })
      .filter((r): r is YouTubeResult => r !== null)
    if (out.length) return out.slice(0, MAX_RESULTS)
  }
  return null
}

interface InvidiousItem { videoId?: string; title?: string; author?: string; lengthSeconds?: number; videoThumbnails?: { url?: string; quality?: string }[] }
async function searchInvidious(q: string, deadline: number): Promise<YouTubeResult[] | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    if (isDown(base) || Date.now() > deadline) continue
    const data = await fetchJson(`${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video`)
    if (!Array.isArray(data)) {
      markDown(base)
      continue
    }
    const out = (data as InvidiousItem[])
      .map((it) => {
        const id = it.videoId ?? ''
        if (!VIDEO_ID.test(id)) return null
        const ms = typeof it.lengthSeconds === 'number' && it.lengthSeconds > 0 ? it.lengthSeconds * 1000 : null
        // Les miniatures d'Invidious pointent souvent vers l'instance elle-même : on préfère celle de YouTube.
        return result(id, it.title ?? '', it.author ?? '', undefined, ms)
      })
      .filter((r): r is YouTubeResult => r !== null)
    if (out.length) return out.slice(0, MAX_RESULTS)
  }
  return null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

// ---- Cache ------------------------------------------------------------------

const CACHE_TTL_MS = 10 * 60_000
const CACHE_MAX = 300
const cache = new Map<string, { at: number; value: unknown }>()

async function cached<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T
  const value = await load()
  if (value !== null) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(key, { at: Date.now(), value })
  }
  return value
}

// ---- Routes -----------------------------------------------------------------

export async function youtubeSearchHandler(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().replace(/\s+/g, ' ').slice(0, 100) : ''
  if (q.length < 2) {
    res.json({ results: [] })
    return
  }
  const results = await cached(`search:${q.toLowerCase()}`, async () => {
    const deadline = Date.now() + SEARCH_BUDGET_MS
    return (await searchOfficial(q)) ?? (await searchPiped(q, deadline)) ?? (await searchInvidious(q, deadline))
  })
  if (!results) {
    res.status(503).json({ error: 'Recherche YouTube indisponible pour le moment — colle un lien YouTube.' })
    return
  }
  res.json({ results })
}

/** Titre et chaîne d'une vidéo (lien collé), via l'oEmbed public de YouTube — sans clé. */
export async function youtubeMetaHandler(req: Request, res: Response): Promise<void> {
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : ''
  if (!VIDEO_ID.test(id)) {
    res.status(400).json({ error: 'Identifiant YouTube invalide.' })
    return
  }
  const meta = await cached(`meta:${id}`, async () => {
    const data = (await fetchJson(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
    )) as { title?: string; author_name?: string } | null
    if (!data?.title) return null
    return result(id, data.title, data.author_name ?? '', undefined, null)
  })
  if (!meta) {
    res.status(404).json({ error: 'Vidéo introuvable.' })
    return
  }
  res.json(meta)
}
