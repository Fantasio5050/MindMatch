import { rankLabel } from './types'

export function CardFace({ rank, size = 56, faceDown = false }: { rank: number; size?: number; faceDown?: boolean }) {
  if (faceDown) {
    return (
      <div
        className="rounded-lg border-2 border-white/10 bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30 flex items-center justify-center"
        style={{ width: size, height: size * 1.4 }}
      >
        <span className="text-white/20 text-xl">🧠</span>
      </div>
    )
  }
  return (
    <div
      className="rounded-lg border-2 border-white/20 bg-white flex items-center justify-center shadow-lg"
      style={{ width: size, height: size * 1.4 }}
    >
      <span className="font-extrabold text-[#1a1030]" style={{ fontSize: size * 0.4 }}>
        {rankLabel(rank)}
      </span>
    </div>
  )
}
