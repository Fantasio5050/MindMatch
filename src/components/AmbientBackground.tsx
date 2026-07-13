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

/** Slowly drifting gradient blobs behind every page — mounted once at the app root.
 * Perf : animation 100% CSS (compositeur GPU, zéro JS par frame — l'ancienne version framer-motion
 * réveillait le main thread en continu sur chaque page), et pas de filter:blur — le dégradé radial
 * est déjà doux, le blur de 40px sur des surfaces de 50vmax coûtait très cher sur mobile.
 * `prefers-reduced-motion` est géré par la classe .ambient-blob elle-même. */
export function AmbientBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full ambient-blob"
          style={{
            width: `${b.size}vmax`,
            height: `${b.size}vmax`,
            top: b.top,
            left: b.left,
            background: `radial-gradient(circle, ${b.color}55 0%, ${b.color}00 70%)`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, transparent 40%, #0b0714 100%)' }}
      />
    </div>
  )
}
