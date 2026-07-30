import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * ActionBar — la barre d'action du téléphone, ancrée en bas.
 *
 * Raison d'être : dans une soirée on tient son téléphone d'une main, souvent en marchant ou
 * debout. L'action principale doit tomber sous le pouce, pas en haut de l'écran. L'ancienne UI
 * plaçait les boutons de validation à des hauteurs différentes selon le jeu — ici c'est toujours
 * au même endroit, ce qui rend le geste automatique et permet de jouer sans lire.
 *
 * Le dégradé vers le fond évite la barre « posée » qui coupe l'écran en deux : le contenu se
 * fond dessous au lieu de s'arrêter net.
 */
export function ActionBar({
  children,
  hint,
  className,
}: {
  children: ReactNode
  /** Micro-texte au-dessus de l'action (≤ 6 mots — personne ne lit en soirée). */
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('sticky bottom-0 left-0 right-0 z-30 pt-8 pb-3 safe-bottom', className)}>
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{ background: 'linear-gradient(to top, var(--color-ink) 55%, transparent 100%)' }}
      />
      <div className="relative flex flex-col gap-2">
        {hint && <p className="text-center text-xs text-chalk-soft">{hint}</p>}
        {children}
      </div>
    </div>
  )
}
