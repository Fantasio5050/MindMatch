import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore, type MusicReactionEvent } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { MUSIC_REACTIONS } from '../lib/jukebox'

/**
 * Les réactions au morceau en cours.
 *
 * Ce sont des emojis — l'une des rares places où le produit en accepte : c'est de l'expression
 * humaine, pas de l'interface. Chaque réaction s'envole sur TOUS les écrans (téléphones, platine, TV)
 * et compte pour le morceau : c'est ce qui fait les « plus applaudis » du récap et nourrit le mode
 * continu.
 */
export function ReactionBar({ disabled = false, compact = false }: { disabled?: boolean; compact?: boolean }) {
  const musicAction = usePartyStore((s) => s.musicAction)
  const counts = usePartyStore((s) => s.group?.music?.current?.reactions)
  const { play } = useSound()
  return (
    <div className={clsx('flex justify-between w-full', compact ? 'gap-1' : 'gap-2')}>
      {MUSIC_REACTIONS.map((emoji) => {
        const n = counts?.[emoji] ?? 0
        return (
          <motion.button
            key={emoji}
            whileTap={{ scale: 0.82 }}
            disabled={disabled}
            onClick={() => {
              play('pop')
              void musicAction('react', { emoji })
            }}
            className={clsx(
              'relative flex-1 flex flex-col items-center justify-center rounded-control bg-felt/80 border border-line active:bg-felt-raised disabled:opacity-40',
              compact ? 'h-11' : 'h-14',
            )}
            aria-label={`Réagir ${emoji}`}
          >
            <span className={compact ? 'text-xl leading-none' : 'text-2xl leading-none'}>{emoji}</span>
            {!compact && <span className={clsx('text-2xs tabular-nums mt-1 leading-none', n ? 'text-chalk-muted' : 'text-transparent')}>{n || 0}</span>}
          </motion.button>
        )
      })}
    </div>
  )
}

/** Les réactions qui s'envolent. `size` : téléphone, ou scène (platine / TV, lue de loin). */
export function ReactionRain({ size = 'phone' }: { size?: 'phone' | 'stage' }) {
  const reactions = usePartyStore((s) => s.musicReactions)
  const members = usePartyStore((s) => s.group?.members)
  return (
    <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden" aria-hidden>
      <AnimatePresence>
        {reactions.map((r) => (
          <Floating key={r.id} reaction={r} pseudo={members?.find((m) => m.id === r.memberId)?.pseudo ?? ''} size={size} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function Floating({ reaction, pseudo, size }: { reaction: MusicReactionEvent; pseudo: string; size: 'phone' | 'stage' }) {
  // Tiré une fois par réaction : des réactions simultanées se répartissent sur la largeur.
  const style = useMemo(
    () => ({
      left: `${6 + Math.random() * 82}%`,
      drift: (Math.random() - 0.5) * (size === 'stage' ? 160 : 70),
      rotate: (Math.random() - 0.5) * 36,
      duration: 2.8 + Math.random() * 0.8,
    }),
    [size],
  )
  const stage = size === 'stage'
  return (
    <motion.div
      initial={{ y: 0, opacity: 0, scale: 0.4 }}
      animate={{ y: stage ? '-72vh' : '-48vh', x: style.drift, opacity: [0, 1, 1, 0], scale: 1, rotate: style.rotate }}
      exit={{ opacity: 0 }}
      transition={{ duration: style.duration, ease: 'easeOut', opacity: { times: [0, 0.1, 0.72, 1], duration: style.duration } }}
      className={clsx('absolute flex flex-col items-center', stage ? 'bottom-[8vh]' : 'bottom-28')}
      style={{ left: style.left }}
    >
      <span style={{ fontSize: stage ? 'clamp(40px, 7vh, 96px)' : 38 }}>{reaction.emoji}</span>
      {pseudo && (
        <span
          className={clsx(
            'font-semibold text-chalk-muted bg-ink/55 rounded-chip px-2 py-0.5 mt-0.5',
            stage ? 'text-tv-xs' : 'text-2xs',
          )}
        >
          {pseudo}
        </span>
      )}
    </motion.div>
  )
}
