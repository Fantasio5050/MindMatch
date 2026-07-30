import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Badge — une seule forme, un seul poids, 5 tons.
 *
 * L'ancienne UI empilait des pastilles de tailles, rayons et opacités différents selon l'écran
 * (18+, 📺 TV, NOUVEAU, hôte…). Un badge n'est pas une décoration : c'est une méta-information,
 * il doit donc être discret et rigoureusement identique partout, sinon il vole l'attention aux
 * objets qui comptent.
 */
export type BadgeTone = 'neutral' | 'spark' | 'brass' | 'blood' | 'jade'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-chalk/8 text-chalk-muted border-line',
  spark: 'bg-spark/15 text-spark border-spark/35',
  brass: 'bg-brass/15 text-brass border-brass/35',
  blood: 'bg-blood/18 text-chalk border-blood/45',
  jade: 'bg-jade/15 text-jade border-jade/35',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-chip border px-2 py-0.5 text-2xs font-semibold tracking-wide whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
