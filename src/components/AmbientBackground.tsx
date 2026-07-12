import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface Blob {
  color: string
  size: number
  top: string
  left: string
  duration: number
  delay: number
}

const BLOBS: Blob[] = [
  { color: '#c026d3', size: 46, top: '-8%', left: '-10%', duration: 22, delay: 0 },
  { color: '#7c3aed', size: 52, top: '55%', left: '65%', duration: 26, delay: 2 },
  { color: '#f472b6', size: 36, top: '70%', left: '-5%', duration: 19, delay: 4 },
  { color: '#38bdf8', size: 34, top: '5%', left: '70%', duration: 24, delay: 1 },
]

/** Slowly drifting, blurred gradient blobs behind every page — mounted once at the app root so
 * the animation never restarts on navigation. Purely decorative: fixed, non-interactive, and
 * disabled when the user prefers reduced motion. */
export function AmbientBackground() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${b.size}vmax`,
            height: `${b.size}vmax`,
            top: b.top,
            left: b.left,
            background: `radial-gradient(circle, ${b.color}55 0%, ${b.color}00 70%)`,
            filter: 'blur(40px)',
          }}
          animate={
            reduced
              ? {}
              : {
                  x: [0, 40, -20, 0],
                  y: [0, -30, 20, 0],
                  scale: [1, 1.12, 0.95, 1],
                }
          }
          transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, transparent 40%, #0b0714 100%)' }}
      />
    </div>
  )
}
