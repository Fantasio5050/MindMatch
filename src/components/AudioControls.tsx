import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMusic } from '../hooks/useMusic'
import { useSound } from '../hooks/useSound'
import { IconMusic, IconSpeaker, IconSpeakerOff, IconHeadphones, type IconProps } from './icons'

/** Floating audio settings, mounted once at the app root so it (and the music it starts) is
 * available everywhere — menus, lobby, games, TV screen. Also owns the one-time "first user
 * gesture" listener that kicks off background music (browsers block autoplay before that). */
export function AudioControls() {
  const location = useLocation()
  const music = useMusic()
  const sound = useSound()
  const { requestStart } = music
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => requestStart()
    window.addEventListener('pointerdown', handler, { once: true })
    window.addEventListener('keydown', handler, { once: true })
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [requestStart])

  const allMuted = music.muted && sound.muted

  // La platine tient l'enceinte et n'utilise ni musique d'ambiance ni effets sonores : ce bouton
  // n'y sert à rien, on le masque.
  if (location.pathname.startsWith('/platine')) return null

  return (
    <div className="fixed top-3 right-3 z-40 safe-top">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="glass-card rounded-2xl p-3.5 w-56 absolute right-0 top-12 shadow-xl shadow-black/30"
          >
            <ToggleRow
              label="Musique"
              Mark={IconMusic}
              active={!music.muted}
              onToggle={() => {
                sound.play('pop')
                music.toggleMuted()
              }}
            />
            {!music.muted && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={music.volume}
                onChange={(e) => music.setVolume(Number(e.target.value))}
                className="w-full accent-spark mt-1.5 mb-3"
                aria-label="Volume de la musique"
              />
            )}
            <ToggleRow label="Effets sonores" Mark={IconSpeaker} active={!sound.muted} onToggle={sound.toggleMuted} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          sound.play('pop')
          setOpen((o) => !o)
        }}
        className="w-10 h-10 rounded-chip glass-card flex items-center justify-center text-chalk-muted"
        aria-label="Réglages audio"
      >
        {allMuted ? <IconSpeakerOff size={18} /> : <IconHeadphones size={18} />}
      </motion.button>
    </div>
  )
}

function ToggleRow({
  label,
  Mark,
  active,
  onToggle,
}: {
  label: string
  Mark: (p: IconProps) => React.ReactElement
  active: boolean
  onToggle: () => void
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2.5 w-full py-1">
      <Mark size={17} className="shrink-0 text-chalk-soft" />
      <span className="flex-1 text-left text-sm text-chalk-muted truncate">{label}</span>
      <span
        className={`w-9 h-5 rounded-chip relative shrink-0 transition-colors ${active ? 'bg-spark' : 'bg-felt-raised'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-chip bg-chalk transition-transform ${active ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </span>
    </button>
  )
}
