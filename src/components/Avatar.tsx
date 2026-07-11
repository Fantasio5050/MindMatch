function initials(pseudo: string): string {
  return pseudo.trim().slice(0, 2).toUpperCase()
}

export function Avatar({ pseudo, color, size = 40 }: { pseudo: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
        boxShadow: `0 4px 14px ${color}55`,
      }}
    >
      {initials(pseudo)}
    </div>
  )
}
