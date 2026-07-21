import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { usePartyStore } from '../store/usePartyStore'
import { orderedQueue, formatDuration, totalDurationMs } from '../lib/jukebox'
import {
  spotifyEnabled,
  isSpotifyConnected,
  beginSpotifyAuth,
  disconnectSpotify,
  loadSpotifySdk,
  getSpotifyToken,
  playSpotifyTrack,
  type SpotifyPlayer,
  type SpotifyPlayerState,
  type SpotifyReadyEvent,
} from '../lib/spotify'

function makePlatineId(): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `pl-${uuid}`
}

/**
 * Platine Spotify : connexion du compte (Premium) sur l'appareil-platine, lecture via le Web
 * Playback SDK. La recherche/ajout se fait côté téléphones (via le serveur). Pas de fondu enchaîné
 * ici (un seul lecteur SDK) : coupure nette entre les morceaux.
 */
export function SpotifyDeck({ code }: { code: string }) {
  const navigate = useNavigate()
  const disconnect = usePartyStore((s) => s.disconnect)
  const platineClaim = usePartyStore((s) => s.platineClaim)
  const platineEnded = usePartyStore((s) => s.platineEnded)
  const reportPosition = usePartyStore((s) => s.reportPosition)

  const music = usePartyStore((s) => s.group?.music ?? null)
  const current = music?.current ?? null
  const isPlaying = music?.isPlaying ?? false
  const platineOwner = music?.platineId ?? null

  const [platineId] = useState(makePlatineId)
  const [connected, setConnected] = useState(isSpotifyConnected())
  const [started, setStarted] = useState(false)
  const [ready, setReady] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const loadedRef = useRef<string | null>(null)
  const endedGuardRef = useRef<string | null>(null)
  const lastPosRef = useRef(0)
  const lastDurRef = useRef(0)

  const isActive = !platineOwner || platineOwner === platineId
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  const startPlatine = async () => {
    setStarted(true)
    platineClaim(platineId)
    try {
      const Spotify = await loadSpotifySdk()
      const player = new Spotify.Player({
        name: 'MindMatch Platine',
        getOAuthToken: (cb) => { getSpotifyToken().then((t) => { if (t) cb(t) }) },
        volume: 1,
      })
      playerRef.current = player
      player.addListener('ready', (arg) => {
        deviceIdRef.current = (arg as SpotifyReadyEvent).device_id
        setReady(true)
      })
      player.addListener('authentication_error', () => { disconnectSpotify(); setConnected(false); setFatal('Connexion Spotify expirée — reconnecte-toi.') })
      player.addListener('account_error', () => setFatal('Un compte Spotify Premium est nécessaire pour la lecture.'))
      const ok = await player.connect()
      if (!ok) setFatal('Impossible de démarrer le lecteur Spotify.')
    } catch {
      setFatal('Impossible de charger le lecteur Spotify.')
    }
  }

  // Synchronise le lecteur avec l'état partagé (piste courante + lecture/pause).
  useEffect(() => {
    if (!ready || !deviceIdRef.current) return
    if (!isActive || !current) {
      playerRef.current?.pause().catch(() => {})
      return
    }
    if (loadedRef.current !== current.sourceId) {
      loadedRef.current = current.sourceId
      endedGuardRef.current = null
      lastPosRef.current = 0
      lastDurRef.current = 0
      playSpotifyTrack(deviceIdRef.current, current.sourceId)
      if (!isPlaying) window.setTimeout(() => playerRef.current?.pause().catch(() => {}), 500)
    } else if (isPlaying) {
      playerRef.current?.resume().catch(() => {})
    } else {
      playerRef.current?.pause().catch(() => {})
    }
  }, [ready, isActive, current, current?.sourceId, isPlaying])

  // Remonte la position + détecte la fin d'un morceau (le SDK repasse en pause à la position 0).
  useEffect(() => {
    if (!ready || !started) return
    const id = setInterval(async () => {
      const player = playerRef.current
      if (!player || !isActiveRef.current) return
      let state: SpotifyPlayerState | null = null
      try { state = await player.getCurrentState() } catch { return }
      if (!state) return
      reportPosition({ positionMs: state.position, durationMs: state.duration || null, isPlaying: !state.paused })

      const cur = usePartyStore.getState().group?.music?.current
      const endedNaturally =
        state.paused && state.position === 0 && lastPosRef.current > 3000 && lastPosRef.current >= lastDurRef.current - 4000
      if (cur && endedNaturally && endedGuardRef.current !== cur.id) {
        endedGuardRef.current = cur.id
        platineEnded(platineId, cur.id)
      }
      lastPosRef.current = state.position
      lastDurRef.current = state.duration
    }, 1000)
    return () => clearInterval(id)
  }, [ready, started, platineId, reportPosition])

  useEffect(() => () => { playerRef.current?.disconnect() }, [])

  const queue = music ? orderedQueue(music) : []

  const Header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 relative z-10">
      <div className="flex items-center gap-2">
        <span className="text-xl">🎧</span>
        <span className="font-bold">Platine Spotify</span>
        <span className="text-xs text-white/40">· Salle {code}</span>
        {started && (isActive ? (
          <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5">● active</span>
        ) : (
          <span className="text-[10px] rounded-full bg-white/10 text-white/40 px-2 py-0.5">en veille</span>
        ))}
      </div>
      <button onClick={() => { disconnect(); navigate('/') }} className="rounded-full bg-white/8 px-3 h-8 text-white/60 text-xs">
        Quitter
      </button>
    </div>
  )

  // Spotify non configuré sur ce déploiement → message joueur, sans aucun terme technique.
  if (!spotifyEnabled) {
    return (
      <div className="min-h-svh flex flex-col bg-black">
        {Header}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6 max-w-md mx-auto">
          <span className="text-5xl">🎧</span>
          <p className="text-white/70">Spotify n'est pas disponible sur cette platine.</p>
          <p className="text-white/40 text-sm">Relance le Mode Soirée en choisissant <b>YouTube</b> — ça marche tout de suite.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col bg-black relative overflow-hidden">
      {current?.thumbnail && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <img src={current.thumbnail} alt="" className="w-full h-full object-cover blur-3xl scale-125 opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-black/70 to-black/95" />
        </div>
      )}
      {Header}

      <div className="relative z-10 flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          {fatal && <p className="text-pink-300 text-sm">{fatal}</p>}

          {!connected ? (
            <>
              <span className="text-6xl">🎧</span>
              <h1 className="text-2xl font-extrabold">Connecte Spotify</h1>
              <p className="text-white/50 text-sm max-w-sm">
                Sur cet appareil branché à l'enceinte, connecte ton compte Spotify pour lire la file.
              </p>
              <Button onClick={() => beginSpotifyAuth(`#/platine/${code}`)}>Se connecter à Spotify</Button>
            </>
          ) : !started ? (
            <>
              <span className="text-6xl">🔊</span>
              <p className="text-white/60 text-sm max-w-sm">Assure-toi que cet appareil est branché à l'enceinte, puis démarre la platine.</p>
              <Button onClick={startPlatine}>▶ Démarrer la platine</Button>
              <button onClick={() => { disconnectSpotify(); setConnected(false) }} className="text-xs text-white/40 underline">
                Changer de compte Spotify
              </button>
            </>
          ) : !ready ? (
            <p className="text-white/50 text-sm">Connexion du lecteur Spotify…</p>
          ) : !isActive ? (
            <>
              <p className="text-white/70 text-sm">Une autre platine a pris le relais.</p>
              <Button variant="secondary" onClick={() => platineClaim(platineId)}>Reprendre ici</Button>
            </>
          ) : current ? (
            <>
              {current.thumbnail && <img src={current.thumbnail} alt="" className="w-56 h-56 rounded-2xl object-cover shadow-2xl" />}
              <div>
                <p className="text-2xl font-bold">{current.title}</p>
                <p className="text-white/50">
                  {current.artist}{current.artist && current.durationMs ? ' · ' : ''}{current.durationMs ? formatDuration(current.durationMs) : ''}
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="text-5xl">🎶</span>
              <p className="text-white/60 text-sm">File vide — ajoutez des musiques depuis vos téléphones.</p>
            </>
          )}
        </div>

        {/* File d'attente + stats */}
        <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-white/10 p-4 overflow-y-auto max-h-[40svh] lg:max-h-none">
          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">À suivre</p>
          <p className="text-sm text-white/70 mb-3">
            {queue.length} titre{queue.length > 1 ? 's' : ''}
            {totalDurationMs(queue) > 0 ? ` · ${formatDuration(totalDurationMs(queue))} en file` : ''}
          </p>
          {queue.length === 0 && <p className="text-white/30 text-sm">Rien pour l'instant.</p>}
          <div className="flex flex-col gap-2">
            {queue.slice(0, 14).map((t, i) => (
              <div key={t.id} className="flex items-center gap-2.5">
                <span className="text-xs text-white/30 w-4 text-right">{i + 1}</span>
                {t.thumbnail ? (
                  <img src={t.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">🎵</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{t.title}</p>
                  {(t.artist || t.durationMs) && (
                    <p className="text-[11px] text-white/40 truncate">
                      {t.artist}{t.artist && t.durationMs ? ' · ' : ''}{t.durationMs ? formatDuration(t.durationMs) : ''}
                    </p>
                  )}
                </div>
                {t.bumpVotes.length > 0 && <span className="text-[11px] text-fuchsia-300">▲{t.bumpVotes.length}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
