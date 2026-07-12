import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { usePartyStore } from '../store/usePartyStore'
import { PartyGameShell } from '../party/PartyGameShell'
import { EmoteOverlay } from '../components/EmoteLayer'
import { useSound } from '../hooks/useSound'

export function ScreenPage() {
  const { code } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const connectAsSpectator = usePartyStore((s) => s.connectAsSpectator)
  const disconnect = usePartyStore((s) => s.disconnect)
  const partyError = usePartyStore((s) => s.error)
  const [input, setInput] = useState('')
  const { play } = useSound()
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
            className="fixed top-4 left-4 z-40 flex items-center gap-1.5 rounded-full bg-white/8 px-3 h-9 text-white/70 text-sm"
          >
            ← Accueil
          </button>
          <span className="text-5xl mb-4">📺</span>
          <h1 className="text-2xl font-extrabold mb-6">Écran partagé</h1>
          <Card className="w-full max-w-sm">
            <label className="flex flex-col gap-1.5 text-left mb-4">
              <span className="text-xs font-medium text-white/50 pl-1">Code de la salle</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="AB3XZ"
                maxLength={5}
                className="rounded-2xl bg-white/8 border border-white/10 px-4 py-3.5 text-base uppercase tracking-widest text-white placeholder-white/30 outline-none focus:border-fuchsia-400/60"
              />
            </label>
            <Button fullWidth disabled={!input.trim()} onClick={() => navigate(`/screen/${input.trim()}`)}>
              Afficher
            </Button>
          </Card>
          <Button variant="ghost" onClick={() => navigate('/')} className="mt-4 !py-2 text-sm">
            ← Retour à l'accueil
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
        <p className="text-pink-300">{partyError}</p>
        <Button variant="secondary" onClick={handleExit}>
          Essayer un autre code
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="fixed top-4 left-4 z-40 flex items-center gap-2">
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 h-9 text-white/50 text-sm"
          aria-label="Changer de salle"
        >
          ← Changer de salle
        </button>
        <button
          onClick={exitToHome}
          className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 h-9 text-white/50 text-sm"
          aria-label="Retour à l'accueil"
        >
          🏠 Accueil
        </button>
      </div>
      <PartyGameShell mode="screen" />
      <EmoteOverlay big />
    </div>
  )
}
