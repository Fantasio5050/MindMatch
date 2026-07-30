import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { usePartyStore } from '../store/usePartyStore'
import { PartyGameShell } from '../party/PartyGameShell'
import { EmoteOverlay, EmoteBar } from '../components/EmoteLayer'
import { useSound } from '../hooks/useSound'
import { IconArrowLeft, IconCopy, IconCheck } from '../components/icons'

export function PlayPage() {
  const navigate = useNavigate()
  const connectAsPlayer = usePartyStore((s) => s.connectAsPlayer)
  const endGame = usePartyStore((s) => s.endGame)
  const isHost = usePartyStore((s) => s.isHost())
  const code = usePartyStore((s) => s.group?.code)
  const [copied, setCopied] = useState(false)
  const { play } = useSound()

  useEffect(() => {
    connectAsPlayer()
  }, [connectAsPlayer])

  const handleBack = () => {
    play('pop')
    // Party state stays "playing" until the host explicitly ends it — otherwise the lobby's
    // own redirect (playing -> bounce back to /play) fights any attempt to just navigate away.
    if (isHost) endGame()
    navigate('/lobby')
  }

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable, ignore silently
    }
  }

  return (
    <PageTransition>
      <div className="relative">
        {/* Left-aligned only — the global AudioControls button already owns the top-right corner. */}
        <div className="fixed top-4 left-4 z-40 safe-top flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-muted text-sm"
          >
            <IconArrowLeft size={15} />
            {isHost ? 'Quitter la partie' : 'Salon'}
          </button>
          {code && (
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-soft text-xs font-semibold tracking-widest"
              aria-label="Copier le code de la salle"
            >
              {copied ? <IconCheck size={13} className="text-jade" /> : <IconCopy size={13} />}
              {copied ? 'Copié' : code}
            </button>
          )}
        </div>
        <PartyGameShell mode="controller" />
        <EmoteOverlay />
        <EmoteBar />
      </div>
    </PageTransition>
  )
}
