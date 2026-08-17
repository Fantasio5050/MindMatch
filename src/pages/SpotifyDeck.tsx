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
const VOLUME_STORE_KEY = 'mindmatch-spotify-volume'
const TRANSITION_STORE_KEY = 'mindmatch-spotify-transition'
const FADEOUT_WINDOW_SEC = 4
const FADEOUT_TICK_MS = 50

/** Profils de transition — simulent le feel d'un sweep filtre Pioneer DDJ. */
type TransitionProfile = 'cut' | 'linear' | 'lowpass' | 'highpass'

const TRANSITION_LABELS: Record<TransitionProfile, string> = {
  cut: 'Net',
  linear: 'Fondu',
  lowpass: 'Sweep basse',
  highpass: 'Sweep aiguë',
}

const TRANSITION_DESCS: Record<TransitionProfile, string> = {
  cut: '🔇 Coupure nette entre les morceaux.',
  linear: '🔊 Volume monte et descend linéairement.',
  lowpass: '🎚️ Monte lentement puis accélère — feel low-pass qui s\'ouvre.',
  highpass: '📻 Démarre rapide puis plateau — feel high-pass qui se ferme.',
}

function readFadeInSec(): number {
  if (typeof window === 'undefined') return DEFAULT_FADEIN_SEC
  const raw = Number(window.localStorage.getItem(FADEIN_STORE_KEY))
  if (!Number.isFinite(raw)) return DEFAULT_FADEIN_SEC
  return Math.max(0, Math.min(MAX_FADEIN_SEC, raw))
}

function readVolume(): number {
  if (typeof window === 'undefined') return 100
  const raw = Number(window.localStorage.getItem(VOLUME_STORE_KEY))
  if (!Number.isFinite(raw)) return 100
  return Math.max(0, Math.min(100, raw))
}

function readTransition(): TransitionProfile {
  if (typeof window === 'undefined') return 'linear'
  const raw = window.localStorage.getItem(TRANSITION_STORE_KEY)
  if (raw === 'cut' || raw === 'linear' || raw === 'lowpass' || raw === 'highpass') return raw
  return 'linear'
}

/** Courbe d'easing selon le profil de transition. */
function easeProgress(profile: TransitionProfile, p: number): number {
  switch (profile) {
    case 'cut':
      return p >= 1 ? 1 : 0
    case 'lowpass':
      // Exponentielle : monte lentement au début, accélère à la fin (feel low-pass qui s'ouvre)
      return p * p
    case 'highpass':
      // Racine : démarre rapide, ralentit vers la fin (feel high-pass qui se ferme)
      return Math.sqrt(p)
    case 'linear':
    default:
      return p
  }
}

function fmt(ms: number): string {
  if (!ms || ms < 0) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Platine Spotify : connexion du compte (Premium) sur l'appareil-platine, lecture via le Web
 * Playback SDK. La recherche/ajout se fait côté téléphones (via le serveur). Transitions
 * configurables (net / fondu / sweep basse / sweep aiguë) + fondu de sortie automatique.
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
  const [volumeUi, setVolumeUi] = useState(readVolume)
  const [transition, setTransition] = useState<TransitionProfile>(readTransition)

  // État playback local (pour l'UI — barre de progression + timer)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [seeking, setSeeking] = useState(false)

  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const volumeRef = useRef(readVolume())
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
  const transitionRef = useRef(transition)
  transitionRef.current = transition

  const isActive = !platineOwner || platineOwner === platineId
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // ---- Volume (interne, ne déclenche PAS de re-render pendant les fondus) ----
  const applyVolume = useCallback(async (value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)))
    volumeRef.current = clamped
    try { await playerRef.current?.setVolume(clamped / 100) } catch { /* pas prêt */ }
  }, [])

  // ---- Volume manuel (depuis le slider dans les réglages) ----
  const setManualVolume = useCallback(async (value: number) => {
    stopVolumeFade()
    stopFadeOut()
    const clamped = Math.max(0, Math.min(100, Math.round(value)))
    volumeRef.current = clamped
    setVolumeUi(clamped)
    try { window.localStorage.setItem(VOLUME_STORE_KEY, String(clamped)) } catch { /* stockage indispo */ }
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

  // ---- Fade-in (début de piste) — utilise applyVolume, PAS setVolumeUi ----
  const applyFadeIn = (durationSec: number) => {
    stopVolumeFade()
    const profile = transitionRef.current
    if (!playerRef.current || durationSec <= 0 || profile === 'cut') {
      void applyVolume(volumeRef.current > 0 ? volumeRef.current : 100)
      return
    }
    const durationMs = durationSec * 1000
    const startAt = Date.now()
    const startVol = volumeRef.current
    const endVol = 100
    const tickMs = 50
    fadeTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startAt
      const rawProgress = Math.min(elapsed / durationMs, 1)
      const eased = easeProgress(profile, rawProgress)
      const next = startVol + (endVol - startVol) * eased
      void applyVolume(next)
      if (rawProgress >= 1) {
        stopVolumeFade()
        void applyVolume(endVol)
      }
    }, tickMs)
  }

  // ---- Fade-out (fin de piste) — utilise applyVolume, PAS setVolumeUi ----
  const applyFadeOut = (windowSec: number, onComplete: () => void) => {
    stopFadeOut()
    const profile = transitionRef.current
    const startVol = volumeRef.current
    if (profile === 'cut') {
      onComplete()
      return
    }
    const durationMs = windowSec * 1000
    const startAt = Date.now()
    const tickMs = FADEOUT_TICK_MS
    fadeOutTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startAt
      const rawProgress = Math.min(elapsed / durationMs, 1)
      // Fade-out : ease inversé (highpass → s'ouvre, lowpass → se ferme)
      const eased = easeProgress(profile, 1 - rawProgress)
      const next = startVol * (1 - eased)
      void applyVolume(next)
      if (rawProgress >= 1) {
        stopFadeOut()
        void applyVolume(0)
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
        volume: volumeRef.current / 100,
      })
      playerRef.current = player
      player.addListener('ready', (arg) => {
        deviceIdRef.current = (arg as SpotifyReadyEvent).device_id
        void applyVolume(volumeRef.current)
        setReady(true)
      })
      player.addListener('authentication_error', () => { disconnectSpotify(); setConnected(false); setFatal('Connexion Spotify expirée — reconnecte-toi.') })
      player.addListener('account_error', () => setFatal('Un compte Spotify Premium est nécessaire pour la lecture.'))
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
      if (fadeInSec > 0 && transitionRef.current !== 'cut') {
        void applyVolume(0)
        window.setTimeout(() => {
          void playSpotifyTrack(deviceIdRef.current!, current.sourceId)
          if (isPlaying) applyFadeIn(fadeInSec)
        }, 120)
      } else {
        void applyVolume(volumeRef.current)
        void playSpotifyTrack(deviceIdRef.current!, current.sourceId)
      }
      if (!isPlaying) window.setTimeout(() => playerRef.current?.pause().catch(() => {}), 500)
    } else if (isPlaying) {
      stopFadeOut()
      void applyVolume(volumeRef.current > 0 ? volumeRef.current : 100)
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

      const endedNaturally =
        state.paused && state.position === 0 && lastPosRef.current > 3000 && lastPosRef.current >= lastDurRef.current - 4000

      const stuck = !!session?.isPlaying && !everPlayedRef.current && Date.now() - loadedAtRef.current > 12000

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

  useEffect(() => {
    try { window.localStorage.setItem(TRANSITION_STORE_KEY, transition) } catch { /* stockage indispo */ }
  }, [transition])

  // ---- Timer local pour l'UI ----
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

  // ---- Skip manuel ----
  const handleSkip = () => {
    stopFadeOut()
    stopVolumeFade()
    void applyVolume(volumeRef.current)
    musicAction('hostSkip')
  }

  const queue = music ? orderedQueue(music) : []
  const progress = duration > 0 ? Math.min(1, position / duration) : 0

  const settingsLabel = transition === 'cut' ? 'Net' : transition === 'linear' ? `${fadeInSec}s` : `${TRANSITION_LABELS[transition]} ${fadeInSec}s`

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
          ⚙️ {settingsLabel}
        </button>
        <button onClick={() => { disconnect(); navigate('/') }} className="rounded-full bg-felt-raised px-3 h-8 text-chalk-soft text-xs">
          Quitter
        </button>
      </div>
    </div>
  )

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
      {settingsOpen && (
        <div className="absolute right-4 top-16 z-50 w-80 rounded-2xl border border-line bg-felt-raised p-4 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold">Réglages de la platine</span>
            <button onClick={() => setSettingsOpen(false)} className="text-chalk-faint hover:text-chalk-soft text-lg">✕</button>
          </div>

          {/* Volume */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-chalk-muted">Volume</span>
              <span className="text-sm text-emerald-300 font-mono">{volumeUi}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volumeUi}
              onChange={(e) => void setManualVolume(Number(e.target.value))}
              className="w-full accent-emerald-400"
              aria-label="Volume de la platine"
            />
          </div>

          <div className="h-px bg-line my-3" />

          {/* Profil de transition */}
          <div className="mb-3">
            <span className="text-xs text-chalk-muted block mb-2">Transition entre morceaux</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(TRANSITION_LABELS) as TransitionProfile[]).map(p => (
                <button
                  key={p}
                  onClick={() => setTransition(p)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold border transition-colors ${
                    transition === p
                      ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200'
                      : 'bg-felt-sunken border-line text-chalk-soft'
                  }`}
                >
                  {TRANSITION_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Durée du fondu (masqué si "Net") */}
          {transition !== 'cut' && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-chalk-muted">Durée du fondu</span>
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
                aria-label="Durée du fondu"
              />
            </div>
          )}

          <p className="text-[11px] text-chalk-faint mt-3 leading-snug">
            {TRANSITION_DESCS[transition]}
          </p>
        </div>
      )}

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
                  <div
                    onClick={handleSeek}
                    className="group relative h-1.5 rounded-full bg-felt-raised cursor-pointer hover:h-2.5 transition-all"
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-400 transition-all duration-150"
                      style={{ width: `${progress * 100}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      style={{ left: `${progress * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[11px] text-chalk-faint font-mono">
                    <span>{fmt(position)}</span>
                    <span>{fmt(duration)}</span>
                  </div>
                </div>
              )}

              {/* Contrôles : play-pause + skip */}
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
            </>
          ) : (
            <>
              <span className="text-5xl">🎶</span>
              <p className="text-chalk-soft text-sm">File vide — ajoutez des musiques depuis vos téléphones.</p>
            </>
          )}
        </div>

        {/* File d'attente */}
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