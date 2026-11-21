import { useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../../store/usePartyStore'
import { useAppStore } from '../../store/useAppStore'
import { useSound } from '../../hooks/useSound'
import { AVERAGE_TRACK_MS, formatDuration, formatSpan, orderedQueue, queueEtas, reactionTotal } from '../../lib/jukebox'
import { Surface } from '../../components/Card'
import { Button } from '../../components/Button'
import { IconArrowUp, IconMore, IconPin, IconPlayNext, IconPlus, IconReplay, IconTrash } from '../../components/icons'
import type { MusicTrack } from '../../types'
import { TrackArt } from '../ui'
import { useIsMusicHost, useMemberLookup, useNow } from '../hooks'

function clock(ms: number): string {
  return new Date(Date.now() + ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * « File » : l'ordre de passage réel (équitable), qui se réordonne en glissant quand un vote ou un
 * ajout le change. Mes morceaux ressortent, avec l'heure à laquelle ils devraient passer. En dessous,
 * ce qui est déjà passé — et qu'on peut relancer.
 */
export function QueueTab({ onAdd, onAdded }: { onAdd: () => void; onAdded: (trackId: string) => void }) {
  const music = usePartyStore((s) => s.group?.music)
  const serverNow = usePartyStore((s) => s.serverNow)
  const musicAction = usePartyStore((s) => s.musicAction)
  const myId = useAppStore((s) => s.identity?.memberId)
  const isHost = useIsMusicHost()
  const { byId } = useMemberLookup()
  const { play } = useSound()
  const [openId, setOpenId] = useState<string | null>(null)
  useNow(15_000)
  if (!music) return null

  const queue = orderedQueue(music)
  const etas = queueEtas(music, serverNow())
  const totalMs = queue.reduce((sum, t) => sum + (t.durationMs ?? AVERAGE_TRACK_MS), 0)
  const act = (type: string, payload: unknown) => {
    play('pop')
    return musicAction(type, payload)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <p className="kicker text-2xs">
          {queue.length} morceau{queue.length > 1 ? 'x' : ''}
          {queue.length > 0 && ` · ~${formatSpan(totalMs)}`}
        </p>
        <p className="text-2xs text-chalk-faint">Ordre équitable : chacun son tour</p>
      </div>

      {queue.length === 0 ? (
        <Surface className="!p-4 text-center">
          <p className="text-sm text-chalk mb-1">La file est vide</p>
          <p className="text-xs text-chalk-soft mb-4">
            {music.settings.continuous && music.autoNext
              ? `Le mode continu enchaînera avec « ${music.autoNext.title} », l’un des plus applaudis de la soirée.`
              : music.settings.continuous
                ? 'Le mode continu repiochera parmi les morceaux les plus applaudis dès qu’il y en aura.'
                : 'Ajoute un morceau : il passera juste après celui-ci.'}
          </p>
          <Button variant="secondary" onClick={onAdd} className="!min-h-[44px] text-sm inline-flex items-center gap-2">
            <IconPlus size={16} />
            Ajouter un morceau
          </Button>
        </Surface>
      ) : (
        <LayoutGroup>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {queue.map((track, i) => (
                <QueueRow
                  key={track.id}
                  track={track}
                  rank={i + 1}
                  eta={etas[track.id] ?? 0}
                  mine={track.addedById === myId}
                  bumped={!!myId && track.bumpVotes.includes(myId)}
                  adder={byId(track.addedById)?.pseudo ?? 'Quelqu’un'}
                  isHost={isHost}
                  open={openId === track.id}
                  onToggle={() => setOpenId((o) => (o === track.id ? null : track.id))}
                  onBump={() => void act('bump', { trackId: track.id })}
                  onPlayNext={() => {
                    setOpenId(null)
                    void act('playNext', { trackId: track.id })
                  }}
                  onRemove={() => {
                    setOpenId(null)
                    void act('remove', { trackId: track.id })
                  }}
                />
              ))}
            </AnimatePresence>
          </ul>
        </LayoutGroup>
      )}

      {music.history.length > 0 && (
        <div className="mt-7">
          <p className="kicker text-2xs mb-2">Déjà passés</p>
          <ul className="flex flex-col">
            {music.history.slice(0, 12).map((t, i) => {
              const queued = music.current?.sourceId === t.sourceId || music.queue.some((q) => q.sourceId === t.sourceId)
              const total = reactionTotal(t)
              return (
                <li key={`${t.id}-${i}`} className="flex items-center gap-3 py-2 border-b border-line last:border-b-0">
                  <TrackArt src={t.thumbnail} size={38} dim />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-chalk-muted truncate">{t.title}</p>
                    <p className="text-2xs text-chalk-faint truncate">
                      {byId(t.addedById)?.pseudo ?? 'Quelqu’un'}
                      {total > 0 && ` · ${total} réaction${total > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {queued ? (
                    <span className="shrink-0 text-2xs text-chalk-faint">Dans la file</span>
                  ) : (
                    <button
                      onClick={async () => {
                        const ack = await act('replay', { trackId: t.id })
                        if (ack.ok && ack.trackId) onAdded(ack.trackId)
                      }}
                      className="shrink-0 h-9 px-3 rounded-chip border border-line-strong text-xs text-chalk-muted flex items-center gap-1.5 active:bg-felt-raised"
                    >
                      <IconReplay size={14} />
                      Rejouer
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function QueueRow({
  track,
  rank,
  eta,
  mine,
  bumped,
  adder,
  isHost,
  open,
  onToggle,
  onBump,
  onPlayNext,
  onRemove,
}: {
  track: MusicTrack
  rank: number
  eta: number
  mine: boolean
  bumped: boolean
  adder: string
  isHost: boolean
  open: boolean
  onToggle: () => void
  onBump: () => void
  onPlayNext: () => void
  onRemove: () => void
}) {
  const pinned = !!track.pinnedAt
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -28, transition: { duration: 0.18 } }}
      transition={{ layout: { type: 'spring', stiffness: 380, damping: 34 } }}
      className={clsx('rounded-card border bg-felt/85 px-2.5 py-2', mine ? 'border-spark/50' : 'border-line')}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-5 shrink-0 text-center text-xs tabular-nums text-chalk-faint">{rank}</span>
        <TrackArt src={track.thumbnail} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-chalk truncate">{track.title}</p>
          <p className="text-2xs truncate mt-0.5">
            {pinned && <span className="text-brass">Ensuite · </span>}
            {mine ? <span className="text-spark font-semibold">Toi · vers {clock(eta)}</span> : <span className="text-chalk-soft">{adder}</span>}
            <span className="text-chalk-faint">{track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ''}</span>
          </p>
        </div>
        {!mine && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onBump}
            aria-pressed={bumped}
            aria-label="Faire monter dans la file"
            className={clsx(
              'shrink-0 h-9 min-w-[2.75rem] px-2 rounded-chip border flex items-center justify-center gap-1 text-xs tabular-nums',
              bumped ? 'border-spark bg-spark/15 text-chalk' : 'border-line-strong text-chalk-soft',
            )}
          >
            <IconArrowUp size={14} />
            {track.bumpVotes.length}
          </motion.button>
        )}
        {(isHost || mine) && (
          <button
            onClick={onToggle}
            aria-expanded={open}
            aria-label="Plus d’actions"
            className={clsx('shrink-0 w-9 h-9 rounded-chip flex items-center justify-center', open ? 'bg-felt-raised text-chalk' : 'text-chalk-soft')}
          >
            <IconMore size={18} />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pt-2.5 pb-0.5">
              {isHost && (
                <button onClick={onPlayNext} className="flex-1 h-10 rounded-control bg-felt-raised border border-line-strong text-xs text-chalk flex items-center justify-center gap-1.5">
                  {pinned ? <IconPin size={15} /> : <IconPlayNext size={15} />}
                  {pinned ? 'Remettre à son tour' : 'Jouer ensuite'}
                </button>
              )}
              <button onClick={onRemove} className="flex-1 h-10 rounded-control border border-blood/50 text-xs text-chalk flex items-center justify-center gap-1.5">
                <IconTrash size={15} className="text-blood" />
                Retirer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}
