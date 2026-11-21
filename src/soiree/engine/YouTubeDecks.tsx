import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { usePartyStore } from '../../store/usePartyStore'
import { loadYouTubeApi, type YTPlayer } from '../../lib/youtube'
import { anchorPosition, effectiveVolume, peekNext } from '../../lib/jukebox'
import type { MusicTrack } from '../../types'

const FADE_IN_MS = 900
const SKIP_FADE_MS = 450
const RAMP_STEP_MS = 50
/** Battement léger : la position part au serveur sur chaque événement (lecture, pause, saut…) et,
 * sinon, toutes les 5 s — assez pour recaler les téléphones, sans relais continu. */
const HEARTBEAT_MS = 5000
/** Une vidéo voulue « en lecture » qui n'a jamais démarré au bout de ce délai est sans doute bloquée
 * (certaines n'émettent aucune erreur exploitable) : on passe. */
const WATCHDOG_MS = 12_000
const YT_PLAYING = 1
const YT_PAUSED = 2
const YT_BUFFERING = 3
const YT_ENDED = 0

/**
 * Le moteur YouTube de la platine : deux lecteurs (deck A / deck B) qui tournent en alternance pour
 * un vrai fondu enchaîné. Utilisé par la page `/platine` ET par la TV quand elle joue le son.
 *
 * Tout est piloté par des refs (impératif, hors rendu React), et seul l'appareil qui TIENT le rôle de
 * platine (`active`) joue et rend compte au serveur.
 *
 * Le fondu enchaîné ne se dispute plus avec le serveur : la platine choisit le suivant (tête de file
 * ou proposition du mode continu), le lance en silence sur l'autre deck, PUIS annonce au serveur
 * « fin de X, j'enchaîne sur Y ». Le serveur avance vers Y s'il est encore dans la file — avant, il
 * recalculait la tête de file à la réception, et la platine devait couper net si elle avait bougé.
 */
export function YouTubeDecks({
  started,
  active,
  view,
  onCrossfade,
  onNotice,
  className,
}: {
  /** L'utilisateur a démarré la platine (geste requis pour lire du son). */
  started: boolean
  /** Cet appareil est LA platine (le serveur l'a accepté). */
  active: boolean
  /** `video` : l'image YouTube à l'écran ; `hidden` : le son seulement (la TV, le mode pochette). */
  view: 'video' | 'hidden'
  /** Un fondu enchaîné commence (le morceau suivant) ou se termine (null). */
  onCrossfade?: (next: MusicTrack | null) => void
  /** Message court à afficher (vidéo illisible…). */
  onNotice?: (text: string) => void
  className?: string
}) {
  const current = usePartyStore((s) => s.group?.music?.current ?? null)
  const isPlaying = usePartyStore((s) => s.group?.music?.isPlaying ?? false)
  const settings = usePartyStore((s) => s.group?.music?.settings)
  const gameRunning = usePartyStore((s) => s.group?.party.status === 'playing')
  const [readyTick, setReadyTick] = useState(0)
  const [opacity, setOpacity] = useState<[number, number]>([1, 0])
  const mount0 = useRef<HTMLDivElement>(null)
  const mount1 = useRef<HTMLDivElement>(null)

  const players = useRef<Array<YTPlayer | null>>([null, null])
  const ready = useRef<[boolean, boolean]>([false, false])
  const activeDeck = useRef(0)
  /** Id (de file) du morceau chargé sur chaque deck. */
  const loaded = useRef<Array<string | null>>([null, null])
  const crossfading = useRef(false)
  const ramp = useRef<number | null>(null)
  /** Gain de fondu de chaque deck (0-1), multiplié par le volume maître. */
  const gains = useRef<[number, number]>([1, 0])
  const master = useRef(0.8)
  const firstLoad = useRef(true)
  const reconciledFor = useRef<string | null>(null)
  const errorGuard = useRef<string | null>(null)
  const watch = useRef({ trackId: null as string | null, loadedAt: 0, everPlayed: false, lastBeat: 0, lastPos: 0, lastAt: 0 })
  const activeRef = useRef(active)
  activeRef.current = active
  const callbacks = useRef({ onCrossfade, onNotice })
  callbacks.current = { onCrossfade, onNotice }

  // ---- Volume ----------------------------------------------------------------
  function applyVol(deck: number) {
    try {
      players.current[deck]?.setVolume(Math.round(100 * master.current * gains.current[deck]))
    } catch {
      /* lecteur pas prêt */
    }
  }
  function stopRamp() {
    if (ramp.current) window.clearInterval(ramp.current)
    ramp.current = null
  }
  /** Fondu d'un deck (montée), ou croisé de deux decks (l'un descend, l'autre monte). */
  function runRamp(fromDeck: number | null, toDeck: number, ms: number, done?: () => void) {
    stopRamp()
    const steps = Math.max(1, Math.round(ms / RAMP_STEP_MS))
    const startTo = gains.current[toDeck]
    const startFrom = fromDeck === null ? 0 : gains.current[fromDeck]
    let step = 0
    ramp.current = window.setInterval(() => {
      step++
      const p = Math.min(1, step / steps)
      gains.current[toDeck] = startTo + (1 - startTo) * p
      applyVol(toDeck)
      if (fromDeck !== null) {
        gains.current[fromDeck] = startFrom * (1 - p)
        applyVol(fromDeck)
        setOpacity(toDeck === 0 ? [p, 1 - p] : [1 - p, p])
      }
      if (p >= 1) {
        stopRamp()
        done?.()
      }
    }, RAMP_STEP_MS)
  }

  // ---- Compte rendu au serveur -------------------------------------------
  function report(deck: number) {
    const st = usePartyStore.getState()
    const cur = st.group?.music?.current
    const p = players.current[deck]
    if (!activeRef.current || !cur || !p || loaded.current[deck] !== cur.id) return
    let ct = 0
    let dur = 0
    let state = -1
    try {
      ct = p.getCurrentTime()
      dur = p.getDuration()
      state = p.getPlayerState()
    } catch {
      return
    }
    st.platineSend('position', {
      trackId: cur.id,
      positionMs: Math.round(ct * 1000),
      durationMs: dur ? Math.round(dur * 1000) : null,
      playing: state === YT_PLAYING,
    })
    watch.current.lastBeat = Date.now()
    watch.current.lastPos = ct
    watch.current.lastAt = Date.now()
  }

  function resetWatch(trackId: string) {
    watch.current = { trackId, loadedAt: Date.now(), everPlayed: false, lastBeat: 0, lastPos: 0, lastAt: Date.now() }
  }

  // ---- Chargements, fondus, passages ---------------------------------------
  function pauseDeck(deck: number) {
    try {
      players.current[deck]?.pauseVideo()
    } catch {
      /* pas prêt */
    }
  }

  function loadOn(deck: number, track: MusicTrack, fadeMs: number, playing: boolean, startSec: number) {
    const p = players.current[deck]
    if (!p) return
    const other = deck === 0 ? 1 : 0
    stopRamp()
    pauseDeck(other)
    gains.current[other] = 0
    applyVol(other)
    loaded.current[other] = null
    loaded.current[deck] = track.id
    setOpacity(deck === 0 ? [1, 0] : [0, 1])
    resetWatch(track.id)
    try {
      if (playing) {
        gains.current[deck] = 0
        applyVol(deck)
        p.loadVideoById(track.sourceId, startSec)
        runRamp(null, deck, fadeMs)
      } else {
        // En pause : on « cale » la vidéo sans la lancer ; la reprise partira à plein volume.
        gains.current[deck] = 1
        applyVol(deck)
        p.cueVideoById(track.sourceId, startSec)
      }
    } catch {
      /* le prochain rendu réessaiera */
    }
  }

  function abortCrossfade() {
    if (!crossfading.current) return
    stopRamp()
    crossfading.current = false
    const d = activeDeck.current
    const other = d === 0 ? 1 : 0
    pauseDeck(other)
    loaded.current[other] = null
    gains.current[d] = 1
    gains.current[other] = 0
    applyVol(d)
    applyVol(other)
    setOpacity(d === 0 ? [1, 0] : [0, 1])
    callbacks.current.onCrossfade?.(null)
  }

  function startCrossfade(next: MusicTrack, ms: number) {
    const st = usePartyStore.getState()
    const cur = st.group?.music?.current
    const from = activeDeck.current
    const to = from === 0 ? 1 : 0
    const p = players.current[to]
    if (!cur || !p || !ready.current[to] || crossfading.current) return
    crossfading.current = true
    loaded.current[to] = next.id
    gains.current[to] = 0
    applyVol(to)
    try {
      p.loadVideoById(next.sourceId)
    } catch {
      crossfading.current = false
      loaded.current[to] = null
      return
    }
    activeDeck.current = to
    resetWatch(next.id)
    // « Fin de X, j'enchaîne sur Y » : le serveur suit le choix de la platine.
    st.platineSend('ended', { trackId: cur.id, nextTrackId: next.id })
    callbacks.current.onCrossfade?.(next)
    runRamp(from, to, ms, () => {
      crossfading.current = false
      pauseDeck(from)
      loaded.current[from] = null
      callbacks.current.onCrossfade?.(null)
    })
  }

  /** Le morceau est illisible (bloqué, supprimé, intégration interdite) : on passe, une fois. */
  function skipBroken(reason: string) {
    const st = usePartyStore.getState()
    const music = st.group?.music
    const cur = music?.current
    if (!music || !cur || errorGuard.current === cur.id) return
    errorGuard.current = cur.id
    abortCrossfade()
    callbacks.current.onNotice?.(reason)
    st.platineSend('ended', { trackId: cur.id, nextTrackId: peekNext(music)?.id ?? null, reason: 'unplayable' })
  }

  function onState(deck: number, state: number) {
    // Les états de l'ancien deck (qui s'éteint en fin de fondu) ne regardent plus personne.
    if (deck !== activeDeck.current) return
    if (state === YT_ENDED) {
      if (crossfading.current) return
      const st = usePartyStore.getState()
      const music = st.group?.music
      const cur = music?.current
      if (!activeRef.current || !music || !cur || loaded.current[deck] !== cur.id) return
      st.platineSend('ended', { trackId: cur.id, nextTrackId: peekNext(music)?.id ?? null })
      return
    }
    if (state === YT_PLAYING) watch.current.everPlayed = true
    if (state === YT_PLAYING || state === YT_PAUSED || state === YT_BUFFERING) report(deck)
  }

  function onError(deck: number) {
    const cur = usePartyStore.getState().group?.music?.current
    if (!cur || loaded.current[deck] !== cur.id) return
    skipBroken('Vidéo indisponible — on passe au suivant')
  }

  // ---- Création des deux lecteurs (au démarrage : il faut un geste pour le son) ----
  useEffect(() => {
    if (!started) return
    let cancelled = false
    void loadYouTubeApi().then((YT) => {
      if (cancelled) return
      ;[mount0.current, mount1.current].forEach((mount, i) => {
        if (!mount || players.current[i]) return
        players.current[i] = new YT.Player(mount, {
          width: '100%',
          height: '100%',
          // Pas de commandes YouTube : la lecture se pilote depuis la platine et les téléphones, une
          // pause « en douce » dans l'iframe désynchroniserait la salle.
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1, fs: 0, iv_load_policy: 3 },
          events: {
            onReady: () => {
              ready.current[i] = true
              setReadyTick((t) => t + 1)
            },
            onStateChange: (e) => onState(i, e.data),
            onError: () => onError(i),
          },
        })
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  useEffect(
    () => () => {
      stopRamp()
      for (const p of players.current) {
        try {
          p?.destroy()
        } catch {
          /* déjà détruit */
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ---- Volume maître : réglage de l'hôte, baissé pendant une partie ----
  useEffect(() => {
    if (!settings) return
    master.current = effectiveVolume(settings, gameRunning) / 100
    applyVol(0)
    applyVol(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.volume, settings?.duck, gameRunning, readyTick])

  // ---- Réconciliation avec l'état partagé ----
  useEffect(() => {
    if (!started) return
    const d = activeDeck.current
    const p = players.current[d]
    if (!p || !ready.current[d]) return
    if (!active || !current) {
      abortCrossfade()
      pauseDeck(0)
      pauseDeck(1)
      reconciledFor.current = null
      return
    }
    if (loaded.current[d] === current.id) {
      if (isPlaying) {
        try {
          p.playVideo()
        } catch {
          /* pas prêt */
        }
      } else {
        abortCrossfade()
        pauseDeck(d)
      }
      // Le serveur vient d'avancer vers le morceau que le fondu a lancé : on recale tout le monde.
      if (reconciledFor.current !== current.id) {
        reconciledFor.current = current.id
        window.setTimeout(() => report(d), 300)
      }
      return
    }
    // Morceau inattendu : premier lancement, passage forcé, ou suivant autre que celui du fondu.
    abortCrossfade()
    // Premier chargement (platine rouverte en plein morceau) : on reprend là où en était la salle.
    let startSec = 0
    if (firstLoad.current) {
      const st = usePartyStore.getState()
      const music = st.group?.music
      const pos = music ? anchorPosition(music.anchor, st.serverNow(), current.durationMs) : 0
      if (pos > 3000 && (!current.durationMs || pos < current.durationMs - 10_000)) startSec = Math.floor(pos / 1000)
    }
    loadOn(d, current, firstLoad.current ? FADE_IN_MS : SKIP_FADE_MS, isPlaying, startSec)
    firstLoad.current = false
    reconciledFor.current = current.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, readyTick, active, current?.id, isPlaying])

  // ---- Ticker : battement, chien de garde, déclenchement du fondu enchaîné ----
  useEffect(() => {
    if (!started) return
    const id = window.setInterval(() => {
      if (!activeRef.current || crossfading.current) return
      const st = usePartyStore.getState()
      const music = st.group?.music
      const cur = music?.current
      const d = activeDeck.current
      const p = players.current[d]
      if (!music || !cur || !p || !ready.current[d] || loaded.current[d] !== cur.id) return
      let ct = 0
      let dur = 0
      let state = -1
      try {
        ct = p.getCurrentTime()
        dur = p.getDuration()
        state = p.getPlayerState()
      } catch {
        return
      }
      const now = Date.now()
      if (watch.current.trackId !== cur.id) resetWatch(cur.id)
      if (state === YT_PLAYING) watch.current.everPlayed = true
      if (music.isPlaying && !watch.current.everPlayed && now - watch.current.loadedAt > WATCHDOG_MS) {
        skipBroken('Lecture impossible — on passe au suivant')
        return
      }
      // Battement, ou saut de position inattendu (plus de 2 s d'écart avec ce qu'on attendait).
      const expected = watch.current.lastPos + (state === YT_PLAYING ? (now - watch.current.lastAt) / 1000 : 0)
      if (now - watch.current.lastBeat > HEARTBEAT_MS || Math.abs(ct - expected) > 2) report(d)

      if (!music.isPlaying || state !== YT_PLAYING) return
      const cf = music.settings.crossfadeSec
      // Fondu coupé, durée inconnue ou morceau trop court : coupure nette, gérée par la fin de piste.
      if (cf >= 1 && dur >= 8) {
        const windowSec = Math.min(cf, dur * 0.45, dur - 1.5)
        const remaining = dur - ct
        if (windowSec > 0.5 && remaining > 0.4 && remaining <= windowSec) {
          const next = peekNext(music)
          if (next) startCrossfade(next, Math.max(1200, Math.round(remaining * 1000)))
        }
      }
    }, 500)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  return (
    <div
      className={clsx(
        'overflow-hidden bg-ink',
        // Masqué, le lecteur garde une vraie taille : YouTube refuse de lire sous 200 × 200 px.
        view === 'video'
          ? 'relative w-full aspect-video rounded-card border border-line shadow-raised'
          : 'fixed left-0 bottom-0 w-[320px] h-[180px] opacity-0 pointer-events-none',
        className,
      )}
      aria-hidden={view !== 'video'}
    >
      {/* Les deux decks, superposés. Chaque `div` de montage est REMPLACÉ par l'iframe YouTube : on
          ne le rend donc jamais différemment (React ne doit pas y toucher). */}
      <div className="absolute inset-0" style={{ opacity: opacity[0] }}>
        <div ref={mount0} className="w-full h-full" />
      </div>
      <div className="absolute inset-0" style={{ opacity: opacity[1] }}>
        <div ref={mount1} className="w-full h-full" />
      </div>
    </div>
  )
}
