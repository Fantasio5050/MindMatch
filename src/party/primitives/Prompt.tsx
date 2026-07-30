import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Prompt — la grande carte qui porte « ce dont on parle » : la question, le mot à dessiner, le
 * dilemme, le gage. C'est l'objet le plus lu du produit, il doit donc être rigoureusement le même
 * partout — avant, chaque jeu avait sa propre boîte, sa propre taille, ses propres marges.
 *
 * Traité comme une **carte posée sur la table** : feutre, liseré, ombre basse. Pas de flou
 * d'arrière-plan (réservé au flottant réel), pas de dégradé.
 */
export function Prompt({
  children,
  eyebrow,
  surface = 'phone',
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  /** Petite ligne au-dessus (« Tous le même mot », « Dilemme 3 / 8 »). */
  eyebrow?: ReactNode
  /** `tv` bascule sur l'échelle typographique de la scène. */
  surface?: 'phone' | 'tv'
  tone?: 'neutral' | 'spark' | 'blood'
  className?: string
}) {
  const isTv = surface === 'tv'
  const accent = {
    neutral: 'border-line',
    spark: 'border-spark/40',
    blood: 'border-blood/50',
  }[tone]

  return (
    <div
      className={clsx(
        'bg-felt border shadow-card text-center',
        accent,
        isTv ? 'rounded-sheet px-14 py-10' : 'rounded-card px-6 py-5',
        className,
      )}
    >
      {eyebrow && <p className={clsx('kicker mb-2', isTv ? 'text-tv-xs' : 'text-2xs')}>{eyebrow}</p>}
      <p className={clsx('font-display text-chalk', isTv ? 'text-tv-2xl' : 'text-xl')}>{children}</p>
    </div>
  )
}
