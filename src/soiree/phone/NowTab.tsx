import { motion } from 'framer-motion'
import { usePartyStore } from '../../store/usePartyStore'
import { useAppStore } from '../../store/useAppStore'
import { peekNext } from '../../lib/jukebox'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { IconPlus } from '../../components/icons'
import { Vinyl, TrackArt, MusicProgress } from '../ui'
import { ReactionBar } from '../reactions'
import { SkipGauge } from '../widgets'
import { useMemberLookup } from '../hooks'

/**
 * « En cours » : le disque qui tourne, qui l'a mis (et pourquoi — la dédicace), les réactions, le
 * vote pour passer, et ce qui vient ensuite. Tout ce qu'on regarde quand un morceau démarre.
 */
export function NowTab({ onAdd }: { onAdd: () => void }) {
  const music = usePartyStore((s) => s.group?.music)
  const platine = usePartyStore((s) => s.platine)
  const myId = useAppStore((s) => s.identity?.memberId)
  const { byId } = useMemberLookup()
  if (!music) return null
  const current = music.current

  if (!current) {
    return (
      <div className="flex flex-col items-center text-center pt-2">
        <Vinyl cover={null} size={196} spinning={false} className="opacity-60" />
        <p className="kicker text-2xs mt-6 mb-1">La platine attend</p>
        <h2 className="font-display text-2xl text-chalk mb-2">Lance le premier morceau</h2>
        <p className="text-sm text-chalk-soft max-w-xs mb-6">
          Chacun son tour : la file est équitable, personne ne monopolise l’enceinte.
        </p>
        <Button onClick={onAdd} className="flex items-center gap-2">
          <IconPlus size={18} />
          Ajouter un morceau
        </Button>
      </div>
    )
  }

  const adder = byId(current.addedById)
  const mine = current.addedById === myId
  const spinning = music.isPlaying && !!music.anchor?.playing && !!platine?.online
  const status = !platine?.online
    ? 'Platine hors ligne'
    : !music.isPlaying
      ? 'En pause'
      : !music.anchor?.playing
        ? 'La platine se cale'
        : current.auto
          ? 'En cours · mode continu'
          : 'En cours'
  const next = peekNext(music)
  const nextBy = next ? byId(next.addedById) : undefined

  return (
    <div className="flex flex-col items-center text-center">
      <motion.div key={current.id} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
        <Vinyl cover={current.thumbnail} size={204} spinning={spinning} />
      </motion.div>

      <p className="kicker text-2xs mt-5">{status}</p>
      <h2 className="font-display text-2xl text-chalk leading-tight line-clamp-2 px-2 mt-1.5 [overflow-wrap:anywhere]">{current.title}</h2>
      {current.artist && <p className="text-sm text-chalk-soft truncate max-w-full mt-1">{current.artist}</p>}

      <MusicProgress className="mt-4" />

      <div className="mt-3 w-full flex items-center gap-3 rounded-card bg-felt/75 border border-line px-3 py-2.5 text-left">
        {adder && <Avatar pseudo={adder.pseudo} color={adder.color} size={26} photoUrl={adder.photoUrl} />}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-chalk-soft truncate">
            {mine ? (current.auto ? 'Ton morceau, repioché par le mode continu' : 'Ton morceau') : current.auto ? `Repioché · ajouté par ${adder?.pseudo ?? 'quelqu’un'}` : `Ajouté par ${adder?.pseudo ?? 'quelqu’un'}`}
          </p>
          {current.dedication && (
            <p className="text-sm text-chalk leading-snug line-clamp-2 [overflow-wrap:anywhere]">« {current.dedication} »</p>
          )}
        </div>
      </div>

      <div className="mt-3 w-full">
        <ReactionBar />
      </div>
      <SkipGauge className="mt-2.5" />

      <div className="mt-4 w-full flex items-center gap-3 text-left">
        {next ? (
          <>
            <TrackArt src={next.thumbnail} size={40} />
            <div className="min-w-0 flex-1">
              <p className="kicker text-2xs">{next.auto ? 'Ensuite · mode continu' : 'Ensuite'}</p>
              <p className="text-sm text-chalk truncate">{next.title}</p>
            </div>
            {nextBy && <span className="text-2xs text-chalk-faint shrink-0 max-w-[30%] truncate">{next.addedById === myId ? 'toi' : nextBy.pseudo}</span>}
          </>
        ) : (
          <button onClick={onAdd} className="w-full flex items-center gap-3 rounded-card border border-dashed border-line-strong px-3 py-2.5 text-left">
            <IconPlus size={18} className="text-spark shrink-0" />
            <span className="text-sm text-chalk-soft">Rien ensuite pour l’instant — ajoute le prochain</span>
          </button>
        )}
      </div>
    </div>
  )
}
