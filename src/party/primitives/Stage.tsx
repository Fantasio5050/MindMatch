import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Stage — le gabarit imposé de l'écran TV.
 *
 * Avant, chaque jeu dessinait sa page TV librement : 10 000 lignes de vues, 17 mises en page
 * différentes, aucune familiarité d'un jeu à l'autre. Ici la scène a toujours la même anatomie,
 * ce qui produit deux effets : les joueurs savent instantanément où regarder, et ajouter un jeu
 * ne demande plus de réinventer une composition.
 *
 *   ┌──────────────────────────────┐
 *   │  kicker      (où on en est)  │
 *   │  title       (ce qui se joue)│
 *   │                              │
 *   │        FOCUS  (le sujet)     │  ← 100 % de l'attention
 *   │                              │
 *   │  rail        (le groupe)     │
 *   └──────────────────────────────┘
 *
 * La TV n'est jamais un tableau de bord : pas de scroll, pas d'interaction, tout tient dans un
 * écran et se lit à 4 mètres (échelle typographique `tv-*`, jamais celle du téléphone).
 */
export function Stage({
  kicker,
  title,
  children,
  rail,
  tone = 'neutral',
  className,
}: {
  /** Sur-titre : situe le moment (« MANCHE 2 / 6 », « ⚔️ DUEL »). */
  kicker?: ReactNode
  /** Titre de scène. Composé en display condensé. */
  title?: ReactNode
  /** Le sujet : ce que la pièce doit regarder. */
  children: ReactNode
  /** Le groupe, en bas — les joueurs restent visibles en permanence. */
  rail?: ReactNode
  /** Teinte d'ambiance de la scène (une révélation dangereuse vire au `blood`, une victoire au `brass`). */
  tone?: 'neutral' | 'spark' | 'brass' | 'blood'
  className?: string
}) {
  const glow = {
    neutral: 'transparent',
    spark: 'var(--color-spark)',
    brass: 'var(--color-brass)',
    blood: 'var(--color-blood)',
  }[tone]

  return (
    // `h-svh` et non `min-h-svh` : la scène fait EXACTEMENT un écran. Avec une hauteur minimale,
    // un contenu un peu haut poussait le rail des joueurs hors du cadre — donc le groupe
    // disparaissait de l'écran, ce qui est précisément ce que cette primitive doit empêcher.
    // Marges en unités de scène : sur un écran court, une respiration figée à 40 px devient une
    // respiration de luxe qu'on paie en chevauchements.
    <div
      className={clsx('relative h-svh w-full flex flex-col items-center overflow-hidden', className)}
      style={{
        paddingInline: 'var(--tv-gutter-x)',
        paddingTop: 'var(--tv-gutter-top)',
        paddingBottom: 'var(--tv-gutter-y)',
      }}
    >
      {/* Halo d'ambiance : c'est la scène qui prend la couleur du moment, pas les textes. */}
      {tone !== 'neutral' && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none transition-opacity"
          style={{
            transitionDuration: 'var(--dur-verdict)',
            background: `radial-gradient(70% 55% at 50% 45%, ${glow}22 0%, transparent 70%)`,
          }}
        />
      )}

      <header className="relative shrink-0 text-center">
        {kicker && <p className="kicker text-tv-xs mb-3">{kicker}</p>}
        {title && <h1 className="font-stage text-tv-xl text-chalk">{title}</h1>}
      </header>

      {/* `overflow-hidden` est un garde-fou, pas une mise en page : `min-h-0` autorise cette zone à
          descendre sous la hauteur de son contenu (sinon le rail des joueurs serait poussé hors du
          cadre), mais sans découpe le contenu débordait alors PAR-DESSUS le titre et les avatars.
          C'est exactement le défaut vu sur TV. Le dimensionnement fluide fait que ça ne devrait
          jamais découper ; si ça arrive, mieux vaut un sujet rogné qu'une scène illisible. */}
      <main
        className="relative flex-1 w-full flex flex-col items-center justify-center min-h-0 overflow-hidden"
        style={{ paddingBlock: 'var(--tv-gutter-scene)' }}
      >
        {children}
      </main>

      {rail && <footer className="relative shrink-0 w-full">{rail}</footer>}
    </div>
  )
}
