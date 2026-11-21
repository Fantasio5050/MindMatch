import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { PageTransition } from '../components/PageTransition'
import { Surface } from '../components/Card'
import { Button } from '../components/Button'
import { QRCode } from '../components/QRCode'
import { Avatar } from '../components/Avatar'
import {
  IconAlert,
  IconArrowLeft,
  IconClose,
  IconFullscreen,
  IconFullscreenExit,
  IconPlay,
  IconSettings,
  IconSpeaker,
  IconTurntable,
} from '../components/icons'
import { usePartyStore } from '../store/usePartyStore'
import { joinUrl } from '../lib/joinUrl'
import { MAX_CROSSFADE_SEC, orderedQueue } from '../lib/jukebox'
import { spotifyEnabled, isSpotifyConnected, beginSpotifyAuth, disconnectSpotify } from '../lib/spotify'
import { TvViewport } from '../party/primitives/TvViewport'
import { CoverBackdrop, MusicProgress, StatusDot, TrackArt, Vinyl } from '../soiree/ui'
import { Equalizer } from '../soiree/Equalizer'
import { ReactionRain } from '../soiree/reactions'
import { SoireeStage } from '../soiree/stage/SoireeStage'
import { YouTubeDecks } from '../soiree/engine/YouTubeDecks'
import { useSpotifyEngine } from '../soiree/engine/useSpotifyEngine'
import { useMemberLookup } from '../soiree/hooks'
import { PlatineRecap } from '../soiree/Recap'
import type { MusicTrack } from '../types'

const PLATINE_ID_KEY = 'mindmatch-platine-id'
const VIEW_KEY = 'mindmatch-platine-view'
type View = 'video' | 'cover'

/** Identifiant de CET onglet-platine : gardé le temps de la session (un rechargement reste « le même
 * appareil » et reprend sa place), différent d'un onglet à l'autre. */
function platineIdForTab(): string {
  try {
    const saved = sessionStorage.getItem(PLATINE_ID_KEY)
    if (saved) return saved
  } catch {
    /* stockage indisponible */
  }
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const id = `pl-${uuid}`
  try {
    sessionStorage.setItem(PLATINE_ID_KEY, id)
  } catch {
    /* tant pis : nouvelle identité au rechargement */
  }
  return id
}

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'video' ? 'video' : 'cover'
  } catch {
    return 'cover'
  }
}

function fullscreenActive(): boolean {
  const doc = document as Document & { webkitFullscreenElement?: Element | null }
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement)
}
async function toggleFullscreen(): Promise<void> {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> }
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
  try {
    if (fullscreenActive()) await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
    else await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
  } catch {
    /* refusé par le navigateur — sans conséquence */
  }
}

/** Paysage assez large pour la scène 1280 × 720 ; sinon, mise en page verticale (téléphone-platine). */
function useLandscape(): boolean {
  const compute = () => typeof window !== 'undefined' && window.innerWidth >= 720 && window.innerWidth > window.innerHeight * 1.15
  const [landscape, setLandscape] = useState(compute)
  useEffect(() => {
    const onResize = () => setLandscape(compute())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return landscape
}

/**
 * La « platine » : la seule page qui lit réellement le son. On l'ouvre sur l'appareil branché à
 * l'enceinte (portable, téléphone, TV). Les téléphones alimentent la file ; la platine obéit à
 * l'état partagé, affiche le morceau en grand (vinyle ou vidéo), et invite la pièce à ajouter les
 * siens (QR code).
 */
export function PlatinePage() {
  const { code } = useParams<{ code?: string }>()
  const [params] = useSearchParams()
  if (!code) return <PlatineCodeEntry />
  return <Platine code={code.toUpperCase()} platineKey={params.get('cle')} />
}

function PlatineCodeEntry() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  return (
    <PageTransition>
      <div className="min-h-svh flex flex-col items-center justify-center px-6 relative">
        <button
          onClick={() => navigate('/')}
          className="fixed top-4 left-4 z-40 flex items-center gap-1.5 rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-muted text-sm"
        >
          <IconArrowLeft size={15} />
          Accueil
        </button>
        <IconTurntable size={34} className="text-chalk-soft mb-3" />
        <p className="kicker text-2xs mb-2">Mode Soirée</p>
        <h1 className="font-display text-2xl text-chalk mb-2 text-center">Brancher la musique ici</h1>
        <p className="text-sm text-chalk-soft text-center mb-6 max-w-xs">
          À ouvrir sur l’appareil relié à l’enceinte : c’est lui qui jouera la musique de toute la salle.
        </p>
        <Surface level="raised" className="w-full max-w-sm">
          <label className="flex flex-col gap-1.5 text-left mb-4">
            <span className="text-xs font-medium text-chalk-soft pl-1">Code de la salle</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && input.trim() && navigate(`/platine/${input.trim()}`)}
              placeholder="AB3XZ"
              maxLength={5}
              className="rounded-control bg-felt border border-line px-4 py-3.5 text-base uppercase tracking-widest text-chalk placeholder:text-chalk-faint outline-none focus:border-spark"
            />
          </label>
          <Button fullWidth disabled={!input.trim()} onClick={() => navigate(`/platine/${input.trim()}`)}>
            Connecter la platine
          </Button>
        </Surface>
      </div>
    </PageTransition>
  )
}

function Platine({ code, platineKey }: { code: string; platineKey: string | null }) {
  const navigate = useNavigate()
  const connectAsSpectator = usePartyStore((s) => s.connectAsSpectator)
  const disconnect = usePartyStore((s) => s.disconnect)
  const claimPlatine = usePartyStore((s) => s.claimPlatine)
  const releasePlatine = usePartyStore((s) => s.releasePlatine)
  const connected = usePartyStore((s) => s.connected)
  const partyError = usePartyStore((s) => s.error)
  const music = usePartyStore((s) => s.group?.music ?? null)
  const platine = usePartyStore((s) => s.platine)
  const active = usePartyStore((s) => s.platineActive)
  const [platineId] = useState(platineIdForTab)
  const [started, setStarted] = useState(false)
  const [view, setViewState] = useState<View>(readView)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [crossfadeNext, setCrossfadeNext] = useState<MusicTrack | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [spotifyLinked, setSpotifyLinked] = useState(isSpotifyConnected)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const landscape = useLandscape()

  const role = useMemo(() => ({ platineId, key: platineKey, kind: 'device' as const }), [platineId, platineKey])

  useEffect(() => {
    connectAsSpectator(code)
    return () => {
      releasePlatine()
      disconnect()
    }
  }, [code, connectAsSpectator, disconnect, releasePlatine])

  useEffect(() => {
    const onChange = () => setIsFullscreen(fullscreenActive())
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  // L'écran de la platine ne doit pas se mettre en veille au milieu de la soirée.
  useEffect(() => {
    if (!started) return
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    let lock: { release: () => Promise<void> } | null = null
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => {
      void lock?.release().catch(() => {})
    }
  }, [started])

  const claim = async () => {
    const ack = await claimPlatine(role)
    setClaimError(ack.ok ? null : (ack.error ?? null))
  }

  const live = !!music && !music.endedAt
  const output = music?.settings.output
  // Reprise automatique : une platine démarrée, en veille, reprend la main dès que la place se
  // libère (l'autre platine a décroché, une nouvelle soirée commence, le son revient de la TV).
  useEffect(() => {
    if (!started || active || !live || !connected || platine?.online || output !== 'device') return
    void claim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, active, live, connected, platine?.online, output])

  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000)
  }
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* stockage indisponible */
    }
  }
  const quit = () => {
    releasePlatine()
    disconnect()
    navigate('/')
  }

  if (partyError && !music) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6">
        <p className="text-chalk">{partyError}</p>
        <Button variant="secondary" onClick={() => navigate('/platine')}>
          Autre code
        </Button>
      </div>
    )
  }

  if (!music) return <PlatineWaiting code={code} onQuit={quit} />
  if (music.endedAt) return <PlatineRecap code={code} onQuit={quit} />

  const youtube = music.source === 'youtube'
  if (!youtube && !spotifyEnabled) {
    return (
      <Gate onQuit={quit}>
        <IconAlert size={30} className="text-blood mb-3" />
        <h1 className="font-display text-2xl text-chalk mb-2">Spotify n’est pas configuré ici</h1>
        <p className="text-sm text-chalk-soft">Relance le Mode Soirée en choisissant YouTube : ça marche sans compte.</p>
      </Gate>
    )
  }
  if (!youtube && !spotifyLinked) {
    return (
      <Gate onQuit={quit}>
        <IconSpeaker size={30} className="text-chalk-soft mb-3" />
        <p className="kicker text-2xs mb-2">Platine Spotify · salle {code}</p>
        <h1 className="font-display text-2xl text-chalk mb-2">Connecte Spotify</h1>
        <p className="text-sm text-chalk-soft mb-6">
          Sur cet appareil relié à l’enceinte, connecte un compte Spotify Premium : c’est lui qui lira la file.
        </p>
        <Button fullWidth onClick={() => void beginSpotifyAuth(`#/platine/${code}${platineKey ? `?cle=${platineKey}` : ''}`)}>
          Se connecter à Spotify
        </Button>
      </Gate>
    )
  }

  const decks = youtube ? (
    <YouTubeDecks started={started} active={active} view={view === 'video' ? 'video' : 'hidden'} onCrossfade={setCrossfadeNext} onNotice={flash} />
  ) : undefined

  return (
    <div className="fixed inset-0 bg-ink overflow-hidden">
      <CoverBackdrop cover={music.current?.thumbnail} strength="stage" />
      {landscape ? (
        <TvViewport>
          <SoireeStage code={code} media={decks} mediaVisible={youtube && view === 'video'} crossfadeNext={crossfadeNext} />
        </TvViewport>
      ) : (
        <PlatinePortrait code={code} media={decks} mediaVisible={youtube && view === 'video'} />
      )}
      {!youtube && <SpotifyEngineHost started={started} active={active} onNotice={flash} />}

      {/* Barre de service, en vrais pixels au-dessus de la scène. */}
      <div className="fixed top-0 inset-x-0 z-40 flex items-center gap-2 px-4 h-16 bg-gradient-to-b from-ink/85 to-transparent">
        <IconTurntable size={20} className="text-chalk-soft shrink-0" />
        <span className="font-display text-lg text-chalk hidden sm:inline">Platine</span>
        <span className="text-2xs font-semibold tracking-[0.18em] text-brass border border-line rounded-chip px-2 h-6 flex items-center">{code}</span>
        <span className="flex items-center gap-1.5 text-2xs text-chalk-soft min-w-0">
          <StatusDot tone={active ? 'live' : started ? 'idle' : 'idle'} />
          <span className="truncate">{active ? (crossfadeNext ? 'Fondu enchaîné…' : 'Le son sort ici') : started ? 'En veille' : 'Prête'}</span>
        </span>
        <div className="flex-1" />
        {youtube && (
          <div className="hidden sm:flex rounded-chip border border-line p-0.5 bg-felt/70">
            {(['cover', 'video'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={clsx('h-7 px-3 rounded-chip text-xs', view === v ? 'bg-felt-raised text-chalk' : 'text-chalk-soft')}
              >
                {v === 'cover' ? 'Pochette' : 'Vidéo'}
              </button>
            ))}
          </div>
        )}
        <IconButton label="Réglages de la platine" onClick={() => setSettingsOpen((o) => !o)} active={settingsOpen}>
          <IconSettings size={17} />
        </IconButton>
        <IconButton label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'} onClick={() => void toggleFullscreen()}>
          {isFullscreen ? <IconFullscreenExit size={17} /> : <IconFullscreen size={17} />}
        </IconButton>
        <button onClick={quit} className="rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-soft text-xs shrink-0">
          Quitter
        </button>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <PlatineSettings
            youtube={youtube}
            view={view}
            setView={setView}
            active={active}
            onClose={() => setSettingsOpen(false)}
            onSpotifyLogout={
              youtube
                ? undefined
                : () => {
                    disconnectSpotify()
                    setSpotifyLinked(false)
                  }
            }
          />
        )}
      </AnimatePresence>

      <ReactionRain size="stage" />

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-chip border border-blood/50 bg-felt-raised px-4 py-2 text-sm text-chalk flex items-center gap-2 shadow-float"
          >
            <IconAlert size={16} className="text-blood" />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {!started ? (
        <StartGate
          code={code}
          othersOnline={!!platine?.online && !platineKey}
          spotify={!youtube}
          onStart={() => {
            setStarted(true)
            void claim()
          }}
        />
      ) : (
        !active && (
          <Standby
            output={output ?? 'device'}
            othersOnline={!!platine?.online}
            canTakeOver={!!platineKey || !platine?.online}
            error={claimError}
            onClaim={() => void claim()}
          />
        )
      )}
    </div>
  )
}

/** Le moteur Spotify n'a rien à afficher : un composant sans rendu pour l'appeler à côté de la scène. */
function SpotifyEngineHost({ started, active, onNotice }: { started: boolean; active: boolean; onNotice: (t: string) => void }) {
  const { ready, fatal } = useSpotifyEngine({ started, active, onNotice })
  if (fatal) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-control border border-blood/50 bg-felt-raised px-4 py-3 text-sm text-chalk flex items-center gap-2 shadow-float">
        <IconAlert size={16} className="text-blood" />
        {fatal}
      </div>
    )
  }
  if (started && !ready) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-chip bg-felt-raised border border-line px-4 py-2 text-xs text-chalk-soft">
        Le lecteur Spotify se connecte…
      </div>
    )
  }
  return null
}

function IconButton({ label, onClick, active = false, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={clsx(
        'w-9 h-9 shrink-0 rounded-chip border flex items-center justify-center',
        active ? 'bg-felt-raised border-spark/60 text-chalk' : 'bg-felt-raised border-line text-chalk-soft',
      )}
    >
      {children}
    </button>
  )
}

/** Le geste qui débloque le son (les navigateurs l'exigent) et revendique le rôle de platine. */
function StartGate({ code, othersOnline, spotify, onStart }: { code: string; othersOnline: boolean; spotify: boolean; onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 backdrop-blur-sm px-6">
      <Surface level="floating" className="w-full max-w-md text-center">
        <IconSpeaker size={32} className="text-spark mx-auto mb-3" />
        <p className="kicker text-2xs mb-2">
          Platine{spotify ? ' Spotify' : ''} · salle {code}
        </p>
        <h1 className="font-display text-2xl text-chalk mb-2">Démarrer la musique ici</h1>
        <p className="text-sm text-chalk-soft mb-5">
          Relie cet appareil à l’enceinte, puis démarre : c’est lui qui jouera la musique de toute la salle.
        </p>
        {othersOnline && (
          <p className="text-xs text-chalk-soft mb-4 rounded-control border border-line px-3 py-2">
            Une platine joue déjà : celle-ci restera en veille et prendra le relais si l’autre décroche.
          </p>
        )}
        <Button fullWidth onClick={onStart} className="flex items-center justify-center gap-2">
          <IconPlay size={18} />
          Démarrer la platine
        </Button>
      </Surface>
    </div>
  )
}

/** En veille : une autre platine (ou la TV) joue le son. On dit pourquoi, et comment reprendre. */
function Standby({
  output,
  othersOnline,
  canTakeOver,
  error,
  onClaim,
}: {
  output: 'device' | 'tv'
  othersOnline: boolean
  canTakeOver: boolean
  error: string | null
  onClaim: () => void
}) {
  const title = output === 'tv' ? 'Le son passe par la TV' : othersOnline ? 'Une autre platine joue le son' : 'On reprend la main…'
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,30rem)]"
    >
      <Surface level="floating" className="!p-4 flex items-center gap-4">
        <StatusDot tone="idle" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-chalk">{title}</p>
          <p className="text-2xs text-chalk-soft mt-0.5 leading-snug">
            {error ??
              (canTakeOver
                ? 'Cette platine est en veille : elle prend le relais d’elle-même si l’autre décroche.'
                : 'Pour jouer ici, ouvre le lien de la platine depuis le téléphone de l’hôte (Régie › Copier le lien).')}
          </p>
        </div>
        {canTakeOver && (
          <Button variant="secondary" className="!min-h-[40px] !px-4 text-sm shrink-0" onClick={onClaim}>
            Reprendre ici
          </Button>
        )}
      </Surface>
    </motion.div>
  )
}

/** Réglages sur place. Partagés avec la régie de l'hôte : ce qu'on règle ici se voit sur son téléphone. */
function PlatineSettings({
  youtube,
  view,
  setView,
  active,
  onClose,
  onSpotifyLogout,
}: {
  youtube: boolean
  view: View
  setView: (v: View) => void
  active: boolean
  onClose: () => void
  onSpotifyLogout?: () => void
}) {
  const settings = usePartyStore((s) => s.group?.music?.settings)
  const platineSend = usePartyStore((s) => s.platineSend)
  const [draft, setDraft] = useState<{ volume?: number; crossfadeSec?: number }>({})
  if (!settings) return null
  const volume = draft.volume ?? settings.volume
  const crossfade = draft.crossfadeSec ?? settings.crossfadeSec
  const send = (patch: { volume?: number; crossfadeSec?: number }) => {
    setDraft((d) => ({ ...d, ...patch }))
    platineSend('settings', patch)
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className="fixed top-16 right-4 z-50 w-[min(92vw,20rem)]"
    >
      <Surface level="floating" className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="kicker text-2xs">Réglages</p>
          <button onClick={onClose} aria-label="Fermer" className="w-7 h-7 flex items-center justify-center text-chalk-soft">
            <IconClose size={15} />
          </button>
        </div>
        {!active && (
          <p className="text-2xs text-chalk-faint mb-3">En veille : les réglages se font depuis la platine active ou la régie de l’hôte.</p>
        )}
        <label className="block">
          <span className="flex justify-between text-sm">
            <span className="text-chalk">Volume</span>
            <span className="tabular-nums text-chalk-muted">{volume} %</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            disabled={!active}
            onChange={(e) => send({ volume: Number(e.target.value) })}
            className="w-full accent-spark mt-1.5 h-6"
          />
        </label>
        <label className="block mt-3">
          <span className="flex justify-between text-sm">
            <span className="text-chalk">Fondu enchaîné</span>
            <span className="tabular-nums text-chalk-muted">{crossfade === 0 ? 'Coupure nette' : `${crossfade} s`}</span>
          </span>
          <input
            type="range"
            min={0}
            max={MAX_CROSSFADE_SEC}
            value={crossfade}
            disabled={!active}
            onChange={(e) => send({ crossfadeSec: Number(e.target.value) })}
            className="w-full accent-spark mt-1.5 h-6"
          />
        </label>
        {!youtube && <p className="text-2xs text-chalk-faint mt-1">Spotify lit un morceau à la fois : le son descend puis remonte.</p>}
        {youtube && (
          <div className="mt-3">
            <p className="text-sm text-chalk mb-1.5">Affichage</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['cover', 'video'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={clsx(
                    'h-9 rounded-control border text-xs',
                    view === v ? 'bg-felt-raised border-spark/60 text-chalk' : 'border-line text-chalk-soft',
                  )}
                >
                  {v === 'cover' ? 'Pochette (vinyle)' : 'Vidéo YouTube'}
                </button>
              ))}
            </div>
          </div>
        )}
        {onSpotifyLogout && (
          <button onClick={onSpotifyLogout} className="mt-4 text-2xs text-chalk-soft underline">
            Changer de compte Spotify
          </button>
        )}
      </Surface>
    </motion.div>
  )
}

/** Platine ouverte, salle trouvée, mais l'hôte n'a pas (encore) lancé le Mode Soirée. */
function PlatineWaiting({ code, onQuit }: { code: string; onQuit: () => void }) {
  return (
    <Gate onQuit={onQuit}>
      <IconTurntable size={32} className="text-chalk-soft mb-3" />
      <p className="kicker text-2xs mb-2">Platine · salle {code}</p>
      <h1 className="font-display text-2xl text-chalk mb-2">La platine est branchée</h1>
      <p className="text-sm text-chalk-soft mb-5">Dès que l’hôte lance le Mode Soirée depuis le salon, la musique de la salle sortira ici.</p>
      <div className="flex items-center gap-3 rounded-card border border-line bg-felt px-3 py-3 text-left">
        <QRCode value={joinUrl(code)} size={72} />
        <p className="text-xs text-chalk-soft">Pas encore dans la salle ? Scanne pour la rejoindre avec ton téléphone.</p>
      </div>
    </Gate>
  )
}

function Gate({ onQuit, children }: { onQuit: () => void; children: ReactNode }) {
  return (
    <PageTransition>
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-sm flex flex-col items-center">{children}</div>
        <Button variant="ghost" onClick={onQuit} className="mt-6">
          Quitter la platine
        </Button>
      </div>
    </PageTransition>
  )
}

/** Mise en page verticale : un téléphone sert de platine. Même contenu, à l'échelle téléphone. */
function PlatinePortrait({ code, media, mediaVisible }: { code: string; media?: ReactNode; mediaVisible: boolean }) {
  const music = usePartyStore((s) => s.group?.music)
  const platine = usePartyStore((s) => s.platine)
  const { byId } = useMemberLookup()
  if (!music) return null
  const current = music.current
  const adder = current ? byId(current.addedById) : undefined
  const spinning = !!current && music.isPlaying && !!music.anchor?.playing && !!platine?.online
  const next = orderedQueue(music).slice(0, 3)
  return (
    <div className="relative z-10 h-full overflow-y-auto">
      <div className="min-h-full flex flex-col items-center px-5 pt-20 pb-8 text-center max-w-md mx-auto">
        <div className={clsx('relative', mediaVisible ? 'w-full' : '')}>
          {media}
          {!mediaVisible && <Vinyl cover={current?.thumbnail} size="min(68vw, 300px)" spinning={spinning} className={current ? '' : 'opacity-50'} />}
        </div>
        {current ? (
          <>
            <h1 className="font-display text-2xl text-chalk mt-6 leading-tight line-clamp-2 [overflow-wrap:anywhere]">{current.title}</h1>
            {current.artist && <p className="text-sm text-chalk-soft mt-1 truncate max-w-full">{current.artist}</p>}
            <div className="text-xs text-chalk-muted mt-3 flex items-center gap-2">
              {adder && <Avatar pseudo={adder.pseudo} color={adder.color} size={20} photoUrl={adder.photoUrl} />}
              Ajouté par {adder?.pseudo ?? 'quelqu’un'}
            </div>
            {current.dedication && (
              <p className="text-sm text-chalk mt-3 rounded-card border border-spark/40 bg-felt/80 px-4 py-2.5">« {current.dedication} »</p>
            )}
            <MusicProgress className="mt-5" />
            <Equalizer playing={spinning} bars={28} className="h-10 w-full mt-2" />
          </>
        ) : (
          <p className="font-display text-2xl text-chalk mt-6">Le premier morceau, c’est vous</p>
        )}
        {next.length > 0 && (
          <div className="w-full mt-6 text-left">
            <p className="kicker text-2xs mb-2">À suivre</p>
            {next.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-1.5">
                <TrackArt src={t.thumbnail} size={36} />
                <p className="text-sm text-chalk truncate flex-1">{t.title}</p>
                <span className="text-2xs text-chalk-faint">{byId(t.addedById)?.pseudo}</span>
              </div>
            ))}
          </div>
        )}
        <div className="w-full mt-6 flex items-center gap-3 rounded-card border border-line bg-felt/85 p-3 text-left">
          <QRCode value={joinUrl(code)} size={72} />
          <div>
            <p className="kicker text-2xs">Ajoute ta musique</p>
            <p className="font-stage text-xl text-brass tracking-[0.14em]">{code}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
