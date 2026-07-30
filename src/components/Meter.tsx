import clsx from 'clsx'

/**
 * Meter — toute progression du produit passe par ici : avancement du quiz, chrono d'un tour,
 * votes reçus, remplissage d'une file. Un seul objet visuel pour un seul concept.
 *
 * `tone="urgent"` bascule en `spark` : réservé au temps qui manque vraiment (fin de chrono).
 * On ne colore pas une progression normale — la couleur doit rester un signal.
 */
export function Meter({
  value,
  max = 1,
  tone = 'calm',
  className,
  label,
}: {
  value: number
  max?: number
  tone?: 'calm' | 'urgent' | 'brass'
  className?: string
  label?: string
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const fill = { calm: 'bg-chalk/70', urgent: 'bg-spark', brass: 'bg-brass' }[tone]

  return (
    <div
      className={clsx('h-1.5 w-full rounded-chip bg-chalk/10 overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={clsx('h-full rounded-chip transition-[width] duration-300 ease-out', fill)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
