import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePartyStore } from '../store/usePartyStore'
import { Surface } from '../components/Card'
import { Button } from '../components/Button'
import { IconAlert, IconPlay, IconSpeaker } from '../components/icons'
import { YouTubeDecks } from './engine/YouTubeDecks'

const TV_PLATINE_ID_KEY = 'mindmatch-tv-platine-id'

function tvPlatineId(): string {
  try {
    const saved = sessionStorage.getItem(TV_PLATINE_ID_KEY)
    if (saved) return saved
  } catch {
    /* stockage indisponible */
  }
  const id = `tv-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`
  try {
    sessionStorage.setItem(TV_PLATINE_ID_KEY, id)
  } catch {
    /* tant pis */
  }
  return id
}

/**
 * « Jouer le son sur la TV » : l'écran partagé devient la platine. Monté par la TV quand l'hôte l'a
 * choisi (source YouTube), il reste en place pendant les jeux — la musique continue, baissée si
 * l'hôte l'a voulu — et ne montre rien d'autre que ses deux lecteurs, invisibles.
 *
 * Un navigateur ne lit pas de son sans geste : la première fois, la TV demande qu'on touche
 * « Démarrer le son » (une télécommande compte comme un geste).
 */
export function TvPlatine() {
  const claimPlatine = usePartyStore((s) => s.claimPlatine)
  const releasePlatine = usePartyStore((s) => s.releasePlatine)
  const active = usePartyStore((s) => s.platineActive)
  const platine = usePartyStore((s) => s.platine)
  const connected = usePartyStore((s) => s.connected)
  const [platineId] = useState(tvPlatineId)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const role = useMemo(() => ({ platineId, kind: 'tv' as const }), [platineId])

  const claim = async () => {
    const ack = await claimPlatine(role)
    setError(ack.ok ? null : (ack.error ?? null))
  }

  // Le son revient sur la platine (l'hôte a décoché l'option) : la TV rend sa place.
  useEffect(() => () => releasePlatine(), [releasePlatine])

  // Démarrée mais pas (ou plus) active : on reprend dès que c'est possible — place libre, ou tenue par
  // une platine-appareil (le choix de l'hôte prime).
  useEffect(() => {
    if (!started || active || !connected) return
    if (platine?.online && platine.kind === 'tv') return
    void claim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, active, connected, platine?.online, platine?.kind])

  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000)
  }

  return (
    <>
      <YouTubeDecks started={started} active={active} view="hidden" onNotice={flash} />
      <AnimatePresence>
        {!started && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-6 z-50 w-[min(calc(100vw-3rem),34rem)]"
          >
            <Surface level="floating" className="!p-5 flex items-center gap-4">
              <IconSpeaker size={30} className="text-spark shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-base text-chalk">Le son passe sur la TV</p>
                <p className="text-xs text-chalk-soft mt-0.5">Touche « Démarrer le son » : la musique de la soirée sortira d’ici.</p>
              </div>
              <Button
                autoFocus
                onClick={() => {
                  setStarted(true)
                  void claim()
                }}
                className="shrink-0 flex items-center gap-2"
              >
                <IconPlay size={17} />
                Démarrer le son
              </Button>
            </Surface>
          </motion.div>
        )}
        {(notice || (started && error && !active)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-6 z-50 rounded-chip border border-blood/50 bg-felt-raised px-4 py-2 text-sm text-chalk flex items-center gap-2"
          >
            <IconAlert size={16} className="text-blood" />
            {notice ?? error}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
