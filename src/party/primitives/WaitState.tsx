import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Surface } from '../../components/Card'
import { GroupPulse, type GroupPulseProps } from '../../components/GroupPulse'

/**
 * WaitState — l'écran d'attente du téléphone, et l'application directe du principe fondateur :
 * **jamais seul dans son téléphone**.
 *
 * Ce n'est pas un spinner et ce n'est pas un message d'état : c'est la pièce, vue depuis ta main.
 * Il y avait 66 variantes de « En attente des autres… » dans le code — autant d'endroits où le
 * lien social se coupait. Ici il n'y en a plus qu'une, et elle montre le groupe.
 *
 * Structure : ce que TU viens de faire (confirmation courte, éventuellement ta création), puis
 * ce que fait LE GROUPE (GroupPulse, une seule information dominante à la fois).
 */
export function WaitState({
  title,
  children,
  className,
  ...pulse
}: {
  /** Confirmation de ton action, en ≤ 4 mots (« Vote enregistré », « Dessin rendu »). */
  title: ReactNode
  /** Optionnel : un aperçu de ce que tu viens de rendre. */
  children?: ReactNode
  className?: string
} & GroupPulseProps) {
  return (
    <Surface className={clsx('text-center', className)}>
      <p className="font-semibold text-chalk mb-3">{title}</p>
      {children && <div className="mb-3">{children}</div>}
      <GroupPulse {...pulse} />
    </Surface>
  )
}
