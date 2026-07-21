function initials(pseudo: string): string {
  return pseudo.trim().slice(0, 2).toUpperCase()
}

/** Grossissement global des avatars : les photos de profil étaient trop petites partout, on
 * applique un facteur unique ici plutôt que de retoucher chaque `size` passé par les vues. */
const AVATAR_SCALE = 1.2

export function Avatar({
  pseudo,
  color,
  size = 40,
  photoUrl,
}: {
  pseudo: string
  color: string
  size?: number
  photoUrl?: string | null
}) {
  const s = Math.round(size * AVATAR_SCALE)
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={pseudo}
        className="rounded-full object-cover shrink-0"
        style={{ width: s, height: s, boxShadow: `0 4px 14px ${color}55` }}
      />
    )
  }

  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{
        width: s,
        height: s,
        fontSize: s * 0.38,
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
        boxShadow: `0 4px 14px ${color}55`,
      }}
    >
      {initials(pseudo)}
    </div>
  )
}
