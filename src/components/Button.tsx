import type { ReactNode, MouseEventHandler } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

/**
 * Bouton — design system « Le Cercle électrique ».
 *
 * 4 rôles, et rien d'autre :
 *  - `primary`   : l'action du moment. Couleur `spark`, une seule par écran.
 *  - `danger`    : destructif ou 18+ (`blood`).
 *  - `secondary` : action possible mais pas prioritaire (feutre + liseré).
 *  - `ghost`     : sortie de secours, sans poids visuel.
 *
 * Hauteur minimale 52 px : on joue dans le noir, à une main, parfois éméché — la cible tactile
 * prime sur la compacité. Le rayon vient du token `control`, partagé avec les champs de saisie.
 */
interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  fullWidth?: boolean
  className?: string
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit'
  'aria-label'?: string
}

export function Button({ children, variant = 'primary', fullWidth, className, ...rest }: ButtonProps) {
  const styles = {
    // Aplat franc plutôt qu'un dégradé : le dégradé fuchsia→violet était le marqueur le plus
    // générique de l'ancienne UI. Une couleur pleine et assumée porte bien davantage.
    primary: 'bg-spark text-ink font-bold shadow-spark',
    danger: 'bg-blood text-chalk font-bold',
    secondary: 'bg-felt-raised text-chalk font-semibold border border-line-strong',
    ghost: 'bg-transparent text-chalk-soft font-semibold',
  }[variant]

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={clsx(
        'rounded-control px-5 min-h-[52px] text-base transition-colors disabled:opacity-40 disabled:pointer-events-none',
        fullWidth && 'w-full',
        styles,
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
