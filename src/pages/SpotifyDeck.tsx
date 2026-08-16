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

const DEFAULT_CROSSFADE_SEC = 3
const MAX_CROSSFADE_SEC = 10
const CROSSFADE_STORE_KEY = 'mindmatch-spotify-crossfade-sec'

function readCrossfadeSec(): number {
  if (typeof window === 'undefined') return DEFAULT_CROSSFADE_SEC
  const raw = Number(window.localStorage.getItem(CROSSFADE_STORE_KEY))
  if (!Number.isFinite(raw)) return DEFAULT_CROSSFADE_SEC
  return Math.max(0, Math.min(MAX_CROSSFADE_SEC, raw))
}

/**
 * Platine Spotify : connexion du compte (Premium) sur l'appareil-platine, lecture via le Web
 * Playback SDK. La recherche/ajout se fait côté téléphones (via le serveur).
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [crossfadeSec, setCrossfadeSec] = useState(readCrossfadeSec)

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const volumeRef = useRef(100)
  const fadeTimerRef = useRef<number | null>(null)
  const loadedRef = useRef<string | null>(null)
  const endedGuardRef = useRef<string | null>(null)
  const lastPosRef = useRef(0)
  const lastDurRef = useRef(0)
  const loadedAtRef = useRef(0)
  const everPlayedRef = useRef(false)

  const isActive = !platineOwner || platineOwner === platineId
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  const setPlayerVolume = async (value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)))
    volumeRef.current = clamped
    try { await playerRef.current?.setVolume(clamped / 100) } catch { /* pas prêt */ }
  }

  const stopVolumeFade = () => {
    if (fadeTimerRef.current) {
      window.clearInterval(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }

  const applyCrossfade = (durationSec: number) => {
    stopVolumeFade()
    if (!playerRef.current || durationSec <= 0) {
      void setPlayerVolume(100)
      return
    }
    const durationMs = durationSec * 1000
    const startAt = Date.now()
    const startVol = volumeRef.current
    const endVol = 100
    const tickMs = 50
    fadeTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startAt
      const progress = Math.min(elapsed / durationMs, 1)
      const next = startVol + (endVol - startVol) * progress
      void setPlayerVolume(next)
      if (progress >= 1) stopVolumeFade()
    }, tickMs)
  }

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
        void setPlayerVolume(100)
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
      loadedAtRef.current = Date.now()
      everPlayedRef.current = false
      stopVolumeFade()
      if (crossfadeSec > 0) {
        void setPlayerVolume(0)
        window.setTimeout(() => {
          void playSpotifyTrack(deviceIdRef.current!, current.sourceId)
          if (isPlaying) applyCrossfade(crossfadeSec)
        }, 120)
      } else {
        void playSpotifyTrack(deviceIdRef.current!, current.sourceId)
      }
      if (!isPlaying) window.setTimeout(() => playerRef.current?.pause().catch(() => {}), 500)
    } else if (isPlaying) {
      playerRef.current?.resume().catch(() => {})
    } else {
      playerRef.current?.pause().catch(() => {})
    }
  }, [ready, isActive, current, current?.sourceId, isPlaying, crossfadeSec])

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

      const session = usePartyStore.getState().group?.music
      const cur = session?.current
      if (state.position > 0) everPlayedRef.current = true

      const endedNaturally =
        state.paused && state.position === 0 && lastPosRef.current > 3000 && lastPosRef.current >= lastDurRef.current - 4000
      // Piste injouable (indisponible dans le pays, lecture refusée…) : rien n'a démarré au bout de 12 s → on passe.
      const stuck = !!session?.isPlaying && !everPlayedRef.current && Date.now() - loadedAtRef.current > 12000
      if (cur && (endedNaturally || stuck) && endedGuardRef.current !== cur.id) {
        endedGuardRef.current = cur.id
        platineEnded(platineId, cur.id)
      }
      lastPosRef.current = state.position
      lastDurRef.current = state.duration
    }, 1000)
    return () => clearInterval(id)
  }, [ready, started, platineId, reportPosition])

  useEffect(() => () => {
    stopVolumeFade()
    playerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(CROSSFADE_STORE_KEY, String(crossfadeSec)) } catch { /* stockage indispo */ }
  }, [crossfadeSec])

  const queue = music ? orderedQueue(music) : []

  const Header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-line relative z-10">
      <div className="flex items-center gap-2">
        <span className="text-xl">🎧</span>
        <span className="font-bold">Platine Spotify</span>
        <span className="text-xs text-chalk-faint">· Salle {code}</span>
        {started && (isActive ? (
          <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5">● active</span>
        ) : (
          <span className="text-[10px] rounded-full bg-felt-raised text-chalk-faint px-2 py-0.5">en veille</span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="rounded-full bg-felt-raised px-2.5 h-8 text-chalk-soft text-xs"
          aria-label="Réglages platine Spotify"
        >
          ⚙️ {crossfadeSec === 0 ? 'coupé' : `${crossfadeSec}s`}
        </button>
        <button onClick={() => { disconnect(); navigate('/') }} className="rounded-full bg-felt-raised px-3 h-8 text-chalk-soft text-xs">
          Quitter
        </button>
      </div>
    </div>
    {settingsOpen && (
      <div className="absolute right-4 top-16 z-50 w-72 rounded-2xl border border-line bg-[#171122] p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Fondu entre morceaux</span>
          <button onClick={() => setSettingsOpen(false)} className="text-chalk-faint hover:text-chalk-soft text-lg">✕</button>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-chalk-muted">Durée</span>
          <span className="text-sm text-emerald-300 font-mono">{crossfadeSec === 0 ? 'Coupé' : `${crossfadeSec}s`}</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_CROSSFADE_SEC}
          step={1}
          value={crossfadeSec}
          onChange={(e) => setCrossfadeSec(Number(e.target.value))}
          className="w-full accent-emerald-400"
          aria-label="Durée du fondu Spotify"
        />
        <p className="text-[11px] text-chalk-faint mt-3 leading-snug">
          {crossfadeSec === 0 ? '🔇 Transition nette entre les morceaux.' : `🔊 Volume monte en ${crossfadeSec}s au début de chaque piste.`}
        </p>
      </div>
    )}
  )

  // Spotify non configuré sur ce déploiement → message joueur, sans aucun terme technique.
  if (!spotifyEnabled) {
    return (
      <div className="min-h-svh flex flex-col bg-black">
        {Header}
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6 max-w-md mx-auto">
          <span className="text-5xl">🎧</span>
          <p className="text-chalk-muted">Spotify n'est pas disponible sur cette platine.</p>
          <p className="text-chalk-faint text-sm">Relance le Mode Soirée en choisissant <b>YouTube</b> — ça marche tout de suite.</p>
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
              <p className="text-chalk-soft text-sm max-w-sm">
                Sur cet appareil branché à l'enceinte, connecte ton compte Spotify pour lire la file.
              </p>
              <Button onClick={() => beginSpotifyAuth(`#/platine/${code}`)}>Se connecter à Spotify</Button>
            </>
          ) : !started ? (
            <>
              <span className="text-6xl">🔊</span>
              <p className="text-chalk-soft text-sm max-w-sm">Assure-toi que cet appareil est branché à l'enceinte, puis démarre la platine.</p>
              <Button onClick={startPlatine}>▶ Démarrer la platine</Button>
              <button onClick={() => { disconnectSpotify(); setConnected(false) }} className="text-xs text-chalk-faint underline">
                Changer de compte Spotify
              </button>
            </>
          ) : !ready ? (
            <p className="text-chalk-soft text-sm">Connexion du lecteur Spotify…</p>
          ) : !isActive ? (
            <>
              <p className="text-chalk-muted text-sm">Une autre platine a pris le relais.</p>
              <Button variant="secondary" onClick={() => platineClaim(platineId)}>Reprendre ici</Button>
            </>
          ) : current ? (
            <>
              {current.thumbnail && <img src={current.thumbnail} alt="" className="w-56 h-56 rounded-2xl object-cover shadow-2xl" />}
              <div>
                <p className="text-2xl font-bold">{current.title}</p>
                <p className="text-chalk-soft">
                  {current.artist}{current.artist && current.durationMs ? ' · ' : ''}{current.durationMs ? formatDuration(current.durationMs) : ''}
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="text-5xl">🎶</span>
              <p className="text-chalk-soft text-sm">File vide — ajoutez des musiques depuis vos téléphones.</p>
            </>
          )}
        </div>

        {/* File d'attente + stats */}
        <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-line p-4 overflow-y-auto max-h-[40svh] lg:max-h-none">
          <p className="text-xs uppercase tracking-widest text-chalk-faint mb-1">À suivre</p>
          <p className="text-sm text-chalk-muted mb-3">
            {queue.length} titre{queue.length > 1 ? 's' : ''}
            {totalDurationMs(queue) > 0 ? ` · ${formatDuration(totalDurationMs(queue))} en file` : ''}
          </p>
          {queue.length === 0 && <p className="text-chalk-faint text-sm">Rien pour l'instant.</p>}
          <div className="flex flex-col gap-2">
            {queue.slice(0, 14).map((t, i) => (
              <div key={t.id} className="flex items-center gap-2.5">
                <span className="text-xs text-chalk-faint w-4 text-right">{i + 1}</span>
                {t.thumbnail ? (
                  <img src={t.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-felt-raised flex items-center justify-center">🎵</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{t.title}</p>
                  {(t.artist || t.durationMs) && (
                    <p className="text-[11px] text-chalk-faint truncate">
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
