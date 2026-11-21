import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { IconChevron } from '../components/icons'
import { StatusDot, Vinyl } from './ui'
import { useMemberLookup } from './hooks'

/**
 * La soirée tourne : le salon le montre en haut, sans y forcer personne. Avant, tout le monde était
 * renvoyé de force sur la page de la platine dès que la musique démarrait — impossible de lancer un
 * jeu en même temps. Ici, un disque qui tourne, ce qui passe, et un accès d'un geste.
 */
export function SoireeBanner() {
  const navigate = useNavigate()
  const music = usePartyStore((s) => s.group?.music)
  const platine = usePartyStore((s) => s.platine)
  const { byId } = useMemberLookup()
  const { play } = useSound()
  if (!music) return null
  const current = music.current
  const ended = !!music.endedAt
  const spinning = !!current && music.isPlaying && !!music.anchor?.playing && !!platine?.online
  const adder = current ? byId(current.addedById) : undefined

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        play('pop')
        navigate('/soiree')
      }}
      className="w-full mt-1 mb-6 text-left rounded-card border border-spark-dim/50 bg-felt-raised shadow-raised px-4 py-3.5 flex items-center gap-4"
    >
      <Vinyl cover={ended ? music.recap?.topTracks[0]?.thumbnail : current?.thumbnail} size={62} spinning={spinning} />
      <div className="min-w-0 flex-1">
        <p className="kicker text-2xs flex items-center gap-1.5">
          {ended ? (
            'La soirée est finie'
          ) : (
            <>
              <StatusDot tone={platine?.online ? 'live' : 'off'} />
              {platine?.online ? 'Soirée en cours' : 'Soirée · platine hors ligne'}
            </>
          )}
        </p>
        <p className="font-display text-lg text-chalk leading-tight truncate mt-1">
          {ended ? 'Voir le récap' : (current?.title ?? 'La platine attend son premier morceau')}
        </p>
        <p className="text-2xs text-chalk-soft truncate mt-0.5">
          {ended
            ? `${music.recap?.tracksPlayed ?? 0} morceaux, les plus applaudis, les meilleurs DJ`
            : current
              ? `${current.artist ? `${current.artist} · ` : ''}ajouté par ${adder?.pseudo ?? 'quelqu’un'} · ${music.queue.length} en file`
              : 'Ajoute un morceau, il part tout de suite'}
        </p>
      </div>
      <IconChevron size={18} className="-rotate-90 text-chalk-soft shrink-0" />
    </motion.button>
  )
}
