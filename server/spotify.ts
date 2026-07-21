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
  if (!CLIENT_ID || !CLIENT_SECRET) return null
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
    if (!res.ok) return null
    const data = (await res.json()) as { access_token: string; expires_in: number }
    appToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
    return appToken.value
  } catch {
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
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      res.status(502).json({ error: 'Recherche Spotify indisponible.' })
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
  } catch {
    res.status(502).json({ error: 'Recherche Spotify indisponible.' })
  }
}
