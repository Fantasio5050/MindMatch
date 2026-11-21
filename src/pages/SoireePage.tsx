import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { PageTransition } from '../components/PageTransition'
import { useAppStore } from '../store/useAppStore'
import { usePartyStore } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { formatEta, orderedQueue, ordinal, queueEtas } from '../lib/jukebox'
import { IconAlert, IconArrowLeft, IconCheck } from '../components/icons'
import { CoverBackdrop } from '../soiree/ui'
import { ReactionRain } from '../soiree/reactions'
import { FeedTicker, GameBanner, PlatineAlert } from '../soiree/widgets'
import { useIsMusicHost } from '../soiree/hooks'
import { platineUrl } from '../soiree/links'
import { NowTab } from '../soiree/phone/NowTab'
import { AddTab } from '../soiree/phone/AddTab'
import { QueueTab } from '../soiree/phone/QueueTab'
import { HostTab } from '../soiree/phone/HostTab'
import { SoireeRecap } from '../soiree/Recap'

type Tab = 'now' | 'add' | 'queue' | 'host'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

/**
 * Mode Soirée, côté téléphone : la fenêtre de chacun sur la platine partagée.
 *
 * Quatre onglets — « En cours » (ce qui tourne, réagir, voter), « Ajouter » (recherche au fil de la
 * frappe, lien collé), « File » (l'ordre de passage, mes morceaux, l'historique) et, pour l'hôte,
 * « Régie » (la platine pilotée à distance). Au-dessus, en permanence : l'alerte si la platine ne
 * répond plus, la partie en cours s'il y en a une, et le fil d'activité — un fait à la fois.
 */
export function SoireePage() {
  const navigate = useNavigate()
  const identity = useAppStore((s) => s.identity)
  const connectAsPlayer = usePartyStore((s) => s.connectAsPlayer)
  const group = usePartyStore((s) => s.group)
  const music = usePartyStore((s) => s.group?.music ?? null)
  const musicError = usePartyStore((s) => s.musicError)
  const clearMusicError = usePartyStore((s) => s.clearMusicError)
  const musicAction = usePartyStore((s) => s.musicAction)
  const isHost = useIsMusicHost()
  const { play } = useSound()
  const [tab, setTab] = useState<Tab>('now')
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => {
    connectAsPlayer()
  }, [connectAsPlayer])

  // L'hôte a refermé la soirée → retour au salon.
  useEffect(() => {
    if (group && !music) navigate('/lobby')
  }, [group, music, navigate])

  // Une partie démarre pendant la soirée : comme depuis le salon, tout le monde la rejoint (la
  // musique, elle, continue). Seulement au DÉMARRAGE : venir ici en pleine partie reste possible.
  const status = group?.party.status
  const prevStatus = useRef(status)
  useEffect(() => {
    if (prevStatus.current && prevStatus.current !== 'playing' && status === 'playing') navigate('/play')
    prevStatus.current = status
  }, [status, navigate])

  const showToast = (text: string, tone: Toast['tone'] = 'ok') => {
    setToast({ id: Date.now(), text, tone })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3800)
  }

  useEffect(() => {
    if (!musicError) return
    setToast({ id: Date.now(), text: musicError, tone: 'error' })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3800)
    clearMusicError()
  }, [musicError, clearMusicError])

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  // Un non-hôte n'a pas de régie (l'hôte a pu changer).
  useEffect(() => {
    if (tab === 'host' && !isHost) setTab('now')
  }, [tab, isHost])

  if (!identity || !group || !music) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-sm">On rejoint la platine…</p>
      </div>
    )
  }

  if (music.endedAt) return <SoireeRecap />

  /** « Ajouté — passe dans ~8 min (3ᵉ) » : où atterrit le morceau qu'on vient d'ajouter. */
  const onAdded = (trackId: string) => {
    const st = usePartyStore.getState()
    const m = st.group?.music
    if (!m) return
    if (m.current?.id === trackId) return showToast('Ajouté — ça joue maintenant')
    const idx = orderedQueue(m).findIndex((t) => t.id === trackId)
    if (idx < 0) return showToast('Ajouté')
    const eta = queueEtas(m, st.serverNow())[trackId] ?? 0
    showToast(idx === 0 ? `Ajouté — c’est le prochain, ${formatEta(eta)}` : `Ajouté — passe ${formatEta(eta)} (${ordinal(idx + 1)})`)
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'now', label: 'En cours' },
    { key: 'add', label: 'Ajouter' },
    { key: 'queue', label: 'File', badge: music.queue.length },
    ...(isHost ? [{ key: 'host' as const, label: 'Régie' }] : []),
  ]
  const openPlatine = () => window.open(platineUrl(group.code, music.platineKey), '_blank')

  return (
    <>
      <CoverBackdrop cover={music.current?.thumbnail} />
      <PageTransition>
        <div className="relative z-10 min-h-svh">
          {/* L'en-tête reste en place au défilement ; le coin droit est celui des réglages audio. */}
          <header className="sticky top-0 z-20 bg-ink/90 border-b border-line safe-top">
            <div className="flex items-center gap-2 pl-4 pr-16 pt-3">
              <button
                onClick={() => {
                  play('pop')
                  navigate('/lobby')
                }}
                className="flex items-center gap-1.5 rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-muted text-sm shrink-0"
              >
                <IconArrowLeft size={15} />
                Salon
              </button>
              <div className="min-w-0 flex-1 pl-1">
                <p className="kicker text-2xs leading-none">Mode Soirée</p>
                <p className="font-display text-lg text-chalk leading-tight truncate">La platine</p>
              </div>
              <span className="shrink-0 rounded-chip border border-line px-2.5 h-7 flex items-center text-2xs font-semibold tracking-[0.18em] text-brass">
                {group.code}
              </span>
            </div>
            <nav className="flex gap-1.5 px-4 pt-3 pb-3" aria-label="Sections du Mode Soirée">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    play('pop')
                    setTab(t.key)
                  }}
                  aria-current={tab === t.key ? 'page' : undefined}
                  className={clsx(
                    'relative flex-1 h-9 rounded-chip text-sm border transition-colors flex items-center justify-center gap-1.5',
                    tab === t.key ? 'bg-felt-raised border-spark/60 text-chalk' : 'border-line text-chalk-muted',
                  )}
                >
                  {t.label}
                  {!!t.badge && (
                    <span
                      className={clsx(
                        'min-w-[1.25rem] h-5 px-1 rounded-chip text-2xs tabular-nums flex items-center justify-center',
                        tab === t.key ? 'bg-spark text-ink' : 'bg-felt-raised text-chalk-soft',
                      )}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </header>

          <main className="px-4 pt-3 pb-14 max-w-lg mx-auto">
            <PlatineAlert
              code={group.code}
              onOpenPlatine={isHost ? openPlatine : undefined}
              onSoundOnTv={() => void musicAction('settings', { output: 'tv' })}
              onSoundOnPlatine={() => void musicAction('settings', { output: 'device' })}
            />
            <GameBanner />
            <FeedTicker className="mb-3" idle="File équitable : chacun son tour, personne ne monopolise l’enceinte" />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {tab === 'now' && <NowTab onAdd={() => setTab('add')} />}
                {tab === 'add' && <AddTab onAdded={onAdded} />}
                {tab === 'queue' && <QueueTab onAdd={() => setTab('add')} onAdded={onAdded} />}
                {tab === 'host' && isHost && <HostTab code={group.code} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </PageTransition>

      <ReactionRain />

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-5 inset-x-4 z-50 mx-auto max-w-md safe-bottom"
            role="status"
          >
            <div
              className={clsx(
                'flex items-center gap-2.5 rounded-control border bg-felt-raised shadow-float px-4 py-3',
                toast.tone === 'error' ? 'border-blood/60' : 'border-jade/40',
              )}
            >
              {toast.tone === 'error' ? (
                <IconAlert size={17} className="text-blood shrink-0" />
              ) : (
                <IconCheck size={17} className="text-jade shrink-0" />
              )}
              <p className="text-sm text-chalk">{toast.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
