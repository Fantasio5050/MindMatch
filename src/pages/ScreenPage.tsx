import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { Surface } from '../components/Card'
import { Button } from '../components/Button'
import { usePartyStore } from '../store/usePartyStore'
import { PartyGameShell } from '../party/PartyGameShell'
import { EmoteOverlay } from '../components/EmoteLayer'
import { useSound } from '../hooks/useSound'
import { IconArrowLeft, IconScreen, IconFullscreen, IconFullscreenExit } from '../components/icons'

/** Plein écran via l'API Fullscreen (avec fallback webkit pour les navigateurs de TV) : certains
 * navigateurs TV n'ont aucun bouton plein écran natif, on l'expose donc dans l'UI. */
function fullscreenSupported(): boolean {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function'
}
function isFullscreenActive(): boolean {
  const doc = document as Document & { webkitFullscreenElement?: Element | null }
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement)
}
async function toggleFullscreen(): Promise<void> {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> }
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
  try {
    if (isFullscreenActive()) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
    } else {
      await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())
    }
  } catch {
    // Refusé par le navigateur (politique TV) — on n'affiche pas d'erreur, le bouton reste dispo.
  }
}

export function ScreenPage() {
  const { code } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const connectAsSpectator = usePartyStore((s) => s.connectAsSpectator)
  const disconnect = usePartyStore((s) => s.disconnect)
  const partyError = usePartyStore((s) => s.error)
  const [input, setInput] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const { play } = useSound()

  // Suit l'état réel du plein écran (touche Échap, télécommande…) pour garder le label juste.
  useEffect(() => {
    const onChange = () => setFullscreen(isFullscreenActive())
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])
  const memberCount = usePartyStore((s) => s.group?.members.length ?? null)
  const prevMemberCount = useRef<number | null>(null)

  // The TV chimes when someone joins the room — great feedback while people scan the QR code.
  useEffect(() => {
    if (memberCount !== null && prevMemberCount.current !== null && memberCount > prevMemberCount.current) {
      play('join')
    }
    prevMemberCount.current = memberCount
  }, [memberCount, play])

  const handleExit = () => {
    disconnect()
    navigate('/screen')
  }

  useEffect(() => {
    if (code) connectAsSpectator(code.toUpperCase())
  }, [code, connectAsSpectator])

  if (!code) {
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
          <IconScreen size={34} className="text-chalk-soft mb-3" />
          <p className="kicker text-2xs mb-2">Écran partagé</p>
          <h1 className="font-display text-2xl text-chalk mb-6">Afficher la partie ici</h1>
          <Surface level="raised" className="w-full max-w-sm">
            <label className="flex flex-col gap-1.5 text-left mb-4">
              <span className="text-xs font-medium text-chalk-soft pl-1">Code de la salle</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="AB3XZ"
                maxLength={5}
                className="rounded-control bg-felt border border-line px-4 py-3.5 text-base uppercase tracking-widest text-chalk placeholder:text-chalk-faint outline-none focus:border-spark"
              />
            </label>
            <Button fullWidth disabled={!input.trim()} onClick={() => navigate(`/screen/${input.trim()}`)}>
              Afficher
            </Button>
            {fullscreenSupported() && (
              <Button variant="ghost" fullWidth onClick={toggleFullscreen} className="mt-2 flex items-center justify-center gap-2">
                {fullscreen ? <IconFullscreenExit size={17} /> : <IconFullscreen size={17} />}
                {fullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'}
              </Button>
            )}
          </Surface>
          <Button variant="ghost" onClick={() => navigate('/')} className="mt-4">
            Retour à l'accueil
          </Button>
        </div>
      </PageTransition>
    )
  }

  const exitToHome = () => {
    disconnect()
    navigate('/')
  }

  if (partyError) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-6">
        <p className="text-blood">{partyError}</p>
        <Button variant="secondary" onClick={handleExit}>
          Essayer un autre code
        </Button>
      </div>
    )
  }

  return (
    // `tv-surface` déclare la surface : c'est ce qui met TOUT ce qui est en dessous à l'échelle de
    // l'écran plutôt qu'à une taille en pixels figée (voir styles/tokens.css).
    <div className="relative tv-surface">
      <div className="fixed top-4 left-4 z-40 flex items-center gap-2">
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-soft text-sm"
          aria-label="Changer de salle"
        >
          <IconArrowLeft size={15} />
          Changer de salle
        </button>
        <button
          onClick={exitToHome}
          className="flex items-center gap-1.5 rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-soft text-sm"
          aria-label="Retour à l'accueil"
        >
          Accueil
        </button>
        {fullscreenSupported() && (
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-soft text-sm"
            aria-label={fullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'}
          >
            {fullscreen ? <IconFullscreenExit size={15} /> : <IconFullscreen size={15} />}
            {fullscreen ? 'Réduire' : 'Plein écran'}
          </button>
        )}
      </div>
      <PartyGameShell mode="screen" />
      <EmoteOverlay big />
    </div>
  )
}
