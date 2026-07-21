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

/**
 * La "platine" : la seule page qui lit réellement le son. On l'ouvre sur l'appareil branché à
 * l'enceinte Bluetooth (téléphone, PC, ou TV). Les téléphones ne font qu'alimenter la file ; la
 * platine obéit à l'état partagé (musique en cours, lecture/pause, passage). Un seul appareil peut
 * être la platine active à la fois — sinon deux sources crachent le son en même temps.
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
  const [playerReady, setPlayerReady] = useState(false)
  const playerRef = useRef<YTPlayer | null>(null)
  const mountRef = useRef<HTMLDivElement | null>(null)
  const loadedIdRef = useRef<string | null>(null)

  const isActive = !platineOwner || platineOwner === platineId

  useEffect(() => {
    // La platine tient l'enceinte : on coupe la musique d'ambiance de l'appli pour ne pas jouer
    // deux sources en même temps.
    stopAppMusic()
    connectAsSpectator(code)
    return () => disconnect()
  }, [code, connectAsSpectator, disconnect])

  // Démarrage sur geste utilisateur (indispensable pour l'autoplay audio), + revendication du rôle
  // de platine active. Crée le lecteur YouTube une seule fois.
  const startPlatine = async () => {
    setStarted(true)
    platineClaim(platineId)
    if (source !== 'youtube') return
    const YT = await loadYouTubeApi()
    if (!mountRef.current) return
    playerRef.current = new YT.Player(mountRef.current, {
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, controls: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => setPlayerReady(true),
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) {
            const cur = usePartyStore.getState().group?.music?.current
            if (cur) platineEnded(platineId, cur.id)
          }
        },
      },
    })
  }

  // Synchronise le lecteur avec l'état partagé : charge la piste courante, applique lecture/pause,
  // et se met en silence si une autre platine a pris le relais.
  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || !player) return
    if (!isActive) {
      try {
        player.pauseVideo()
      } catch {
        /* lecteur pas prêt */
      }
      return
    }
    if (!current) {
      loadedIdRef.current = null
      return
    }
    try {
      if (loadedIdRef.current !== current.sourceId) {
        loadedIdRef.current = current.sourceId
        player.loadVideoById(current.sourceId)
        if (!isPlaying) player.pauseVideo()
      } else if (isPlaying) {
        player.playVideo()
      } else {
        player.pauseVideo()
      }
    } catch {
      /* le lecteur applique l'état au prochain rendu */
    }
  }, [playerReady, current, current?.sourceId, isPlaying, isActive])

  // Remonte la position de lecture (barre de progression des téléphones) — événement éphémère.
  useEffect(() => {
    if (!playerReady || !started) return
    const id = setInterval(() => {
      const player = playerRef.current
      if (!player) return
      const active = (() => {
        const owner = usePartyStore.getState().group?.music?.platineId
        return !owner || owner === platineId
      })()
      if (!active) return
      try {
        reportPosition({
          positionMs: Math.round(player.getCurrentTime() * 1000),
          durationMs: player.getDuration() ? Math.round(player.getDuration() * 1000) : null,
          isPlaying: player.getPlayerState() === 1,
        })
      } catch {
        /* lecteur pas prêt */
      }
    }, 2500)
    return () => clearInterval(id)
  }, [playerReady, started, platineId, reportPosition])

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
          {/* Zone lecteur YouTube (16:9) */}
          <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden bg-[#0c0c12] border border-white/10 relative">
            <div ref={mountRef} className="w-full h-full" />
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
