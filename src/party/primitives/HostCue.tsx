import clsx from 'clsx'
import { usePartyStore } from '../../store/usePartyStore'
import { useAppStore } from '../../store/useAppStore'
import { Player } from '../../components/Player'

/**
 * HostCue — « c'est l'hôte qui a la main », vu depuis le téléphone des autres.
 *
 * Deuxième famille d'états morts du produit, après « En attente des autres… » : les 14 variantes
 * de « En attente que l'hôte lance la partie… ». Le problème n'est pas la formulation, c'est le
 * cadrage — le joueur est renvoyé à un état de l'application (« ça n'a pas commencé ») au lieu
 * d'être renvoyé à la pièce (« Marie va lancer, regardez-la »).
 *
 * Ce que ça change concrètement : on NOMME l'hôte, et on montre la table. Le joueur sait vers qui
 * se tourner et voit qu'il n'est pas seul à attendre. C'est le principe fondateur appliqué au
 * moment le plus creux d'une manche.
 *
 * L'hôte, lui, ne voit jamais ce composant : il voit son bouton.
 */
export function HostCue({
  /** Ce que la personne est sur le point de faire, à la 3e personne : « ouvre la manche », « lance le dé ». */
  action,
  /** Qui a la main. Par défaut l'hôte ; sur un jeu au tour par tour, le joueur dont c'est le tour. */
  memberId,
  className,
}: {
  action: string
  memberId?: string | null
  className?: string
}) {
  const group = usePartyStore((s) => s.group)
  const onlineIds = usePartyStore((s) => s.onlinePlayerIds)
  const myId = useAppStore((s) => s.identity?.memberId) ?? null

  if (!group) return null

  const leadId = memberId ?? group.party.hostMemberId
  const lead = group.members.find((m) => m.id === leadId)
  const others = group.members.filter((m) => m.id !== leadId)

  return (
    <div className={clsx('flex flex-col items-center gap-3', className)}>
      {lead && (
        <div className="flex items-center gap-2.5">
          <Player member={lead} size="chip" showName={false} speaking host={lead.id === group.party.hostMemberId} />
          <p className="text-sm text-chalk-muted">
            <b className="text-chalk">{lead.id === myId ? 'Toi' : lead.pseudo}</b> {action}
          </p>
        </div>
      )}

      {/* La table reste visible : on attend ENSEMBLE, pas chacun dans son coin. */}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {others.map((m) => (
            <Player
              key={m.id}
              member={m}
              size="chip"
              showName={false}
              offline={onlineIds.length > 0 && !onlineIds.includes(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
