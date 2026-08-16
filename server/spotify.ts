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

export async function spotifySearchHandler(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) {
    res.json({ tracks: [] })
    return
  }
  const token = await getAppToken()
  if (!token) {
    res.status(503).json({ error: 'Spotify non disponible.' })
    return
  }
  try {
    const r = await fetch(`https://api.spotify.com/v1/search?type=track&limit=15&q=${encodeURIComponent(q)}`, {
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

    const data = (await r.json()) as { tracks?: { items?: SpotifyApiTrack[] } }
    const tracks = (data.tracks?.items ?? []).map((t) => ({
      id: t.id,
      title: t.name,
      artist: (t.artists ?? []).map((a) => a.name).join(', '),
      thumbnail: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? null,
      durationMs: typeof t.duration_ms === 'number' ? t.duration_ms : null,
    }))
    res.json({ tracks })
  } catch (error) {
    console.error('Spotify search fetch threw an error:', error)
    res.status(502).json({ error: 'Recherche Spotify indisponible pour le moment.' })
  }
}
