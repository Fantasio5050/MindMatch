import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

/**
 * Un dé en 3D CSS : six faces dans un cube `preserve-3d`, qui roule puis se pose sur `value`.
 *
 * C'est le dé des téléphones (et de l'écran TV de secours sans WebGL) : sans TV, chacun voit le
 * lancer rouler dans sa main au lieu d'un simple chiffre. Le même tirage, la même face — seule la
 * mise en scène change.
 */

/** Points allumés dans une grille 3 × 3 (index 0 à 8, ligne par ligne). */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
}

/** Orientation du cube qui amène chaque face devant (rotateX, rotateY en degrés). */
const SHOW: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
}

/** Placement de chaque face sur le cube. */
const FACES: { value: number; transform: (half: number) => string }[] = [
  { value: 1, transform: (h) => `translateZ(${h}px)` },
  { value: 6, transform: (h) => `rotateY(180deg) translateZ(${h}px)` },
  { value: 3, transform: (h) => `rotateY(90deg) translateZ(${h}px)` },
  { value: 4, transform: (h) => `rotateY(-90deg) translateZ(${h}px)` },
  { value: 2, transform: (h) => `rotateX(90deg) translateZ(${h}px)` },
  { value: 5, transform: (h) => `rotateX(-90deg) translateZ(${h}px)` },
]

function hash(n: number): number {
  let x = (n * 2654435761) >>> 0
  x ^= x >>> 15
  return (x >>> 0) / 4294967296
}

export function CssDie({
  value,
  rollKey,
  rolling,
  size = 120,
  glow,
  duration = 1.6,
}: {
  value: number
  /** Change à chaque nouveau lancer : relance l'animation. */
  rollKey: number
  /** Faux : le dé est simplement posé sur `value`. */
  rolling: boolean
  size?: number
  /** Couleur du halo une fois posé (celle du joueur). */
  glow?: string
  duration?: number
}) {
  const reduce = useReducedMotion()
  const half = size / 2
  const [fx, fy] = SHOW[value] ?? SHOW[1]
  // Tours complets en plus, variés d'un lancer à l'autre mais identiques sur tous les écrans.
  const spins = useMemo(() => {
    const a = 2 + Math.floor(hash(rollKey) * 2)
    const b = 2 + Math.floor(hash(rollKey + 7) * 2)
    return { x: fx + 360 * a, y: fy + 360 * b, z: (hash(rollKey + 3) - 0.5) * 50 }
  }, [rollKey, fx, fy])

  const animate = rolling && !reduce
  return (
    <div style={{ width: size, height: size, perspective: size * 5 }} className="relative">
      <motion.div
        key={animate ? `roll-${rollKey}` : `rest-${value}`}
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={animate ? { rotateX: 0, rotateY: 0, rotateZ: spins.z, y: -size * 0.45, scale: 0.7 } : false}
        animate={{
          rotateX: animate ? spins.x : fx,
          rotateY: animate ? spins.y : fy,
          rotateZ: 0,
          y: animate ? [-size * 0.45, 0, -size * 0.22, 0, -size * 0.06, 0] : 0,
          scale: 1,
        }}
        transition={
          animate
            ? {
                rotateX: { duration, ease: [0.12, 0.7, 0.25, 1] },
                rotateY: { duration, ease: [0.12, 0.7, 0.25, 1] },
                rotateZ: { duration: duration * 0.8, ease: 'easeOut' },
                y: { duration: duration * 0.85, times: [0, 0.3, 0.5, 0.68, 0.82, 1], ease: 'easeOut' },
                scale: { duration: duration * 0.3 },
              }
            : { duration: 0 }
        }
      >
        {FACES.map((f) => (
          <div
            key={f.value}
            className="absolute inset-0 grid grid-cols-3 grid-rows-3"
            style={{
              transform: f.transform(half),
              padding: size * 0.13,
              gap: size * 0.02,
              borderRadius: size * 0.18,
              background: 'radial-gradient(circle at 40% 35%, #fffaf0 0%, #f2ead8 55%, #d6cbb2 100%)',
              boxShadow: `inset 0 0 ${size * 0.08}px rgba(90,70,40,0.35)`,
              backfaceVisibility: 'hidden',
            }}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="flex items-center justify-center">
                {PIPS[f.value].includes(i) && (
                  <span
                    className="block rounded-full"
                    style={{
                      width: f.value === 1 ? size * 0.26 : size * 0.17,
                      height: f.value === 1 ? size * 0.26 : size * 0.17,
                      background: f.value === 1 ? 'radial-gradient(circle at 35% 30%, #ff4d5e, #a50e24)' : 'radial-gradient(circle at 35% 30%, #3a3340, #120e16)',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.7)',
                    }}
                  />
                )}
              </span>
            ))}
          </div>
        ))}
      </motion.div>
      {glow && !rolling && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-4 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.5] }}
          transition={{ duration: 1.2 }}
          style={{ background: `radial-gradient(circle, ${glow}55 0%, transparent 70%)`, zIndex: -1 }}
        />
      )}
    </div>
  )
}
