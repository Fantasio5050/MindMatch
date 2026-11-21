import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../store/usePartyStore'
import { formatSpan } from '../lib/jukebox'
import { Button } from '../components/Button'
import { Vinyl } from './ui'
import { useIsMusicHost } from './hooks'

/** Fin de soirée, côté téléphone. */
export function SoireeRecap() {
  const navigate = useNavigate()
  const music = usePartyStore((s) => s.group?.music)
  const musicAction = usePartyStore((s) => s.musicAction)
  const isHost = useIsMusicHost()
  const recap = music?.recap
  if (!recap) return null
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-3">
      <Vinyl cover={recap.topTracks[0]?.thumbnail} size={160} spinning={false} />
      <p className="kicker text-2xs mt-4">Fin de soirée</p>
      <h1 className="font-display text-2xl text-chalk">
        {recap.tracksPlayed} morceaux en {formatSpan(recap.endedAt - recap.startedAt)}
      </h1>
      <div className="flex gap-2 mt-4">
        <Button variant="secondary" onClick={() => navigate('/lobby')}>
          Retour au salon
        </Button>
        {isHost && <Button onClick={() => void musicAction('dismiss')}>Refermer</Button>}
      </div>
    </div>
  )
}
