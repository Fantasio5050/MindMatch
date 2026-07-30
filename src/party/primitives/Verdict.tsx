import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'
import { dur, ease } from '../../lib/motion'
import { useSurface } from '../surface'

/**
 * Verdict — le point final d'un moment : gagnant, perdant, éliminé, mot trouvé.
 *
 * Un seul design pour les 17 jeux. Avant, chaque jeu inventait sa propre annonce de résultat :
 * le groupe devait réapprendre à lire l'issue à chaque partie, et aucune n'avait de poids.
 *
 * Le verdict s'installe avec un **temps mort assumé** (`--dur-verdict`) : il arrive vite, puis il
 * RESTE. C'est ce silence après l'impact qui laisse la pièce réagir — une annonce qui s'enchaîne
 * trop vite tue la réaction collective.
 */
export type VerdictTone = 'win' | 'lose' | 'neutral'

const TONES: Record<VerdictTone, { text: string; halo: string }> = {
  win: { text: 'text-brass', halo: 'var(--color-brass)' },
  lose: { text: 'text-blood', halo: 'var(--color-blood)' },
  neutral: { text: 'text-chalk', halo: 'var(--color-spark)' },
}

export function Verdict({
  title,
  subtitle,
  tone = 'neutral',
  icon,
  surface,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  tone?: VerdictTone
  /** Visuel du verdict (avatar du joueur, carte, dessin…). */
  icon?: ReactNode
  /** Forçage manuel. Par défaut, la surface est celle du contexte — donc juste par construction. */
  surface?: 'tv' | 'phone'
  className?: string
}) {
  const reduced = useReducedMotion()
  const contextSurface = useSurface()
  const t = TONES[tone]
  const isTv = (surface ?? contextSurface ?? 'tv') === 'tv'

  return (
    <motion.div
      // Mouvement réduit : on garde l'apparition (l'information ne doit jamais manquer), on retire
      // seulement l'élan. La tension vient du RYTHME, pas du déplacement — elle reste intacte.
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduced ? { duration: dur.base } : { duration: dur.deal, ease: ease.impact }}
      className={clsx('relative flex flex-col items-center text-center gap-3', className)}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{ background: `radial-gradient(60% 60% at 50% 50%, ${t.halo}26 0%, transparent 70%)` }}
      />
      {icon}
      <p className={clsx('font-stage', t.text, isTv ? 'text-tv-3xl' : 'text-2xl')}>{title}</p>
      {subtitle && (
        <p className={clsx('text-chalk-muted', isTv ? 'text-tv-base' : 'text-sm')}>{subtitle}</p>
      )}
    </motion.div>
  )
}
