import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePartyStore } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { EMOTES } from '../data/emotes'

/** Floating emoji reactions rising across the screen. Mounted on both the phone controllers and
 * the TV screen; purely decorative (pointer-events-none) so it never blocks the game UI. */
export function EmoteOverlay({ big = false }: { big?: boolean }) {
  const emotes = usePartyStore((s) => s.emotes)
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const seenRef = useRef(new Set<string>())

  useEffect(() => {
    for (const e of emotes) {
      if (!seenRef.current.has(e.id)) {
        seenRef.current.add(e.id)
        play('emote')
      }
    }
  }, [emotes, play])

  return (
    <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {emotes.map((e) => (
          <FloatingEmote
            key={e.id}
            emoji={e.emoji}
            pseudo={group?.members.find((m) => m.id === e.memberId)?.pseudo ?? ''}
            big={big}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function FloatingEmote({ emoji, pseudo, big }: { emoji: string; pseudo: string; big: boolean }) {
  // Randomize once per emote so simultaneous reactions spread across the screen width.
  const style = useMemo(
    () => ({
      left: `${8 + Math.random() * 78}%`,
      drift: (Math.random() - 0.5) * 90,
      rotate: (Math.random() - 0.5) * 40,
      duration: 2.6 + Math.random() * 0.9,
    }),
    [],
  )

  return (
    <motion.div
      initial={{ y: 0, opacity: 0, scale: 0.4 }}
      animate={{ y: big ? '-70vh' : '-55vh', x: style.drift, opacity: [0, 1, 1, 0], scale: 1, rotate: style.rotate }}
      exit={{ opacity: 0 }}
      transition={{ duration: style.duration, ease: 'easeOut', opacity: { times: [0, 0.1, 0.75, 1], duration: style.duration } }}
      className="absolute bottom-24 flex flex-col items-center"
      style={{ left: style.left }}
    >
      <span style={{ fontSize: big ? 64 : 40 }}>{emoji}</span>
      {pseudo && (
        <span className={`${big ? 'text-sm' : 'text-[10px]'} text-white/60 font-semibold bg-black/30 rounded-full px-2 py-0.5 mt-0.5`}>
          {pseudo}
        </span>
      )}
    </motion.div>
  )
}

/** Collapsible emoji picker for the phone controller — a floating 😀 button that expands into the
 * reaction row. Hidden for spectators (they have no member identity to react as). */
export function EmoteBar() {
  const sendEmote = usePartyStore((s) => s.sendEmote)
  const { play } = useSound()
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="glass-card rounded-2xl p-2 grid grid-cols-4 gap-1"
          >
            {EMOTES.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  play('pop')
                  sendEmote(emoji)
                }}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl active:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((o) => !o)}
        className="w-11 h-11 rounded-full glass-card flex items-center justify-center text-xl"
        aria-label="Réactions"
      >
        {open ? '✕' : '😀'}
      </motion.button>
    </div>
  )
}
