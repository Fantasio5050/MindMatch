import { usePartyStore } from '../store/usePartyStore'
import { CLIENT_GAME_REGISTRY } from './gameRegistry'
import { GAME_META } from '../data/gameMeta'
import { RoomCodeBadge } from '../components/RoomCodeBadge'
import { QRCode } from '../components/QRCode'
import { joinUrl } from '../lib/joinUrl'
import { Surface } from '../components/Card'
import { Player } from '../components/Player'
import { Stage, PlayerRail } from './primitives'
import { SurfaceContext } from './surface'
import { GameIcon } from '../components/icons'
import type { Group } from '../types'

export function PartyGameShell({ mode }: { mode: 'controller' | 'screen' }) {
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-soft text-sm">Connexion à la salle…</p>
      </div>
    )
  }

  const gameId = group.party.currentGameId
  if (!gameId) {
    if (mode === 'screen')
      return (
        <SurfaceContext.Provider value="tv">
          <ScreenLobbyWaiting group={group} />
        </SurfaceContext.Provider>
      )
    return (
      <div className="min-h-svh flex items-center justify-center px-6 text-center">
        <p className="text-chalk-soft text-sm">Aucune partie en cours — retournez au salon.</p>
      </div>
    )
  }

  const entry = CLIENT_GAME_REGISTRY[gameId]
  if (!entry) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6 text-center">
        <p className="text-chalk-soft text-sm">Ce jeu n'est pas encore disponible.</p>
      </div>
    )
  }

  if (mode === 'controller') {
    const isParticipant = !!currentMember && group.party.participantIds.includes(currentMember.id)
    if (group.party.status === 'playing' && !isParticipant) {
      return <WaitingForNextGame group={group} gameId={gameId} />
    }
    return (
      <SurfaceContext.Provider value="phone">
        <entry.Controller />
      </SurfaceContext.Provider>
    )
  }

  return (
    <SurfaceContext.Provider value="tv">
      <div className="relative">
        <entry.Screen />
        <RoomCodeBadge code={group.code} />
      </div>
    </SurfaceContext.Provider>
  )
}

/**
 * Écran du retardataire : une manche est en cours, il n'y participe pas.
 *
 * C'était l'un des pires « jamais seul dans son téléphone » du produit : une icône qui tourne en
 * boucle et un texte d'excuse. On montre maintenant qui joue en ce moment — le retardataire
 * regarde la partie depuis sa main au lieu d'attendre qu'on veuille bien de lui. Il entre
 * automatiquement à la manche suivante (`participantIds` est recalculé à chaque lancement).
 */
function WaitingForNextGame({ group, gameId }: { group: Group; gameId: string }) {
  const meta = GAME_META[gameId]
  const playing = group.members.filter((m) => group.party.participantIds.includes(m.id))

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center safe-top">
      <GameIcon gameId={gameId} size={30} className="text-chalk-soft mb-3" />
      <p className="kicker text-2xs mb-2">En cours</p>
      <h1 className="font-display text-2xl text-chalk mb-2">{meta?.name ?? 'Une partie'}</h1>
      <p className="text-chalk-soft text-sm max-w-xs mb-7">
        Tu entres à la prochaine manche, automatiquement. Rien à faire.
      </p>

      {playing.length > 0 && (
        <>
          <p className="kicker text-2xs mb-3">
            {playing.length} joueur{playing.length > 1 ? 's' : ''} à table
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-3 justify-center mb-8 max-w-xs">
            {playing.map((m) => (
              <Player key={m.id} member={m} size="md" host={m.id === group.party.hostMemberId} />
            ))}
          </div>
        </>
      )}

      <Surface className="flex items-center gap-3">
        <QRCode value={joinUrl(group.code)} size={56} />
        <div className="text-left">
          <p className="kicker text-2xs">Inviter</p>
          <p className="font-stage text-lg text-brass tracking-[0.2em]">{group.code}</p>
        </div>
      </Surface>
    </div>
  )
}

/**
 * La TV avant le lancement d'une partie.
 *
 * L'écran disait « En attente du lancement d'une partie… » — l'exemple type de l'état mort que le
 * socle interdit. Il ne se passait rien, et l'écran le confirmait. Or c'est LE moment où les gens
 * arrivent, scannent, choisissent leur pseudo : c'est déjà de la soirée.
 *
 * Donc : le code en très grand (c'est l'action que la pièce doit faire), la table qui se remplit
 * en dessous, et un compteur qui monte à chaque arrivée. Aucune phrase d'attente.
 */
function ScreenLobbyWaiting({ group }: { group: Group }) {
  const n = group.members.length

  return (
    <Stage
      kicker={group.name}
      title="Rejoignez la table"
      rail={
        <div className="text-center">
          <PlayerRail members={group.members} hostId={group.party.hostMemberId} className="mb-4" />
          <p className="text-tv-xs text-chalk-faint">
            {n} à table · l'hôte lance quand vous êtes prêts
          </p>
        </div>
      }
    >
      <div className="flex items-center gap-12">
        <QRCode value={joinUrl(group.code)} size={200} />
        <div className="text-left">
          <p className="kicker text-tv-xs mb-2">Code de la salle</p>
          <p className="font-stage text-tv-3xl text-brass tracking-[0.12em] leading-none">{group.code}</p>
        </div>
      </div>
    </Stage>
  )
}
