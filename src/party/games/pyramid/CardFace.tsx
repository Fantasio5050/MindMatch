import { rankLabel, SUITS } from './types'

export function CardFace({
  rank,
  suit,
  size = 56,
  faceDown = false,
  selected = false,
}: {
  rank?: number
  suit?: number
  size?: number
  faceDown?: boolean
  selected?: boolean
}) {
  if (faceDown || rank === undefined) {
    return (
      <div
        className="rounded-lg border-2 border-line bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30 flex items-center justify-center"
        style={{ width: size, height: size * 1.4 }}
      >
        <span className="text-chalk-faint" style={{ fontSize: size * 0.35 }}>
          🧠
        </span>
      </div>
    )
  }

  const s = suit !== undefined ? SUITS[suit] : null

  return (
    <div
      className={`rounded-lg border-2 flex flex-col items-center justify-center shadow-lg bg-white ${
        selected ? 'border-fuchsia-400' : 'border-line-strong'
      }`}
      style={{ width: size, height: size * 1.4 }}
    >
      <span
        className={`font-extrabold leading-none ${s?.red ? 'text-red-600' : 'text-[#1a1030]'}`}
        style={{ fontSize: size * 0.34 }}
      >
        {rankLabel(rank)}
      </span>
      {s && (
        <span className={`leading-none ${s.red ? 'text-red-600' : 'text-[#1a1030]'}`} style={{ fontSize: size * 0.28 }}>
          {s.symbol}
        </span>
      )}
    </div>
  )
}
