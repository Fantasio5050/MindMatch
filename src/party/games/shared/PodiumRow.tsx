import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/** Ligne de podium animée, réutilisable par tous les classements finaux.
 *
 * Donne un vrai temps fort gagnant/perdant sans que chaque jeu ait à réécrire son podium :
 *  - révélation "suspense" de bas en haut (le/la dernier·ère apparaît d'abord, le/la gagnant·e
 *    en dernier),
 *  - gagnant·e (rang 0) : arrivée en ressort + anneau doré + halo qui pulse,
 *  - perdant·e (dernier rang) : arrivée qui tremble, légèrement estompée, avec un petit badge
 *    (🍺 pour les jeux à boire, 😅 sinon).
 *
 * Le jeu passe simplement son contenu de ligne habituel (avatar, pseudo, score) en `children`
 * et son `rank` / `total` ; le style verre + arrondi est repris à l'identique de l'existant. */
export function PodiumRow({
  rank,
  total,
  width,
  children,
  className = '',
  loserEmoji = '😅',
  step = 0.15,
}: {
  rank: number
  total: number
  width?: number
  children: ReactNode
  className?: string
  /** Badge du dernier rang. Les jeux à boire passent '🍺'. */
  loserEmoji?: string
  /** Décalage (s) entre deux lignes lors de la révélation de bas en haut. */
  step?: number
}) {
  const reduce = useReducedMotion()
  const isWinner = rank === 0
  const isLoser = total > 1 && rank === total - 1
  // Révélation de bas en haut : le dernier rang sort en premier, le podium remonte jusqu'au sommet.
  const delay = 0.1 + step * (total - 1 - rank)

  // Le gagnant part en scale 0.8 et remonte via un ressort peu amorti : le dépassement naturel
  // (~1.05) donne le "pop" sans keyframes manuelles. Le perdant tremble à l'arrivée.
  const animate = reduce
    ? { opacity: isLoser ? 0.85 : 1, y: 0, scale: 1 }
    : isWinner
      ? { opacity: 1, y: 0, scale: 1 }
      : isLoser
        ? { opacity: 0.85, y: 0, x: [0, -7, 6, -4, 3, 0] }
        : { opacity: 1, y: 0, scale: 1 }

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22, scale: isWinner ? 0.8 : 1 }}
      animate={animate}
      transition={{ delay, duration: isLoser ? 0.55 : 0.45, ...(isWinner && !reduce ? { type: 'spring', stiffness: 320, damping: 16 } : {}) }}
      className={`relative flex items-center gap-4 glass-card rounded-2xl px-8 py-4 ${
        isWinner ? 'ring-2 ring-amber-300/70' : ''
      } ${className}`}
      style={width ? { width } : undefined}
    >
      {isWinner && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          animate={{
            boxShadow: [
              '0 0 0px rgba(251,191,36,0)',
              '0 0 30px rgba(251,191,36,0.55)',
              '0 0 0px rgba(251,191,36,0)',
            ],
          }}
          transition={{ duration: 2.2, repeat: Infinity, delay: delay + 0.3, ease: 'easeInOut' }}
        />
      )}
      {children}
      {isLoser && (
        <motion.span
          aria-hidden
          className="absolute -top-3 -right-3 text-2xl drop-shadow"
          initial={reduce ? { opacity: 1 } : { scale: 0, rotate: -30 }}
          animate={reduce ? { opacity: 1 } : { scale: 1, rotate: 0 }}
          transition={{ delay: delay + 0.35, type: 'spring', stiffness: 400, damping: 14 }}
        >
          {loserEmoji}
        </motion.span>
      )}
    </motion.div>
  )
}
