import { useEffect, useRef } from 'react'

const COLORS = ['#f472b6', '#c084fc', '#60a5fa', '#34d399', '#fbbf24', '#fb923c']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
  life: number
}

/** Fires a canvas confetti burst whenever `trigger` changes to a non-zero value. */
export function Confetti({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!trigger) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const particles: Particle[] = Array.from({ length: 110 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * 140,
      y: height * 0.35,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 10 - 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
    }))

    const gravity = 0.35
    let raf = 0
    const tick = () => {
      ctx.clearRect(0, 0, width, height)
      let alive = false
      for (const p of particles) {
        p.vy += gravity
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.life -= 0.009
        if (p.life <= 0 || p.y > height + 40) continue
        alive = true
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (alive) {
        raf = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, width, height)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [trigger])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" style={{ width: '100vw', height: '100vh' }} />
}
