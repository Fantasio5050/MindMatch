import { usePartyStore } from '../store/usePartyStore'
import { CLIENT_GAME_REGISTRY } from './gameRegistry'

export function PartyGameShell({ mode }: { mode: 'controller' | 'screen' }) {
  const group = usePartyStore((s) => s.group)

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-sm">Connexion à la salle…</p>
      </div>
    )
  }

  const gameId = group.party.currentGameId
  if (!gameId) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6 text-center">
        <p className="text-white/40 text-sm">Aucune partie en cours — retournez au salon.</p>
      </div>
    )
  }

  const entry = CLIENT_GAME_REGISTRY[gameId]
  if (!entry) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6 text-center">
        <p className="text-white/40 text-sm">Ce jeu n'est pas encore disponible.</p>
      </div>
    )
  }

  const View = mode === 'controller' ? entry.Controller : entry.Screen
  return <View />
}
