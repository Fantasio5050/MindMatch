import type { Request, Response } from 'express'

/**
 * Recherche Spotify côté serveur via le flux "client credentials" (identifiants d'app, JAMAIS
 * exposés au navigateur). La recherche du catalogue ne nécessite pas de compte utilisateur — les
 * téléphones tapent simplement /api/spotify/search. La LECTURE, elle, se fait sur la platine avec
 * l'OAuth utilisateur (Web Playback SDK, compte Premium) côté client.
 */

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const SPOTIFY_SEARCH_LIMIT = 10
export const spotifyConfigured = !!(CLIENT_ID && CLIENT_SECRET)

let appToken: { value: string; expiresAt: number } | null = null

function spotifyImageUrl(images?: { url?: string }[]): string | null {
  return images?.find((image) => typeof image.url === 'string' && image.url.trim())?.url ?? null
}

function spotifyArtistNames(artists?: { name?: string }[]): string {
  return (artists ?? []).map((artist) => artist.name ?? '').filter(Boolean).join(', ')
}

async function getAppToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('Spotify credentials missing: SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not configured.')
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
      console.error('Spotify token request failed:', {
        status: res.status,
        statusText: res.statusText,
        body: text.slice(0, 500),
      })
      return null
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token || typeof data.expires_in !== 'number') {
      console.error('Spotify token response missing access_token or expires_in:', data)
      return null
    }

    appToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
    return appToken.value
  } catch (error) {
    console.error('Spotify token fetch threw an error:', error)
    return null
  }
}

export function spotifyConfigHandler(_req: Request, res: Response): void {
  res.json({ enabled: spotifyConfigured })
}

interface SpotifyApiTrack {
  id: string
  name: string
  duration_ms?: number
  artists?: { name: string }[]
  album?: { images?: { url: string }[] }
}

interface SpotifyCatalogItem {
  kind: 'track' | 'album' | 'artist' | 'playlist'
  id: string
  title: string
  artist: string
  subtitle?: string
  thumbnail: string | null
  durationMs: number | null
  uri?: string
}

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
    subtitle: 'Album',
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

function mapPlaylistItem(playlist: { id?: string; name?: string; owner?: { display_name?: string }; images?: { url?: string }[] } | null | undefined): SpotifyCatalogItem | null {
  if (!playlist || !playlist.id || !playlist.name) return null
  return {
    kind: 'playlist',
    id: playlist.id,
    title: playlist.name,
    artist: playlist.owner?.display_name ?? 'Spotify',
    subtitle: 'Playlist',
    thumbnail: spotifyImageUrl(playlist.images),
    durationMs: null,
    uri: `spotify:playlist:${playlist.id}`,
  }
}

export async function spotifySearchHandler(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) {
    res.json({ tracks: [], results: [] })
    return
  }
  const token = await getAppToken()
  if (!token) {
    res.status(503).json({ error: 'Spotify non disponible.' })
    return
  }
  try {
    const limit = Math.min(10, Math.max(1, SPOTIFY_SEARCH_LIMIT))
    const r = await fetch(`https://api.spotify.com/v1/search?type=track,album,artist,playlist&limit=${limit}&q=${encodeURIComponent(q)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!r.ok) {
      const text = await r.text().catch(() => '')
      console.error('Spotify search request failed:', {
        status: r.status,
        statusText: r.statusText,
        query: q,
        body: text.slice(0, 500),
      })
      res.status(502).json({
        error: 'Recherche Spotify indisponible pour le moment.',
        details: text.slice(0, 500) || 'No body returned by Spotify',
      })
      return
    }

    const data = (await r.json()) as {
      tracks?: { items?: SpotifyApiTrack[] }
      albums?: { items?: Array<{ id?: string; name?: string; artists?: { name?: string }[]; images?: { url?: string }[] }> }
      artists?: { items?: Array<{ id?: string; name?: string; images?: { url?: string }[] }> }
      playlists?: { items?: Array<{ id?: string; name?: string; owner?: { display_name?: string }; images?: { url?: string }[] }> }
    }

    const results = [
      ...(data.tracks?.items ?? []).map(mapTrackItem),
      ...(data.albums?.items ?? []).map((item) => mapAlbumItem(item)).filter(Boolean) as SpotifyCatalogItem[],
      ...(data.artists?.items ?? []).map((item) => mapArtistItem(item)).filter(Boolean) as SpotifyCatalogItem[],
      ...(data.playlists?.items ?? []).map((item) => mapPlaylistItem(item)).filter(Boolean) as SpotifyCatalogItem[],
    ]

    const tracks = results.filter((entry) => entry.kind === 'track').map((entry) => ({
      id: entry.id,
      title: entry.title,
      artist: entry.artist,
      thumbnail: entry.thumbnail,
      durationMs: entry.durationMs,
      kind: entry.kind,
      subtitle: entry.subtitle,
      uri: entry.uri,
    }))

    res.json({ tracks, results })
  } catch (error) {
    console.error('Spotify search fetch threw an error:', error)
    res.status(502).json({ error: 'Recherche Spotify indisponible pour le moment.' })
  }
}

export async function spotifyFeaturedPlaylistsHandler(_req: Request, res: Response): Promise<void> {
  const token = await getAppToken()
  if (!token) {
    res.status(503).json({ error: 'Spotify non disponible.' })
    return
  }

  try {
    const r = await fetch('https://api.spotify.com/v1/browse/featured-playlists?limit=5&country=FR', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      console.error('Spotify featured playlists failed:', { status: r.status, body: text.slice(0, 500) })
      res.status(502).json({ error: 'Playlists Spotify indisponibles.' })
      return
    }
    const data = (await r.json()) as { playlists?: { items?: Array<{ id?: string; name?: string; owner?: { display_name?: string }; images?: { url?: string }[] }> } }
    const playlists = (data.playlists?.items ?? []).map((item) => mapPlaylistItem(item)).filter(Boolean) as SpotifyCatalogItem[]
    res.json({ playlists })
  } catch (error) {
    console.error('Spotify featured playlists fetch threw an error:', error)
    res.status(502).json({ error: 'Playlists Spotify indisponibles.' })
  }
}

export async function spotifyArtistTopTracksHandler(req: Request, res: Response): Promise<void> {
  const artistId = typeof req.query.artistId === 'string' ? req.query.artistId.trim() : ''
  if (!artistId) {
    res.json({ tracks: [] })
    return
  }

  const token = await getAppToken()
  if (!token) {
    res.status(503).json({ error: 'Spotify non disponible.' })
    return
  }

  try {
    const r = await fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/top-tracks?market=FR`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      console.error('Spotify artist top tracks failed:', { artistId, status: r.status, body: text.slice(0, 500) })
      res.status(502).json({ error: 'Top tracks Spotify indisponibles.' })
      return
    }
    const data = (await r.json()) as { tracks?: SpotifyApiTrack[] }
    const tracks = (data.tracks ?? []).map(mapTrackItem)
    res.json({ tracks })
  } catch (error) {
    console.error('Spotify artist top tracks fetch threw an error:', error)
    res.status(502).json({ error: 'Top tracks Spotify indisponibles.' })
  }
}
