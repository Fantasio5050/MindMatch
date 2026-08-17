import { useEffect, useRef, useState, useCallback } from 'react'
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

const DEFAULT_FADEIN_SEC = 3
const MAX_FADEIN_SEC = 10
const FADEIN_STORE_KEY = 'mindmatch-spotify-fadein-sec'
const FADEOUT_WINDOW_SEC = 4
const FADEOUT_TICK_MS = 50

function readFadeInSec(): number {
  if (typeof window === 'undefined') return DEFAULT_FADEIN_SEC
  const raw = Number(window.localStorage.getItem(FADEIN_STORE_KEY))
  if (!Number.isFinite(raw)) return DEFAULT_FADEIN_SEC
  return Math.max(0, Math.min(MAX_FADEIN_SEC, raw))
}

/** Format mm:ss depuis des millisecondes. */
function fmt(ms: number): string {
  if (!ms || ms < 0) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Platine Spotify : connexion du compte (Premium) sur l'appareil-platine, lecture via le Web
 * Playback SDK. La recherche/ajout se fait côté téléphones (via le serveur). Fondu d'entrée
 * optionnel + fade-out en fin de piste (le SDK ne supporte qu'un seul lecteur, donc pas de vrai
 * crossfade — la transition se fait par fondu de volume).
 */
export function SpotifyDeck({ code }: { code: string }) {
  const navigate = useNavigate()
  const disconnect = usePartyStore((s) => s.disconnect)
  const platineClaim = usePartyStore((s) => s.platineClaim)
  const platineEnded = usePartyStore((s) => s.platineEnded)
  const reportPosition = usePartyStore((s) => s.reportPosition)
  const musicAction = usePartyStore((s) => s.musicAction)

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
  const [fadeInSec, setFadeInSec] = useState(readFadeInSec)

  // État playback local (pour l'UI — barre de progression + timer)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playerVolumeState, setPlayerVolumeState] = useState(100)
  const [seeking, setSeeking] = useState(false)

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const volumeRef = useRef(100)
  const fadeTimerRef = useRef<number | null>(null)
  const fadeOutTimerRef = useRef<number | null>(null)
  const loadedRef = useRef<string | null>(null)
  const endedGuardRef = useRef<string | null>(null)
  const lastPosRef = useRef(0)
  const lastDurRef = useRef(0)
  const loadedAtRef = useRef(0)
  const everPlayedRef = useRef(false)
  const positionRef = useRef(0)
  const durationRef = useRef(0)
  const isPlayingRef = useRef(false)

  const isActive = !platineOwner || platineOwner === platineId
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // ---- Volume ----
  const setPlayerVolume = useCallback(async (value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)))
    volumeRef.current = clamped
    setPlayerVolumeState(clamped)
    try { await playerRef.current?.setVolume(clamped / 100) } catch { /* pas prêt */ }
  }, [])

  const stopVolumeFade = () => {
    if (fadeTimerRef.current) {
      window.clearInterval(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }

  const stopFadeOut = () => {
    if (fadeOutTimerRef.current) {
      window.clearInterval(fadeOutTimerRef.current)
      fadeOutTimerRef.current = null
    }
  }

  // ---- Fade-in (début de piste) ----
  const applyFadeIn = (durationSec: number) => {
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

  // ---- Fade-out (fin de piste) ----
  const applyFadeOut = (windowSec: number, onComplete: () => void) => {
    stopFadeOut()
    const startVol = volumeRef.current
    const durationMs = windowSec * 1000
    const startAt = Date.now()
    const tickMs = FADEOUT_TICK_MS
    fadeOutTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startAt
      const progress = Math.min(elapsed / durationMs, 1)
      const next = startVol * (1 - progress)
      void setPlayerVolume(next)
      if (progress >= 1) {
        stopFadeOut()
        onComplete()
      }
    }, tickMs)
  }

  // ---- Seek ----
  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !durationRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const targetMs = Math.round(ratio * durationRef.current)
    setSeeking(true)
    try {
      await playerRef.current.seek(targetMs)
      setPosition(targetMs)
      positionRef.current = targetMs
    } catch { /* pas prêt */ }
    setTimeout(() => setSeeking(false), 200)
  }

  // ---- Démarrage ----
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
      // État de lecture en temps réel (plus précis que le polling)
      player.addListener('player_state_changed', (state: unknown) => {
        const s = state as SpotifyPlayerState | null
        if (!s) return
        isPlayingRef.current = !s.paused
        positionRef.current = s.position
        durationRef.current = s.duration
        if (!seeking) {
          setPosition(s.position)
          setDuration(s.duration)
        }
        if (s.position > 0) everPlayedRef.current = true
      })
      const ok = await player.connect()
      if (!ok) setFatal('Impossible de démarrer le lecteur Spotify.')
    } catch {
      setFatal('Impossible de charger le lecteur Spotify.')
    }
  }

  // ---- Synchronise le lecteur avec l'état partagé ----
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
      setPosition(0)
      setDuration(current.durationMs ?? 0)
      stopVolumeFade()
      stopFadeOut()
      if (fadeInSec > 0) {
        void setPlayerVolume(0)
        window.setTimeout(() => {
          void playSpotifyTrack(deviceIdRef.current!, current.sourceId)
          if (isPlaying) applyFadeIn(fadeInSec)
        }, 120)
      } else {
        void playSpotifyTrack(deviceIdRef.current!, current.sourceId)
      }
      if (!isPlaying) window.setTimeout(() => playerRef.current?.pause().catch(() => {}), 500)
    } else if (isPlaying) {
      stopFadeOut()
      void setPlayerVolume(volumeRef.current > 0 ? volumeRef.current : 100)
      playerRef.current?.resume().catch(() => {})
    } else {
      playerRef.current?.pause().catch(() => {})
    }
  }, [ready, isActive, current, current?.sourceId, isPlaying, fadeInSec])

  // ---- Ticker : position + détection fin de piste + fade-out ----
  useEffect(() => {
    if (!ready || !started) return
    const id = setInterval(async () => {
      const player = playerRef.current
      if (!player || !isActiveRef.current) return
      let state: SpotifyPlayerState | null = null
      try { state = await player.getCurrentState() } catch { return }
      if (!state) return

      if (!seeking) {
        setPosition(state.position)
        setDuration(state.duration)
        positionRef.current = state.position
        durationRef.current = state.duration
      }

      reportPosition({ positionMs: state.position, durationMs: state.duration || null, isPlaying: !state.paused })

      const session = usePartyStore.getState().group?.music
      const cur = session?.current
      if (state.position > 0) everPlayedRef.current = true

      // Fin naturelle (le SDK repasse en pause à la position 0)
      const endedNaturally =
        state.paused && state.position === 0 && lastPosRef.current > 3000 && lastPosRef.current >= lastDurRef.current - 4000

      // Piste injouable
      const stuck = !!session?.isPlaying && !everPlayedRef.current && Date.now() - loadedAtRef.current > 12000

      // Fade-out : si on approche de la fin et qu'on n'a pas déjà commencé
      if (cur && session?.isPlaying && !state.paused && state.duration > 0 && !fadeOutTimerRef.current) {
        const remainingSec = (state.duration - state.position) / 1000
        if (remainingSec <= FADEOUT_WINDOW_SEC && remainingSec > 0.5 && state.duration > 10000) {
          const windowSec = Math.min(FADEOUT_WINDOW_SEC, remainingSec)
          applyFadeOut(windowSec, () => {
            if (cur && endedGuardRef.current !== cur.id) {
              endedGuardRef.current = cur.id
              platineEnded(platineId, cur.id)
            }
          })
        }
      }

      if (cur && (endedNaturally || stuck) && endedGuardRef.current !== cur.id) {
        endedGuardRef.current = cur.id
        stopFadeOut()
        platineEnded(platineId, cur.id)
      }

      lastPosRef.current = state.position
      lastDurRef.current = state.duration
    }, 500)
    return () => clearInterval(id)
  }, [ready, started, platineId, reportPosition, seeking])

  // ---- Cleanup ----
  useEffect(() => () => {
    stopVolumeFade()
    stopFadeOut()
    playerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(FADEIN_STORE_KEY, String(fadeInSec)) } catch { /* stockage indispo */ }
  }, [fadeInSec])

  // ---- Timer local pour l'UI (incrémente la position pendant la lecture) ----
  useEffect(() => {
    if (!isPlaying || seeking) return
    const id = setInterval(() => {
      setPosition((p) => {
        const next = p + 500
        return durationRef.current && next > durationRef.current ? durationRef.current : next
      })
    }, 500)
    return () => clearInterval(id)
  }, [isPlaying, seeking])

  // ---- Skip manuel (boutons prev/next sur la platine) ----
  const handleSkip = () => {
    stopFadeOut()
    stopVolumeFade()
    musicAction('hostSkip')
  }
  const queue = music ? orderedQueue(music) : []
  const progress = duration > 0 ? Math.min(1, position / duration) : 0

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
          ⚙️ {fadeInSec === 0 ? 'coupé' : `${fadeInSec}s`}
        </button>
        <button onClick={() => { disconnect(); navigate('/') }} className="rounded-full bg-felt-raised px-3 h-8 text-chalk-soft text-xs">
          Quitter
        </button>
      </div>
    </div>
  )

  // Spotify non configuré → message joueur
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
      {/* Fond dynamique : pochette floutée */}
      {current?.thumbnail && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <img src={current.thumbnail} alt="" className="w-full h-full object-cover blur-3xl scale-125 opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-black/70 to-black/95" />
        </div>
      )}
      {Header}
      {settingsOpen && (
        <div className="absolute right-4 top-16 z-50 w-72 rounded-2xl border border-line bg-felt-raised p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Fondu d'entrée</span>
            <button onClick={() => setSettingsOpen(false)} className="text-chalk-faint hover:text-chalk-soft text-lg">✕</button>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-chalk-muted">Durée</span>
            <span className="text-sm text-emerald-300 font-mono">{fadeInSec === 0 ? 'Coupé' : `${fadeInSec}s`}</span>
          </div>
          <input
            type="range"
            min={0}
            max={MAX_FADEIN_SEC}
            step={1}
            value={fadeInSec}
            onChange={(e) => setFadeInSec(Number(e.target.value))}
            className="w-full accent-emerald-400"
            aria-label="Durée du fondu d'entrée Spotify"
          />
          <p className="text-[11px] text-chalk-faint mt-3 leading-snug">
            {fadeInSec === 0 ? '🔇 Transition nette + fondu de sortie automatique.' : `🔊 Volume monte en ${fadeInSec}s au début + fondu de sortie en fin de piste.`}
          </p>
        </div>
      )}

      {/* Zone principale */}
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
              {/* Pochette agrandie */}
              {current.thumbnail && (
                <img
                  src={current.thumbnail}
                  alt=""
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl object-cover shadow-2xl transition-all duration-300"
                  style={{ filter: isPlaying ? 'none' : 'brightness(0.7)' }}
                />
              )}
              <div className="text-center">
                <p className="text-2xl font-bold">{current.title}</p>
                <p className="text-chalk-soft">
                  {current.artist}{current.artist && current.durationMs ? ' · ' : ''}{current.durationMs ? formatDuration(current.durationMs) : ''}
                </p>
              </div>

              {/* Barre de progression + timer */}
              {duration > 0 && (
                <div className="w-full max-w-md mt-2">
                  {/* Barre cliquable pour seek */}
                  <div
                    onClick={handleSeek}
                    className="group relative h-1.5 rounded-full bg-felt-raised cursor-pointer hover:h-2.5 transition-all"
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-400 transition-all duration-150"
                      style={{ width: `${progress * 100}%` }}
                    />
                    {/* Curseur visible au hover */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      style={{ left: `${progress * 100}%` }}
                    />
                  </div>
                  {/* Timer */}
                  <div className="flex justify-between mt-1.5 text-[11px] text-chalk-faint font-mono">
                    <span>{fmt(position)}</span>
                    <span>{fmt(duration)}</span>
                  </div>
                </div>
              )}

              {/* Contrôles : prev / play-pause / next */}
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => musicAction('setPlayback', { isPlaying: !isPlaying })}
                  className="rounded-full bg-emerald-500/80 border border-emerald-400/30 h-12 w-12 flex items-center justify-center text-white text-lg active:bg-emerald-500"
                  aria-label={isPlaying ? 'Pause' : 'Lecture'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button
                  onClick={handleSkip}
                  className="rounded-full bg-felt-raised border border-line-strong h-10 w-10 flex items-center justify-center text-chalk-soft text-sm active:bg-felt-sunken"
                  aria-label="Morceau suivant"
                >
                  ⏭
                </button>
              </div>

              {/* Volume (platine only) */}
              <div className="flex items-center gap-2 w-full max-w-xs mt-2">
                <span className="text-xs text-chalk-faint shrink-0">🔈</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={playerVolumeState}
                  onChange={(e) => { stopVolumeFade(); void setPlayerVolume(Number(e.target.value)) }}
                  className="flex-1 accent-emerald-400"
                  aria-label="Volume de la platine"
                />
                <span className="text-xs text-chalk-faint font-mono shrink-0 w-8 text-right">{playerVolumeState}%</span>
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
              <div key={t.id} className={`flex items-center gap-2.5 rounded-lg p-1.5 transition-colors ${i === 0 ? 'bg-emerald-500/10 border border-emerald-400/20' : ''}`}>
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