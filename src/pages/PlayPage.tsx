import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { usePartyStore } from '../store/usePartyStore'
import { PartyGameShell } from '../party/PartyGameShell'
import { useSound } from '../hooks/useSound'

export function PlayPage() {
  const connectAsPlayer = usePartyStore((s) => s.connectAsPlayer)
  const { muted, toggleMuted } = useSound()

  useEffect(() => {
    connectAsPlayer()
  }, [connectAsPlayer])

  return (
    <PageTransition>
      <div className="relative">
        <div className="fixed top-4 left-4 right-4 z-40 flex items-center justify-between safe-top">
          <Link to="/lobby" className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/60 text-sm">
            ←
          </Link>
          <button onClick={toggleMuted} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-sm">
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        <PartyGameShell mode="controller" />
      </div>
    </PageTransition>
  )
}
