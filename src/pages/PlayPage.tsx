import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { usePartyStore } from '../store/usePartyStore'
import { PartyGameShell } from '../party/PartyGameShell'
import { useSound } from '../hooks/useSound'

export function PlayPage() {
  const navigate = useNavigate()
  const connectAsPlayer = usePartyStore((s) => s.connectAsPlayer)
  const endGame = usePartyStore((s) => s.endGame)
  const isHost = usePartyStore((s) => s.isHost())
  const { muted, toggleMuted } = useSound()

  useEffect(() => {
    connectAsPlayer()
  }, [connectAsPlayer])

  const handleBack = () => {
    // Party state stays "playing" until the host explicitly ends it — otherwise the lobby's
    // own redirect (playing -> bounce back to /play) fights any attempt to just navigate away.
    if (isHost) endGame()
    navigate('/lobby')
  }

  return (
    <PageTransition>
      <div className="relative">
        <div className="fixed top-4 left-4 right-4 z-40 flex items-center justify-between safe-top">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 h-9 text-white/70 text-sm"
          >
            ← {isHost ? 'Quitter la partie' : 'Salon'}
          </button>
          <button onClick={toggleMuted} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-sm">
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        <PartyGameShell mode="controller" />
      </div>
    </PageTransition>
  )
}
