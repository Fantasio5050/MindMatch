import clsx from 'clsx'
import { Player } from '../../components/Player'
import type { Member } from '../../types'

/**
 * PlayerRail — le groupe, visible en permanence au bas de la scène TV.
 *
 * Rôle : rendre l'appartenance tangible. Même quand la scène montre autre chose, la pièce voit
 * qui joue, qui a agi, qui est tombé. C'est ce bandeau qui fait qu'un joueur éliminé continue
 * d'exister à l'écran au lieu de disparaître — et donc que sa chute reste un événement partagé.
 */
export interface PlayerRailProps {
  members: Member[]
  /** Ordre d'affichage (ordre de table). Par défaut, l'ordre du tableau `members`. */
  order?: string[]
  speakingId?: string | null
  actedIds?: string[]
  eliminatedIds?: string[]
  offlineIds?: string[]
  hostId?: string | null
  /** Libellé sous chaque joueur (rôle révélé, score…). */
  captionFor?: (member: Member) => string | undefined
  className?: string
}

export function PlayerRail({
  members,
  order,
  speakingId,
  actedIds = [],
  eliminatedIds = [],
  offlineIds = [],
  hostId,
  captionFor,
  className,
}: PlayerRailProps) {
  const sorted = order
    ? order.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m)
    : members

  return (
    <div className={clsx('flex flex-wrap gap-x-7 gap-y-4 justify-center', className)}>
      {sorted.map((m) => (
        <Player
          key={m.id}
          member={m}
          size="focus"
          speaking={speakingId === m.id}
          acted={actedIds.includes(m.id)}
          eliminated={eliminatedIds.includes(m.id)}
          offline={offlineIds.includes(m.id)}
          host={hostId === m.id}
          caption={captionFor?.(m)}
        />
      ))}
    </div>
  )
}
