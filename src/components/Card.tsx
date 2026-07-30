import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

/**
 * Surface — la matière de base du produit.
 *
 * Remplace le `glass-card` appliqué partout : quand TOUT flotte, plus rien ne flotte, et la
 * profondeur ne veut plus rien dire. Ici, trois niveaux explicites :
 *  - `flat`     : posé sur la table (feutre + liseré). Le cas par défaut, de très loin.
 *  - `raised`   : détaché, pour ce qui compte vraiment dans l'écran.
 *  - `floating` : au-dessus du jeu (modale, feuille). SEUL niveau qui a droit au flou d'arrière-plan
 *                 — il redevient ainsi un signal rare au lieu d'un fond d'écran.
 *
 * L'animation d'entrée est désormais **optionnelle** (`animate`). Avant, chaque carte s'animait à
 * chaque rendu : dans une pièce sombre, ça produit un frémissement permanent et ça retarde la
 * lecture de 400 ms — exactement ce qu'on ne veut pas quand quelqu'un doit agir vite.
 */
export function Surface({
  children,
  className,
  level = 'flat',
  animate = false,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  level?: 'flat' | 'raised' | 'floating'
  animate?: boolean
  delay?: number
}) {
  const levels = {
    flat: 'bg-felt border border-line shadow-card',
    raised: 'bg-felt-raised border border-line-strong shadow-raised',
    floating: 'bg-felt-raised/90 border border-line-strong shadow-float backdrop-blur-xl',
  }[level]

  const classes = clsx('rounded-card p-5', levels, className)

  if (!animate) return <div className={classes}>{children}</div>

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: [0.22, 1, 0.36, 1] }}
      className={classes}
    >
      {children}
    </motion.div>
  )
}

/**
 * Alias historique. ~100 usages dans l'app passent encore par `Card` (avec sa prop `delay`) :
 * l'alias leur applique la nouvelle matière immédiatement, sans réécriture, et les migrations
 * vers `Surface` se feront écran par écran lors des lots suivants.
 */
export function Card({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <Surface className={className} animate={delay > 0} delay={delay}>
      {children}
    </Surface>
  )
}
