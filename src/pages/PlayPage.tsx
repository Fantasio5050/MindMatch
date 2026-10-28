import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
  const connected = usePartyStore((s) => s.connected)
  const error = usePartyStore((s) => s.error)
  const clearError = usePartyStore((s) => s.clearError)
  // « Reconnexion… » seulement après une première connexion réussie, pas pendant le chargement.
  const wasConnected = useRef(false)
  if (connected) wasConnected.current = true
  const offline = !connected && wasConnected.current

  // Les messages d'erreur du serveur (« Action impossible… ») s'effacent d'eux-mêmes.
  useEffect(() => {
    if (!error) return
    const t = window.setTimeout(clearError, 3500)
    return () => window.clearTimeout(t)
  }, [error, clearError])

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
          <EmoteBar />
        </div>
        <AnimatePresence>
          {(offline || error) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-16 inset-x-4 z-50 rounded-control border border-blood/40 bg-ink/90 px-4 py-2.5 text-center text-sm text-chalk backdrop-blur-sm safe-top"
              role="status"
            >
              {offline ? 'Connexion perdue — reconnexion en cours…' : error}
            </motion.div>
          )}
        </AnimatePresence>
        <PartyGameShell mode="controller" />
        <EmoteOverlay />
      </div>
    </PageTransition>
  )
}
