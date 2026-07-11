import type { ReactNode, MouseEventHandler } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  fullWidth?: boolean
  className?: string
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit'
}

export function Button({ children, variant = 'primary', fullWidth, className, ...rest }: ButtonProps) {
  const styles = {
    primary:
      'bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white shadow-lg shadow-fuchsia-500/30',
    secondary: 'bg-white/10 text-white border border-white/15',
    ghost: 'bg-transparent text-white/70',
  }[variant]

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={clsx(
        'rounded-2xl px-5 py-3.5 font-semibold text-base transition-opacity disabled:opacity-40',
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
