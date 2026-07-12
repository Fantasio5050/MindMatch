import { motion } from 'framer-motion'
import { usePartyStore } from '../store/usePartyStore'
import { CLIENT_GAME_REGISTRY } from './gameRegistry'
import { GAME_META } from '../data/gameMeta'
import { RoomCodeBadge } from '../components/RoomCodeBadge'
import { QRCode } from '../components/QRCode'
import { joinUrl } from '../lib/joinUrl'
import { Avatar } from '../components/Avatar'
import type { Group } from '../types'

export function PartyGameShell({ mode }: { mode: 'controller' | 'screen' }) {
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-sm">Connexion à la salle…</p>
      </div>
    )
  }

  const gameId = group.party.currentGameId
  if (!gameId) {
    if (mode === 'screen') return <ScreenLobbyWaiting group={group} />
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

  if (mode === 'controller') {
    const isParticipant = !!currentMember && group.party.participantIds.includes(currentMember.id)
    if (group.party.status === 'playing' && !isParticipant) {
      return <WaitingForNextGame group={group} gameId={gameId} />
    }
    return <entry.Controller />
  }

  return (
    <div className="relative">
      <entry.Screen />
      <RoomCodeBadge code={group.code} />
    </div>
  )
}

/** Shown on a latecomer's phone instead of the live game UI while a round they weren't present
 * for is in progress — they automatically drop into the next game (participantIds is recomputed
 * from the full roster every time a new game starts), no action needed from them. */
function WaitingForNextGame({ group, gameId }: { group: Group; gameId: string }) {
  const meta = GAME_META[gameId]
  const playing = group.members.filter((m) => group.party.participantIds.includes(m.id))

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center safe-top">
      <motion.span
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-5xl mb-4 block"
      >
        {meta?.icon ?? '🎮'}
      </motion.span>
      <h1 className="text-xl font-extrabold mb-2">Une partie est en cours</h1>
      <p className="text-white/60 text-sm max-w-xs mb-6">
        {meta?.name ?? 'Cette partie'} a déjà commencé. Tu rejoueras dès la prochaine manche — reste
        sur cette page, pas besoin de rien faire !
      </p>

      {playing.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-xs">
          {playing.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 glass-card rounded-full pl-1 pr-3 py-1">
              <Avatar pseudo={m.pseudo} color={m.color} size={22} />
              <span className="text-xs">{m.pseudo}</span>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
        <QRCode value={joinUrl(group.code)} size={56} />
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Inviter d'autres personnes</p>
          <p className="text-base font-bold tracking-[0.15em]">{group.code}</p>
        </div>
      </div>
    </div>
  )
}

/** TV/spectator view before any game has started — shows the room code prominently (with a QR
 * code to scan) plus who's already connected, instead of a blank "nothing happening" screen. */
function ScreenLobbyWaiting({ group }: { group: Group }) {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-12 text-center">
      <p className="text-white/40 text-2xl uppercase tracking-widest mb-3">{group.name}</p>
      <h1 className="text-3xl text-white/70 mb-10">En attente du lancement d'une partie…</h1>

      <div className="glass-card rounded-3xl p-8 flex items-center gap-8 mb-12">
        <QRCode value={joinUrl(group.code)} size={180} />
        <div className="text-left">
          <p className="text-white/40 text-xl uppercase tracking-widest mb-2">Code de la salle</p>
          <p className="text-6xl font-extrabold tracking-[0.15em] shimmer-text">{group.code}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
        {group.members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 glass-card rounded-full pl-1.5 pr-4 py-1.5">
            <Avatar pseudo={m.pseudo} color={m.color} size={32} />
            <span className="text-lg font-medium">{m.pseudo}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
