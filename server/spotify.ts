import type { Request, Response } from 'express'

/**
 * Recherche Spotify côté serveur via le flux "client credentials" (identifiants d'app, JAMAIS
 * exposés au navigateur). La recherche du catalogue ne nécessite pas de compte utilisateur — les
 * téléphones tapent simplement /api/spotify/search. La LECTURE, elle, se fait sur la platine avec
 * l'OAuth utilisateur (Web Playback SDK, compte Premium) côté client.
 */

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
export const spotifyConfigured = !!(CLIENT_ID && CLIENT_SECRET)

let appToken: { value: string; expiresAt: number } | null = null

// ---- Helpers ---------------------------------------------------------------

function spotifyImageUrl(images?: { url?: string }[]): string | null {
  return images?.find((image) => typeof image.url === 'string' && image.url.trim())?.url ?? null
}

function spotifyArtistNames(artists?: { name?: string }[]): string {
  return (artists ?? []).map((artist) => artist.name ?? '').filter(Boolean).join(', ')
}

/** Log d'erreur Spotify factorisé — même shape partout pour faciliter le debug. */
function spotifyError(scope: string, extra: Record<string, unknown>): void {
  console.error(`Spotify ${scope}:`, extra)
}

// ---- Token -----------------------------------------------------------------

async function getAppToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    spotifyError('credentials', { message: 'SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not configured' })
    return null
  }

  if (appToken && Date.now() < appToken.expiresAt - 30_000) return appToken.value

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      spotifyError('token', { status: res.status, statusText: res.statusText, body: text.slice(0, 500) })
      return null
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token || typeof data.expires_in !== 'number') {
      spotifyError('token', { message: 'missing access_token or expires_in', data })
      return null
    }

    appToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
    return appToken.value
  } catch (error) {
    spotifyError('token', { message: 'fetch threw', error })
    return null
  }
}

// ---- Types -----------------------------------------------------------------

interface SpotifyApiTrack {
  id: string
  name: string
  duration_ms?: number
  artists?: { name: string }[]
  album?: { images?: { url: string }[] }
}

interface SpotifyCatalogItem {
  kind: 'track' | 'album' | 'artist'
  id: string
  title: string
  artist: string
  subtitle?: string
  thumbnail: string | null
  durationMs: number | null
  uri?: string
}

// ---- Mappers ---------------------------------------------------------------

function mapTrackItem(t: SpotifyApiTrack): SpotifyCatalogItem {
  return {
    kind: 'track',
    id: t.id,
    title: t.name,
    artist: spotifyArtistNames(t.artists),
    thumbnail: spotifyImageUrl(t.album?.images) ?? null,
    durationMs: typeof t.duration_ms === 'number' ? t.duration_ms : null,
    uri: `spotify:track:${t.id}`,
  }
}

function mapAlbumItem(album: { id?: string; name?: string; artists?: { name?: string }[]; images?: { url?: string }[] } | null | undefined): SpotifyCatalogItem | null {
  if (!album || !album.id || !album.name) return null
  return {
    kind: 'album',
    id: album.id,
    title: album.name,
    artist: spotifyArtistNames(album.artists),
    thumbnail: spotifyImageUrl(album.images),
    durationMs: null,
    uri: `spotify:album:${album.id}`,
  }
}

function mapArtistItem(artist: { id?: string; name?: string; images?: { url?: string }[] } | null | undefined): SpotifyCatalogItem | null {
  if (!artist || !artist.id || !artist.name) return null
  return {
    kind: 'artist',
    id: artist.id,
    title: artist.name,
    artist: 'Artiste',
    subtitle: 'Artiste',
    thumbnail: spotifyImageUrl(artist.images),
    durationMs: null,
    uri: `spotify:artist:${artist.id}`,
  }
}

// ---- Config handler --------------------------------------------------------

export function spotifyConfigHandler(_req: Request, res: Response): void {
  res.json({ enabled: spotifyConfigured })
}

// ---- Cache ------------------------------------------------------------------
//
// Depuis février 2026, une app Spotify en « development mode » a un quota serré. Or huit
// téléphones qui tapent « Hits » ou ouvrent le même album font huit fois la même requête : on
// garde donc les réponses du catalogue quelques minutes (il ne bouge pas à l'échelle d'une soirée).

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

/** GET sur l'API Web avec le jeton d'app. `null` = échec (déjà journalisé). */
async function spotifyGet<T>(scope: string, url: string): Promise<T | null> {
  const token = await getAppToken()
  if (!token) return null
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      spotifyError(scope, { status: r.status, url, body: text.slice(0, 500) })
      return null
    }
    return (await r.json()) as T
  } catch (error) {
    spotifyError(scope, { message: 'fetch threw', url, error })
    return null
  }
}

// ---- Search ----------------------------------------------------------------
//
// Pas de playlists dans les résultats : depuis février 2026, l'API ne donne plus accès au contenu
// des playlists d'autres utilisateurs, et une recherche sans compte connecté ne trouve que celles-là.
// Les proposer menait systématiquement à « Impossible de charger les morceaux ».

type SearchResponse = {
  tracks?: { items?: SpotifyApiTrack[] }
  albums?: { items?: Array<{ id?: string; name?: string; artists?: { name?: string }[]; images?: { url?: string }[] }> }
  artists?: { items?: Array<{ id?: string; name?: string; images?: { url?: string }[] }> }
}

export async function spotifySearchHandler(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
  if (!q) {
    res.json({ tracks: [], results: [] })
    return
  }
  if (!spotifyConfigured) {
    res.status(503).json({ error: 'Spotify non disponible.' })
    return
  }
  // Plafond de l'API depuis février 2026 : 10 résultats par type.
  const url = `https://api.spotify.com/v1/search?type=track,album,artist&limit=10&q=${encodeURIComponent(q)}`
  const data = await cached(`search:${q.toLowerCase()}`, () => spotifyGet<SearchResponse>('search', url))
  if (!data) {
    res.status(502).json({ error: 'Recherche Spotify indisponible pour le moment.' })
    return
  }
  const results: SpotifyCatalogItem[] = [
    ...(data.tracks?.items ?? []).filter((t) => t?.id).map(mapTrackItem),
    ...(data.albums?.items ?? []).map((item) => mapAlbumItem(item)).filter((x): x is SpotifyCatalogItem => x !== null),
    ...(data.artists?.items ?? []).map((item) => mapArtistItem(item)).filter((x): x is SpotifyCatalogItem => x !== null),
  ]
  const tracks = results.filter((entry) => entry.kind === 'track')
  res.json({ tracks, results })
}

// ---- Artist tracks ---------------------------------------------------------
//
// L'endpoint « top tracks » d'un artiste a été supprimé en février 2026. On passe par la recherche
// filtrée sur l'artiste, qui reste disponible et renvoie ses titres les plus pertinents.

export async function spotifyArtistTracksHandler(req: Request, res: Response): Promise<void> {
  const name = typeof req.query.name === 'string' ? req.query.name.trim().slice(0, 100) : ''
  if (!name) {
    res.json({ tracks: [] })
    return
  }
  const q = `artist:"${name.replace(/"/g, '')}"`
  const url = `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(q)}`
  const data = await cached(`artist:${name.toLowerCase()}`, () => spotifyGet<{ tracks?: { items?: SpotifyApiTrack[] } }>('artist-tracks', url))
  if (!data) {
    res.status(502).json({ error: "Titres de l'artiste indisponibles." })
    return
  }
  res.json({ tracks: (data.tracks?.items ?? []).filter((t) => t?.id).map(mapTrackItem) })
}

// ---- Album tracks ----------------------------------------------------------

export async function spotifyAlbumTracksHandler(req: Request, res: Response): Promise<void> {
  const albumId = typeof req.query.albumId === 'string' ? req.query.albumId.trim() : ''
  if (!/^[A-Za-z0-9]{1,64}$/.test(albumId)) {
    res.json({ tracks: [] })
    return
  }
  const url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50&market=FR`
  const data = await cached(`album:${albumId}`, () => spotifyGet<{ items?: SpotifyApiTrack[] }>('album-tracks', url))
  if (!data) {
    res.status(502).json({ error: "Morceaux de l'album indisponibles." })
    return
  }
  res.json({ tracks: (data.items ?? []).filter((t) => t?.id).map(mapTrackItem) })
}
