import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { usePartyStore } from '../store/usePartyStore'
import { useAppStore } from '../store/useAppStore'
import { useSound } from '../hooks/useSound'
import { Surface } from '../components/Card'
import { IconChevron, IconMusic } from '../components/icons'
import { MusicProgress, TrackArt, Vinyl } from './ui'
import { ReactionBar } from './reactions'
import { SkipGauge } from './widgets'
import { useMemberLookup } from './hooks'

/**
 * Le mini-lecteur de la manette, pendant une partie : un petit disque dans la barre du haut (il
 * tourne quand la musique joue) qui déplie, sous la barre, le titre en cours, les réactions et le
 * vote pour passer. Replié par défaut : la manette de jeu garde tout l'écran.
 */
export function SoireeMiniPlayer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const music = usePartyStore((s) => s.group?.music)
  const platine = usePartyStore((s) => s.platine)
  const myId = useAppStore((s) => s.identity?.memberId)
  const { byId } = useMemberLookup()
  const { play } = useSound()
  if (!music || music.endedAt) return null
  const current = music.current
  const spinning = !!current && music.isPlaying && !!music.anchor?.playing && !!platine?.online
  const adder = current ? byId(current.addedById) : undefined

  // Pas de `relative` : le volet se cale sous le bord gauche de la barre du haut, comme les réactions.
  return (
    <div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          play('pop')
          onOpenChange(!open)
        }}
        className="w-9 h-9 rounded-chip bg-felt-raised border border-line flex items-center justify-center text-chalk-muted"
        aria-label="Musique de la soirée"
        aria-expanded={open}
      >
        {current ? <Vinyl cover={current.thumbnail} size={28} spinning={spinning} /> : <IconMusic size={17} />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-left"
          >
            <Surface level="floating" className="!p-3.5">
              {current ? (
                <>
                  <div className="flex items-center gap-3">
                    <TrackArt src={current.thumbnail} size={46} />
                    <div className="min-w-0 flex-1">
                      <p className="kicker text-2xs truncate">
                        {!platine?.online ? 'Platine hors ligne' : music.isPlaying ? 'En cours' : 'En pause'}
                        {adder && ` · ${adder.id === myId ? 'ton morceau' : adder.pseudo}`}
                      </p>
                      <p className="text-sm text-chalk truncate">{current.title}</p>
                      {current.artist && <p className="text-2xs text-chalk-faint truncate">{current.artist}</p>}
                    </div>
                  </div>
                  <MusicProgress className="mt-2.5" />
                  <div className="mt-1.5">
                    <ReactionBar compact />
                  </div>
                  <SkipGauge compact className="mt-2" />
                </>
              ) : (
                <p className="text-sm text-chalk-soft py-1">La platine attend son premier morceau.</p>
              )}
              <button
                onClick={() => {
                  onOpenChange(false)
                  navigate('/soiree')
                }}
                className="mt-1.5 w-full h-9 flex items-center justify-center gap-1 text-xs text-chalk-soft"
              >
                Ouvrir la soirée
                <IconChevron size={14} className="-rotate-90" />
              </button>
            </Surface>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
