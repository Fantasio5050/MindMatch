import type { WheelSegment } from '../../../data/wheelSegments'
import { WHEEL_SEGMENT_DEG } from '../../../data/wheelSegments'

/** Roue 2D légère pour les téléphones : mêmes segments, même convention d'angle que la scène 3D
 * de la TV (segment 0 en haut, rotation horaire), donc même atterrissage, garanti. */

function pointAt(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: 100 + radius * Math.sin(rad), y: 100 - radius * Math.cos(rad) }
}

export function WheelSVG({ segments, angle, size = 260 }: { segments: WheelSegment[]; angle: number; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Pointeur fixe en haut */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-1 z-10"
        style={{ width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '20px solid #e879f9', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
      />
      <svg viewBox="0 0 200 200" style={{ width: size, height: size, transform: `rotate(${angle}deg)` }}>
        {segments.map((segment, i) => {
          const a1 = i * WHEEL_SEGMENT_DEG
          const a2 = (i + 1) * WHEEL_SEGMENT_DEG
          const p1 = pointAt(a1, 96)
          const p2 = pointAt(a2, 96)
          const mid = pointAt(a1 + WHEEL_SEGMENT_DEG / 2, 66)
          return (
            <g key={segment.id + i}>
              <path
                d={`M 100 100 L ${p1.x} ${p1.y} A 96 96 0 0 1 ${p2.x} ${p2.y} Z`}
                fill={segment.color}
                stroke="#0b0714"
                strokeWidth="1.5"
              />
              <text
                x={mid.x}
                y={mid.y}
                fontSize="15"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${a1 + WHEEL_SEGMENT_DEG / 2} ${mid.x} ${mid.y})`}
              >
                {segment.emoji}
              </text>
            </g>
          )
        })}
        <circle cx="100" cy="100" r="14" fill="#16121f" stroke="#e879f9" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="97.5" fill="none" stroke="#e879f9" strokeWidth="3" opacity="0.7" />
      </svg>
    </div>
  )
}
