import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { usePartyStore } from '../store/usePartyStore'
import { loadYouTubeApi, type YTPlayer } from '../lib/youtube'
import { orderedQueue } from '../lib/jukebox'
import { stopMusic as stopAppMusic } from '../lib/music'

function makePlatineId(): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `pl-${uuid}`
}

/** Fenêtre de fondu enchaîné : le morceau suivant démarre et monte pendant que l'actuel descend. */
const CROSSFADE_SEC = 5
const FADE_IN_MS = 900
const SKIP_FADE_MS = 500
const RAMP_STEP_MS = 50

/**
 * La "platine" : la seule page qui lit réellement le son. On l'ouvre sur l'appareil branché à
 * l'enceinte Bluetooth (téléphone, PC, ou TV). Les téléphones ne font qu'alimenter la file ; la
 * platine obéit à l'état partagé (musique en cours, lecture/pause, passage). Un seul appareil peut
 * être la platine active à la fois — sinon deux sources crachent le son en même temps.
 *
 * Deux "platines" YouTube (deck A / deck B) tournent en alternance pour permettre un vrai fondu
 * enchaîné : quand la piste courante approche de la fin, la suivante démarre en silence sur l'autre
 * deck puis les volumes (et l'image) se croisent en douceur.
 */
export function PlatinePage() {
  const { code } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  if (!code) {
    return (
      <PageTransition>
        <div className="min-h-svh flex flex-col items-center justify-center px-6">
          <span className="text-5xl mb-4">🎛️</span>
          <h1 className="text-2xl font-extrabold mb-2">Platine — Mode Soirée</h1>
          <p className="text-sm text-white/50 text-center mb-6 max-w-xs">
            À ouvrir sur l'appareil branché à l'enceinte. Entre le code de la salle.
          </p>
          <Card className="w-full max-w-sm">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="AB3XZ"
              maxLength={5}
              className="w-full rounded-2xl bg-white/8 border border-white/10 px-4 py-3.5 text-base uppercase tracking-widest text-white placeholder-white/30 outline-none focus:border-fuchsia-400/60 mb-3"
            />
            <Button fullWidth disabled={!input.trim()} onClick={() => navigate(`/platine/${input.trim()}`)}>
              Connecter la platine
            </Button>
          </Card>
          <Button variant="ghost" onClick={() => navigate('/')} className="mt-4 !py-2 text-sm">
            ← Accueil
          </Button>
        </div>
      </PageTransition>
    )
  }

  return <PlatinePlayer code={code.toUpperCase()} />
}

function PlatinePlayer({ code }: { code: string }) {
  const navigate = useNavigate()
  const connectAsSpectator = usePartyStore((s) => s.connectAsSpectator)
  const disconnect = usePartyStore((s) => s.disconnect)
  const platineClaim = usePartyStore((s) => s.platineClaim)
  const platineEnded = usePartyStore((s) => s.platineEnded)
  const reportPosition = usePartyStore((s) => s.reportPosition)
  const partyError = usePartyStore((s) => s.error)

  const music = usePartyStore((s) => s.group?.music ?? null)
  const source = music?.source ?? null
  const current = music?.current ?? null
  const isPlaying = music?.isPlaying ?? false
  const platineOwner = music?.platineId ?? null

  const [platineId] = useState(makePlatineId)
  const [started, setStarted] = useState(false)
  const [readyTick, setReadyTick] = useState(0)
  const [opacity, setOpacity] = useState<[number, number]>([1, 0])
  const [crossfadeUi, setCrossfadeUi] = useState(false)

  const players = useRef<Array<YTPlayer | null>>([null, null])
  const ready = useRef<[boolean, boolean]>([false, false])
  const activeDeck = useRef(0)
  const deckLoaded = useRef<Array<string | null>>([null, null])
  const crossfading = useRef(false)
  const rampTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const firstLoad = useRef(true)
  const deck0Ref = useRef<HTMLDivElement | null>(null)
  const deck1Ref = useRef<HTMLDivElement | null>(null)

  const isActive = !platineOwner || platineOwner === platineId

  // ---- helpers audio (impératifs, pilotés par refs) ----
  function setVol(deck: number, v: number) {
    try { players.current[deck]?.setVolume(Math.max(0, Math.min(100, Math.round(v)))) } catch { /* pas prêt */ }
  }
  function clearRamp() {
    if (rampTimer.current) { clearInterval(rampTimer.current); rampTimer.current = null }
  }
  function fadeInDeck(deck: number, ms: number) {
    clearRamp()
    const steps = Math.max(1, Math.round(ms / RAMP_STEP_MS))
    let step = 0
    setVol(deck, 0)
    rampTimer.current = setInterval(() => {
      step++
      setVol(deck, (100 * step) / steps)
      if (step >= steps) { clearRamp(); setVol(deck, 100) }
    }, RAMP_STEP_MS)
  }
  function animateCrossfade(fromDeck: number, toDeck: number, ms: number, onDone: () => void) {
    clearRamp()
    const steps = Math.max(1, Math.round(ms / RAMP_STEP_MS))
    let step = 0
    setVol(fromDeck, 100)
    setVol(toDeck, 0)
    setCrossfadeUi(true)
    rampTimer.current = setInterval(() => {
      step++
      const p = step / steps
      setVol(fromDeck, 100 * (1 - p))
      setVol(toDeck, 100 * p)
      setOpacity(toDeck === 0 ? [p, 1 - p] : [1 - p, p])
      if (step >= steps) {
        clearRamp()
        setVol(fromDeck, 0)
        setVol(toDeck, 100)
        setOpacity(toDeck === 0 ? [1, 0] : [0, 1])
        setCrossfadeUi(false)
        onDone()
      }
    }, RAMP_STEP_MS)
  }
  function pauseOtherDeck(active: number) {
    const other = active === 0 ? 1 : 0
    try { players.current[other]?.pauseVideo(); setVol(other, 0) } catch { /* pas prêt */ }
  }
  /** Charge une piste sur le deck actif (premier lancement ou saut manuel), avec fondu d'entrée. */
  function loadOnActiveDeck(sourceId: string, fadeMs: number, playing: boolean) {
    const deck = activeDeck.current
    const player = players.current[deck]
    if (!player) return
    crossfading.current = false
    deckLoaded.current[deck] = sourceId
    setOpacity(deck === 0 ? [1, 0] : [0, 1])
    pauseOtherDeck(deck)
    try {
      setVol(deck, 0)
      player.loadVideoById(sourceId)
    } catch { /* le rendu suivant réappliquera */ }
    if (playing) fadeInDeck(deck, fadeMs)
    else { clearRamp(); try { player.pauseVideo() } catch { /* pas prêt */ } }
  }
  /** Démarre un fondu enchaîné vers `nextSourceId` sur le deck inactif, et avance la file côté
   * serveur (le "en lecture" des téléphones bascule pendant que le son se croise). */
  function startCrossfade(nextSourceId: string, ms: number) {
    if (crossfading.current) return
    const session = usePartyStore.getState().group?.music
    if (!session?.current) return
    const from = activeDeck.current
    const to = from === 0 ? 1 : 0
    const player = players.current[to]
    if (!player || !ready.current[to]) return
    crossfading.current = true
    deckLoaded.current[to] = nextSourceId
    try { setVol(to, 0); player.loadVideoById(nextSourceId) } catch { crossfading.current = false; return }
    activeDeck.current = to
    platineEnded(platineId, session.current.id)
    animateCrossfade(from, to, ms, () => {
      crossfading.current = false
      try { players.current[from]?.pauseVideo() } catch { /* pas prêt */ }
      deckLoaded.current[from] = null
    })
  }
  function applyPlayPause(playing: boolean) {
    const player = players.current[activeDeck.current]
    if (!player) return
    try { if (playing) player.playVideo(); else player.pauseVideo() } catch { /* pas prêt */ }
  }
  function onDeckEnded(deck: number) {
    // Un deck qui finit sa "queue" pendant/après un fondu ne doit pas déclencher un second passage.
    if (crossfading.current || deck !== activeDeck.current) return
    const cur = usePartyStore.getState().group?.music?.current
    if (cur) platineEnded(platineId, cur.id)
  }

  useEffect(() => {
    // La platine tient l'enceinte : on coupe la musique d'ambiance de l'appli pour ne pas jouer
    // deux sources en même temps.
    stopAppMusic()
    connectAsSpectator(code)
    return () => disconnect()
  }, [code, connectAsSpectator, disconnect])

  useEffect(() => () => {
    clearRamp()
    for (const p of players.current) { try { p?.destroy() } catch { /* déjà détruit */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Démarrage sur geste utilisateur (indispensable pour l'autoplay audio) + revendication du rôle
  // de platine active. Crée les DEUX lecteurs YouTube (decks A/B).
  const startPlatine = async () => {
    setStarted(true)
    platineClaim(platineId)
    if (source !== 'youtube') return
    const YT = await loadYouTubeApi()
    const mounts = [deck0Ref.current, deck1Ref.current]
    mounts.forEach((mount, i) => {
      if (!mount || players.current[i]) return
      players.current[i] = new YT.Player(mount, {
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { ready.current[i] = true; setReadyTick((t) => t + 1) },
          onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) onDeckEnded(i) },
        },
      })
    })
  }

  // Réconcilie le deck actif avec l'état partagé : premier chargement, saut manuel, lecture/pause,
  // mise en veille si une autre platine prend le relais. Le fondu enchaîné (fin de piste) est géré
  // séparément par le ticker ci-dessous.
  useEffect(() => {
    if (!started) return
    const active = activeDeck.current
    if (!players.current[active] || !ready.current[active]) return
    if (!isActive) {
      try { players.current[0]?.pauseVideo(); players.current[1]?.pauseVideo() } catch { /* pas prêt */ }
      return
    }
    if (!current) {
      try { players.current[0]?.pauseVideo(); players.current[1]?.pauseVideo() } catch { /* pas prêt */ }
      return
    }
    if (deckLoaded.current[active] === current.sourceId) {
      applyPlayPause(isPlaying)
      return
    }
    // Nouvelle piste inattendue (lancement initial ou saut) : on annule un éventuel fondu en cours.
    if (crossfading.current) {
      clearRamp()
      crossfading.current = false
      pauseOtherDeck(active)
    }
    loadOnActiveDeck(current.sourceId, firstLoad.current ? FADE_IN_MS : SKIP_FADE_MS, isPlaying)
    firstLoad.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, readyTick, isActive, current?.sourceId, isPlaying])

  // Ticker : remonte la position (barre de progression des téléphones) et déclenche le fondu
  // enchaîné quand la piste courante arrive vers sa fin.
  useEffect(() => {
    if (!started) return
    const id = setInterval(() => {
      const active = activeDeck.current
      const player = players.current[active]
      if (!player || !ready.current[active]) return
      const session = usePartyStore.getState().group?.music
      if (!session) return
      if (session.platineId && session.platineId !== platineId) return
      let ct = 0, dur = 0, state = -1
      try { ct = player.getCurrentTime(); dur = player.getDuration(); state = player.getPlayerState() } catch { return }
      reportPosition({ positionMs: Math.round(ct * 1000), durationMs: dur ? Math.round(dur * 1000) : null, isPlaying: state === 1 })
      if (!session.isPlaying || crossfading.current) return
      if (dur > CROSSFADE_SEC * 2) {
        const remaining = dur - ct
        if (remaining > 0.4 && remaining <= CROSSFADE_SEC) {
          const next = orderedQueue(session)[0]
          if (next) startCrossfade(next.sourceId, Math.max(1500, Math.round(remaining * 1000) - 300))
        }
      }
    }, 500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, platineId, reportPosition])

  if (partyError) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6">
        <p className="text-pink-300">{partyError}</p>
        <Button variant="secondary" onClick={() => navigate('/platine')}>
          Autre code
        </Button>
      </div>
    )
  }

  if (!music) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-4">
        <span className="text-5xl">🎛️</span>
        <p className="text-white/60">En attente du lancement du Mode Soirée par l'hôte…</p>
        <p className="text-xs text-white/30">Salle {code}</p>
        <Button variant="ghost" onClick={() => { disconnect(); navigate('/') }} className="!py-2 text-sm">
          ← Accueil
        </Button>
      </div>
    )
  }

  if (source === 'spotify') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-4 max-w-md mx-auto">
        <span className="text-5xl">🎧</span>
        <h1 className="text-2xl font-extrabold">Platine Spotify</h1>
        <p className="text-white/60 text-sm">
          La lecture Spotify nécessite un compte <b>Spotify Premium</b> et une clé d'application configurée
          côté serveur. En attendant, choisis la source <b>YouTube</b> au lancement du Mode Soirée : elle
          fonctionne sans aucune configuration.
        </p>
        <Button variant="ghost" onClick={() => { disconnect(); navigate('/') }} className="!py-2 text-sm">
          ← Accueil
        </Button>
      </div>
    )
  }

  const queue = orderedQueue(music)

  return (
    <div className="min-h-svh flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎛️</span>
          <span className="font-bold">Platine</span>
          <span className="text-xs text-white/40">· Salle {code}</span>
          {isActive ? (
            <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5">● active</span>
          ) : (
            <span className="text-[10px] rounded-full bg-white/10 text-white/40 px-2 py-0.5">en veille</span>
          )}
          {crossfadeUi && (
            <span className="text-[10px] rounded-full bg-fuchsia-500/20 text-fuchsia-200 px-2 py-0.5">⤫ fondu…</span>
          )}
        </div>
        <button
          onClick={() => { disconnect(); navigate('/') }}
          className="rounded-full bg-white/8 px-3 h-8 text-white/60 text-xs"
        >
          Quitter
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
          {/* Zone lecteur : deux decks YouTube superposés (fondu enchaîné) */}
          <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden bg-[#0c0c12] border border-white/10 relative">
            <div className="absolute inset-0" style={{ opacity: opacity[0], pointerEvents: opacity[0] > 0.5 ? 'auto' : 'none' }}>
              <div ref={deck0Ref} className="w-full h-full" />
            </div>
            <div className="absolute inset-0" style={{ opacity: opacity[1], pointerEvents: opacity[1] > 0.5 ? 'auto' : 'none' }}>
              <div ref={deck1Ref} className="w-full h-full" />
            </div>
            {!started && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm">
                <span className="text-5xl">🔊</span>
                <p className="text-white/70 text-sm text-center px-6">
                  Assure-toi que cet appareil est branché à l'enceinte, puis démarre la platine.
                </p>
                <Button onClick={startPlatine}>▶ Démarrer la platine</Button>
              </div>
            )}
            {started && !current && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <span className="text-4xl">🎶</span>
                <p className="text-white/60 text-sm">File d'attente vide — ajoutez des musiques depuis vos téléphones.</p>
              </div>
            )}
            {started && !isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center px-6">
                <p className="text-white/70 text-sm">Une autre platine a pris le relais.</p>
                <Button variant="secondary" onClick={() => platineClaim(platineId)}>Reprendre ici</Button>
              </div>
            )}
          </div>

          {current && (
            <div className="mt-4 text-center">
              <p className="text-lg font-bold">{current.title}</p>
              {current.artist && <p className="text-white/50 text-sm">{current.artist}</p>}
            </div>
          )}
        </div>

        {/* File d'attente (aperçu) */}
        <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-white/10 p-4 overflow-y-auto max-h-[40svh] lg:max-h-none">
          <p className="text-xs uppercase tracking-widest text-white/40 mb-3">À suivre ({queue.length})</p>
          {queue.length === 0 && <p className="text-white/30 text-sm">Rien pour l'instant.</p>}
          <div className="flex flex-col gap-2">
            {queue.slice(0, 12).map((t, i) => (
              <div key={t.id} className="flex items-center gap-2.5">
                <span className="text-xs text-white/30 w-4 text-right">{i + 1}</span>
                {t.thumbnail ? (
                  <img src={t.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">🎵</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{t.title}</p>
                  {t.artist && <p className="text-[11px] text-white/40 truncate">{t.artist}</p>}
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
