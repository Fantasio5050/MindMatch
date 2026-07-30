import { motion } from 'framer-motion'

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-xs font-medium text-chalk-soft">
        <span>Question {Math.min(value + 1, total)} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-felt-raised overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}
