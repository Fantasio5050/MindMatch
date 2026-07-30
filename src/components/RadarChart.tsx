import { motion } from 'framer-motion'
import { TRAITS } from '../data/traits'
import type { TraitScores } from '../types'

interface Series {
  label: string
  color: string
  scores: TraitScores
}

export function RadarChart({ series, size = 280 }: { series: Series[]; size?: number }) {
  const center = size / 2
  const radius = size / 2 - 44
  const angleStep = (Math.PI * 2) / TRAITS.length

  const pointFor = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * angleStep
    const r = (value / 100) * radius
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }
  }

  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible">
        {gridLevels.map((level) => {
          const pts = TRAITS.map((_, i) => pointFor(i, level * 100))
          return (
            <polygon
              key={level}
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          )
        })}
        {TRAITS.map((_, i) => {
          const p = pointFor(i, 100)
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          )
        })}
        {series.map((s, si) => {
          const pts = TRAITS.map((t, i) => pointFor(i, s.scores[t.key]))
          const path = pts.map((p) => `${p.x},${p.y}`).join(' ')
          return (
            <motion.polygon
              key={s.label + si}
              points={path}
              fill={s.color}
              fillOpacity={0.22}
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: si * 0.1, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: `${center}px ${center}px` }}
            />
          )
        })}
        {TRAITS.map((t, i) => {
          const p = pointFor(i, 116)
          return (
            <text
              key={t.key}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={16}
            >
              {t.emoji}
            </text>
          )
        })}
      </svg>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-3 justify-center mt-3">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-chalk-muted">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
