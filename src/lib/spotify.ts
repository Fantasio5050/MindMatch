/**
 * Intégration Spotify pour la platine :
 *  - Connexion utilisateur (OAuth PKCE) sur l'appareil-platine → lecture réelle via le Web
 *    Playback SDK (nécessite Spotify Premium). Aucun secret exposé : PKCE, pas de client secret.
 *  - Recherche du catalogue déléguée au serveur (/api/spotify/search), qui utilise les identifiants
 *    d'app côté serveur. Les téléphones n'ont donc jamais besoin de se connecter à Spotify.
 *
 * Tout est inactif tant que VITE_SPOTIFY_CLIENT_ID n'est pas fourni au build : le reste de l'appli
 * (YouTube) n'est pas impacté.
 */

export const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
export const spotifyEnabled = !!SPOTIFY_CLIENT_ID

const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state'
const TOKEN_KEY = 'mindmatch-spotify-token'
const VERIFIER_KEY = 'mindmatch-spotify-verifier'
const RETURN_KEY = 'mindmatch-spotify-return'

interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function redirectUri(): string {
  return `${window.location.origin}/`
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomVerifier(): string {
  const arr = new Uint8Array(64)
  crypto.getRandomValues(arr)
  return base64url(arr)
}

async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

function readToken(): TokenSet | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as TokenSet) : null
  } catch {
    return null
  }
}
function writeToken(t: TokenSet): void {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) } catch { /* stockage indispo */ }
}
export function disconnectSpotify(): void {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* stockage indispo */ }
}
export function isSpotifyConnected(): boolean {
  return !!readToken()
}

/** Redirige le navigateur vers l'écran de connexion Spotify (PKCE). `returnHash` = la route à
 * restaurer après le retour (ex. `#/platine/ABCDE`). */
export async function beginSpotifyAuth(returnHash: string): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) return
  const verifier = randomVerifier()
  const challenge = await challengeFromVerifier(verifier)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(RETURN_KEY, returnHash)
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}

/** À appeler au démarrage de l'app : si on revient d'une connexion Spotify (?code=…), échange le
 * code contre un jeton, nettoie l'URL et restaure la route d'origine. */
export async function handleSpotifyRedirect(): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) return
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code) return
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const ret = sessionStorage.getItem(RETURN_KEY) || '#/platine'
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  if (verifier) {
    try {
      const body = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
      })
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (res.ok) {
        const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
        writeToken({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000 })
      }
    } catch {
      /* échec silencieux — l'utilisateur pourra réessayer */
    }
  }
  // Nettoie ?code=… et restaure la route.
  url.search = ''
  window.history.replaceState({}, '', url.toString())
  window.location.hash = ret.startsWith('#') ? ret : `#${ret}`
}

/** Jeton d'accès valide (rafraîchi si besoin), ou null si non connecté. */
export async function getSpotifyToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID) return null
  let t = readToken()
  if (!t) return null
  if (Date.now() > t.expiresAt - 30_000) {
    try {
      const body = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: t.refreshToken,
      })
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) {
        disconnectSpotify()
        return null
      }
      const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
      t = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? t.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      }
      writeToken(t)
    } catch {
      return null
    }
  }
  return t.accessToken
}

// ---- Recherche (déléguée au serveur) ----

export interface SpotifySearchResult {
  id: string
  title: string
  artist: string
  subtitle?: string
  thumbnail: string | null
  durationMs: number | null
  kind?: 'track' | 'album' | 'artist' | 'playlist'
  uri?: string
}

export async function searchSpotify(query: string): Promise<SpotifySearchResult[]> {
  const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Recherche Spotify indisponible.')
  const data = (await res.json()) as { results?: SpotifySearchResult[]; tracks?: SpotifySearchResult[] }
  if (Array.isArray(data.results) && data.results.length > 0) return data.results
  return data.tracks ?? []
}

// ---- Récupération des morceaux d'un album / artiste / playlist (déléguée au serveur) ----

export async function fetchAlbumTracks(albumId: string): Promise<SpotifySearchResult[]> {
  const res = await fetch(`/api/spotify/album-tracks?albumId=${encodeURIComponent(albumId)}`)
  if (!res.ok) throw new Error('Morceaux de l\'album indisponibles.')
  const data = (await res.json()) as { tracks?: SpotifySearchResult[] }
  return data.tracks ?? []
}

export async function fetchArtistTopTracks(artistId: string): Promise<SpotifySearchResult[]> {
  const res = await fetch(`/api/spotify/artist-top-tracks?artistId=${encodeURIComponent(artistId)}`)
  if (!res.ok) throw new Error('Top tracks de l\'artiste indisponibles.')
  const data = (await res.json()) as { tracks?: SpotifySearchResult[] }
  return data.tracks ?? []
}

export async function fetchPlaylistTracks(playlistId: string): Promise<SpotifySearchResult[]> {
  const res = await fetch(`/api/spotify/playlist-tracks?playlistId=${encodeURIComponent(playlistId)}`)
  if (!res.ok) throw new Error('Morceaux de la playlist indisponibles.')
  const data = (await res.json()) as { tracks?: SpotifySearchResult[] }
  return data.tracks ?? []
}

// ---- Web Playback SDK ----

export interface SpotifyPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: { current_track: { id: string | null } | null }
}

export interface SpotifyReadyEvent { device_id: string }

export interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: string, cb: (arg: unknown) => void): boolean
  getCurrentState(): Promise<SpotifyPlayerState | null>
  pause(): Promise<void>
  resume(): Promise<void>
  setVolume(v: number): Promise<void>
}

interface SpotifyNamespace {
  Player: new (opts: { name: string; getOAuthToken: (cb: (token: string) => void) => void; volume?: number }) => SpotifyPlayer
}

declare global {
  interface Window {
    Spotify?: SpotifyNamespace
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

let sdkPromise: Promise<SpotifyNamespace> | null = null

export function loadSpotifySdk(): Promise<SpotifyNamespace> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve) => {
    if (window.Spotify) {
      resolve(window.Spotify)
      return
    }
    const previous = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      previous?.()
      if (window.Spotify) resolve(window.Spotify)
    }
    if (!document.querySelector('script[data-spotify-sdk]')) {
      const tag = document.createElement('script')
      tag.src = 'https://sdk.scdn.co/spotify-player.js'
      tag.setAttribute('data-spotify-sdk', '1')
      document.head.appendChild(tag)
    }
  })
  return sdkPromise
}

/** Démarre la lecture d'un morceau (par id) sur le device SDK de la platine, via l'API Web. */
export async function playSpotifyTrack(deviceId: string, trackId: string): Promise<void> {
  const token = await getSpotifyToken()
  if (!token) return
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
  }).catch(() => {})
}