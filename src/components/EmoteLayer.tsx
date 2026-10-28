import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePartyStore } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { EMOTES } from '../data/emotes'
import { IconSmile, IconClose } from './icons'

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
        <span className={`${big ? 'text-sm' : 'text-[10px]'} text-chalk-soft font-semibold bg-ink/30 rounded-full px-2 py-0.5 mt-0.5`}>
          {pseudo}
        </span>
      )}
    </motion.div>
  )
}

/** Sélecteur de réactions de la manette : un bouton 😀 dans la barre du haut, qui déplie la rangée
 * de réactions vers le bas. Il vivait en bas à droite, par-dessus le bouton principal de la moitié
 * des écrans (« Retour au salon », « Manche suivante »…). */
export function EmoteBar() {
  const sendEmote = usePartyStore((s) => s.sendEmote)
  const { play } = useSound()
  const [open, setOpen] = useState(false)

  // Pas de `relative` ici : la rangée se cale sous le bord gauche de la barre du haut (son ancêtre
  // positionné), pas sous ce bouton, troisième de la barre — elle déborderait sur un petit écran.
  return (
    <div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-chip bg-felt-raised border border-line flex items-center justify-center text-chalk-muted"
        aria-label="Réactions"
        aria-expanded={open}
      >
        {/* Le bouton est une icône ; ce qu'il ouvre reste des emojis. C'est exactement la
            frontière posée par le socle : l'interface est dessinée, l'expression est humaine. */}
        {open ? <IconClose size={17} /> : <IconSmile size={18} />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 glass-card rounded-2xl p-2 grid grid-cols-4 gap-1 origin-top-left"
          >
            {EMOTES.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  play('pop')
                  sendEmote(emoji)
                }}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl active:bg-felt-raised"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
