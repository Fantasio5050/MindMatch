import { motion } from 'framer-motion'
import type { TraitKey } from '../types'
import { TRAIT_MAP } from '../data/traits'

export function TraitGauge({ trait, value, delay = 0 }: { trait: TraitKey; value: number; delay?: number }) {
  const meta = TRAIT_MAP[trait]
  return (
    <div className="flex items-center gap-3">
      <div className="text-xl w-7 text-center shrink-0">{meta.emoji}</div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm font-medium text-chalk-muted">{meta.label}</span>
          <span className="text-sm font-bold text-white">{value}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-felt-raised overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})` }}
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </div>
  )
}
