import { useEffect, useRef, useState } from 'react'
import { usePartyStore } from '../../store/usePartyStore'
import { anchorPosition, effectiveVolume, peekNext } from '../../lib/jukebox'
import {
  disconnectSpotify,
  getSpotifyToken,
  loadSpotifySdk,
  playSpotifyTrack,
  type SpotifyPlayer,
  type SpotifyPlayerState,
  type SpotifyReadyEvent,
} from '../../lib/spotify'

const FADE_TICK_MS = 50
const HEARTBEAT_MS = 5000
const WATCHDOG_MS = 12_000
/** Spotify ne lit qu'un morceau à la fois : le « fondu » est une descente puis une montée, qu'on
 * garde courtes pour ne pas creuser un trou entre deux morceaux. */
const MAX_FADE_SEC = 8

/**
 * Le moteur Spotify de la platine (Web Playback SDK, compte Premium connecté sur cet appareil).
 * Même contrat que les decks YouTube : il ne joue et ne rend compte que si cet appareil est LA
 * platine, suit l'état partagé (morceau, lecture, volume maître, baisse pendant les jeux) et annonce
 * au serveur le suivant quand un morceau se termine.
 */
export function useSpotifyEngine({ started, active, onNotice }: { started: boolean; active: boolean; onNotice?: (text: string) => void }): {
  ready: boolean
  fatal: string | null
} {
  const current = usePartyStore((s) => s.group?.music?.current ?? null)
  const isPlaying = usePartyStore((s) => s.group?.music?.isPlaying ?? false)
  const settings = usePartyStore((s) => s.group?.music?.settings)
  const gameRunning = usePartyStore((s) => s.group?.party.status === 'playing')
  const [ready, setReady] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)

  const player = useRef<SpotifyPlayer | null>(null)
  const deviceId = useRef<string | null>(null)
  const loaded = useRef<string | null>(null)
  const firstLoad = useRef(true)
  const gain = useRef(1)
  const master = useRef(0.8)
  const fade = useRef<number | null>(null)
  const fadingOut = useRef(false)
  const endedFor = useRef<string | null>(null)
  const watch = useRef({ loadedAt: 0, everPlayed: false, lastBeat: 0, lastPos: 0, lastDur: 0 })
  const activeRef = useRef(active)
  activeRef.current = active
  const noticeRef = useRef(onNotice)
  noticeRef.current = onNotice

  function applyVol() {
    player.current?.setVolume(Math.max(0, Math.min(1, master.current * gain.current))).catch(() => {})
  }
  function stopFade() {
    if (fade.current) window.clearInterval(fade.current)
    fade.current = null
  }
  function fadeTo(target: number, ms: number, done?: () => void) {
    stopFade()
    const from = gain.current
    const steps = Math.max(1, Math.round(ms / FADE_TICK_MS))
    let step = 0
    fade.current = window.setInterval(() => {
      step++
      const p = Math.min(1, step / steps)
      gain.current = from + (target - from) * p
      applyVol()
      if (p >= 1) {
        stopFade()
        done?.()
      }
    }, FADE_TICK_MS)
  }

  function report(state: SpotifyPlayerState) {
    const st = usePartyStore.getState()
    const cur = st.group?.music?.current
    if (!activeRef.current || !cur || loaded.current !== cur.id) return
    st.platineSend('position', { trackId: cur.id, positionMs: state.position, durationMs: state.duration || null, playing: !state.paused })
    watch.current.lastBeat = Date.now()
  }

  function sendEnded(reason?: 'unplayable') {
    const st = usePartyStore.getState()
    const music = st.group?.music
    const cur = music?.current
    if (!music || !cur || endedFor.current === cur.id) return
    endedFor.current = cur.id
    if (reason) noticeRef.current?.('Lecture impossible — on passe au suivant')
    st.platineSend('ended', { trackId: cur.id, nextTrackId: peekNext(music)?.id ?? null, ...(reason ? { reason } : {}) })
  }

  // ---- Démarrage du lecteur SDK (au geste « Démarrer ») ----
  useEffect(() => {
    if (!started) return
    let cancelled = false
    void (async () => {
      try {
        const Spotify = await loadSpotifySdk()
        if (cancelled) return
        const p = new Spotify.Player({
          name: 'MindMatch — Platine',
          getOAuthToken: (cb) => {
            void getSpotifyToken().then((t) => {
              if (t) cb(t)
            })
          },
          volume: master.current,
        })
        player.current = p
        p.addListener('ready', (arg) => {
          deviceId.current = (arg as SpotifyReadyEvent).device_id
          applyVol()
          setReady(true)
        })
        p.addListener('not_ready', () => setReady(false))
        p.addListener('authentication_error', () => {
          disconnectSpotify()
          setFatal('Connexion Spotify expirée — reconnecte-toi.')
        })
        p.addListener('account_error', () => setFatal('Un compte Spotify Premium est nécessaire pour lire la musique.'))
        p.addListener('playback_error', () => sendEnded('unplayable'))
        p.addListener('player_state_changed', (raw) => {
          const s = raw as SpotifyPlayerState | null
          if (!s) return
          if (!s.paused && s.position > 0) watch.current.everPlayed = true
          report(s)
        })
        const ok = await p.connect()
        if (!ok) setFatal('Impossible de démarrer le lecteur Spotify.')
      } catch {
        setFatal('Impossible de charger le lecteur Spotify.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  useEffect(
    () => () => {
      stopFade()
      player.current?.disconnect()
    },
    [],
  )

  // ---- Volume maître ----
  useEffect(() => {
    if (!settings) return
    master.current = effectiveVolume(settings, gameRunning) / 100
    applyVol()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.volume, settings?.duck, gameRunning, ready])

  // ---- Réconciliation avec l'état partagé ----
  useEffect(() => {
    const p = player.current
    const device = deviceId.current
    if (!ready || !p || !device) return
    if (!active || !current) {
      stopFade()
      fadingOut.current = false
      p.pause().catch(() => {})
      return
    }
    if (loaded.current !== current.id) {
      loaded.current = current.id
      endedFor.current = null
      fadingOut.current = false
      watch.current = { loadedAt: Date.now(), everPlayed: false, lastBeat: 0, lastPos: 0, lastDur: 0 }
      stopFade()
      const st = usePartyStore.getState()
      const music = st.group?.music
      const cf = Math.min(MAX_FADE_SEC, music?.settings.crossfadeSec ?? 0)
      // Platine rouverte en plein morceau : on reprend là où en était la salle.
      const pos = firstLoad.current && music ? anchorPosition(music.anchor, st.serverNow(), current.durationMs) : 0
      firstLoad.current = false
      gain.current = cf > 0 && isPlaying ? 0 : 1
      applyVol()
      void playSpotifyTrack(device, current.sourceId, pos > 3000 ? pos : 0).then(() => {
        if (!isPlaying) window.setTimeout(() => p.pause().catch(() => {}), 400)
        else if (cf > 0) fadeTo(1, cf * 1000)
      })
      return
    }
    if (isPlaying) {
      if (!fadingOut.current && !fade.current) {
        gain.current = 1
        applyVol()
      }
      p.resume().catch(() => {})
    } else {
      // Pause pendant une descente de fin : on l'abandonne (sinon elle irait au bout et passerait
      // au morceau suivant alors que la salle a mis en pause).
      stopFade()
      fadingOut.current = false
      gain.current = 1
      applyVol()
      p.pause().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active, current?.id, isPlaying])

  // ---- Ticker : battement, fin de piste, descente de fin, chien de garde ----
  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(async () => {
      const p = player.current
      if (!p || !activeRef.current) return
      let state: SpotifyPlayerState | null = null
      try {
        state = await p.getCurrentState()
      } catch {
        return
      }
      const music = usePartyStore.getState().group?.music
      const cur = music?.current
      if (!state || !music || !cur || loaded.current !== cur.id) return
      const now = Date.now()
      const w = watch.current
      if (!state.paused && state.position > 0) w.everPlayed = true
      if (music.isPlaying && !w.everPlayed && now - w.loadedAt > WATCHDOG_MS) {
        sendEnded('unplayable')
        return
      }
      if (now - w.lastBeat > HEARTBEAT_MS) report(state)
      const endedNaturally = state.paused && state.position === 0 && w.lastPos > 3000 && w.lastPos >= w.lastDur - 4000
      if (endedNaturally) {
        stopFade()
        sendEnded()
      } else if (music.isPlaying && !state.paused && state.duration > 10_000 && !fadingOut.current) {
        const cf = Math.min(MAX_FADE_SEC, music.settings.crossfadeSec)
        const remaining = (state.duration - state.position) / 1000
        if (cf > 0 && remaining <= cf && remaining > 0.4) {
          fadingOut.current = true
          fadeTo(0, Math.max(300, remaining * 1000 - 150), () => sendEnded())
        }
      }
      w.lastPos = state.position
      w.lastDur = state.duration
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return { ready, fatal }
}
