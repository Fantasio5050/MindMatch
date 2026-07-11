import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx('glass-card rounded-3xl p-5 shadow-xl shadow-black/20', className)}
    >
      {children}
    </motion.div>
  )
}
