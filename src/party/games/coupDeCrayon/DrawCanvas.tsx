import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

/** Pad de dessin tactile de Coup de Crayon : canvas fond blanc, palette de couleurs, deux tailles
 * de trait, gomme, annuler, tout effacer. Export en JPEG compressé (fond blanc -> léger).
 * Résolution interne fixe pour que tous les dessins aient le même format quel que soit l'écran. */

const W = 360
const H = 480
const COLORS = ['#1a1030', '#e11d48', '#f97316', '#eab308', '#16a34a', '#2563eb', '#9333ea', '#92400e']
const ERASER = '#ffffff'
const SIZES = [5, 14]
const MAX_UNDO = 12

export interface DrawCanvasHandle {
  /** Exporte le dessin en dataURL JPEG (~20-60 Ko). */
  export(): string
}

export const DrawCanvas = forwardRef<DrawCanvasHandle, { disabled?: boolean }>(function DrawCanvas({ disabled = false }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const undoStack = useRef<ImageData[]>([])
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[0])
  const [eraser, setEraser] = useState(false)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useImperativeHandle(ref, () => ({
    export() {
      return canvasRef.current?.toDataURL('image/jpeg', 0.7) ?? ''
    },
  }))

  const toCanvasCoords = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    }
  }

  const pushUndo = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    undoStack.current.push(ctx.getImageData(0, 0, W, H))
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    pushUndo()
    drawing.current = true
    const p = toCanvasCoords(e)
    last.current = p
    // Un simple tap pose un point.
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.fillStyle = eraser ? ERASER : color
    ctx.beginPath()
    ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || disabled) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = toCanvasCoords(e)
    ctx.strokeStyle = eraser ? ERASER : color
    ctx.lineWidth = eraser ? size * 2.5 : size
    ctx.beginPath()
    ctx.moveTo(last.current!.x, last.current!.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  const onPointerUp = () => {
    drawing.current = false
    last.current = null
  }

  const undo = () => {
    const ctx = canvasRef.current?.getContext('2d')
    const prev = undoStack.current.pop()
    if (ctx && prev) ctx.putImageData(prev, 0, 0)
  }

  const clearAll = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    pushUndo()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`w-full rounded-2xl border-2 border-line-strong bg-white shadow-xl ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        style={{ touchAction: 'none', aspectRatio: `${W} / ${H}` }}
      />

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex gap-1 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                setEraser(false)
              }}
              aria-label={`Couleur ${c}`}
              className={`w-7 h-7 rounded-full border-2 ${!eraser && color === c ? 'border-white scale-110' : 'border-line-strong'} transition-transform`}
              style={{ background: c }}
            />
          ))}
          <button
            onClick={() => setEraser(true)}
            aria-label="Gomme"
            className={`w-7 h-7 rounded-full border-2 bg-white text-xs ${eraser ? 'border-fuchsia-400 scale-110' : 'border-line-strong'} transition-transform`}
          >
            🧽
          </button>
        </div>
        <div className="flex gap-1 items-center shrink-0">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              aria-label={`Trait ${s}px`}
              className={`w-7 h-7 rounded-full flex items-center justify-center border ${size === s ? 'border-fuchsia-400 bg-felt-raised' : 'border-line-strong bg-felt-raised'}`}
            >
              <span className="rounded-full bg-white" style={{ width: s * 0.9, height: s * 0.9 }} />
            </button>
          ))}
          <button onClick={undo} aria-label="Annuler" className="w-7 h-7 rounded-full border border-line-strong bg-felt-raised text-xs">
            ↩️
          </button>
          <button onClick={clearAll} aria-label="Tout effacer" className="w-7 h-7 rounded-full border border-line-strong bg-felt-raised text-xs">
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
})
