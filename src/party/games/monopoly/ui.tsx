import clsx from 'clsx'
import { BOARD, TOKENS, formatMoney, isBuyable } from '../../../data/monopoly'
import { squareColor } from './rules'

/** Les pions dessinés en 2D (téléphones, bandeau de la TV) : même silhouette que le pion 3D. */
const GLYPHS: string[] = [
  // Chapeau
  'M3 18.5h18v1.6H3zM7.2 18.5V6.5c0-.8.6-1.4 1.4-1.4h6.8c.8 0 1.4.6 1.4 1.4v12zM7.2 13.5h9.6v1.6H7.2z',
  // Voiture
  'M2.5 15.5l1.2-3.6 3.6-.8 2.4-3.1h5.6l2.6 3.1 3 .7.6 3.7h-1.9a2.4 2.4 0 00-4.7 0H9.2a2.4 2.4 0 00-4.7 0zM6.8 17.6a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4zm10.4 0a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4z',
  // Bateau
  'M2.5 15h19l-3 4.5h-13zM11.3 3.5h1.2v11h-1.2zM12.9 4.5l6.4 8.8h-6.4zM10.7 6.2v7.1H5.6z',
  // Chien
  'M4 10.5h9.5l1.5-3.5 1.8-.6 1.4 1.5 2.3.6-.3 2.2-2.4.8v6.5h-1.8v-3.6H8.2V18H6.4v-4.1L4.6 12zM3 9.6l1.6.9-.6 1.5z',
  // Dé à coudre
  'M6.5 19.5h11l.6-1.6-.8-.6V9.8A5.3 5.3 0 0012 4.5a5.3 5.3 0 00-5.3 5.3v7.5l-.8.6z',
  // Fer à repasser
  'M3 17.5h16.5l1.5-4H8.5C5.5 13.5 3.6 15 3 17.5zM8 13.5c0-3 2-5 5-5h3.5v1.6H13c-2 0-3.3 1.4-3.3 3.4z',
  // Botte
  'M8 3.5h5.5v9.2l5.2 2.1c1 .4 1.8 1.4 1.8 2.6v1.6h-14l-.5-2.2c.9-.9 1.5-2.2 1.5-3.6z',
  // Brouette
  'M3 9.5h12.5l-1.6 5.2H5.1zM13.9 14.7l5.6 2.4.6 1.5M16.5 19.8a1.8 1.8 0 110-3.6 1.8 1.8 0 010 3.6zM6 14.7l-1 4.3M15.5 9.5l5.5-2.8',
]

export function TokenGlyph({ token, size = 20, className }: { token: number; size?: number; className?: string }) {
  const d = GLYPHS[((token % GLYPHS.length) + GLYPHS.length) % GLYPHS.length]
  const stroke = token % GLYPHS.length === 7
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label={TOKENS[token % TOKENS.length]}>
      <path d={d} fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : 'none'} strokeWidth={stroke ? 1.8 : 0} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Pastille de joueur : son pion dans sa couleur. */
export function TokenBadge({ token, color, size = 32, className }: { token: number; color: string; size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center justify-center rounded-full text-white shrink-0', className)} style={{ width: size, height: size, background: color, boxShadow: `0 0 0 2px rgba(255,255,255,0.18)` }}>
      <TokenGlyph token={token} size={size * 0.62} />
    </span>
  )
}

/** Titre de propriété, comme la carte du jeu : bandeau de couleur, loyers, prix des maisons. */
export function Deed({ square, className, compact }: { square: number; className?: string; compact?: boolean }) {
  const sq = BOARD[square]
  if (!sq || !isBuyable(sq)) return null
  const row = (label: string, value: string, strong = false) => (
    <div key={label} className="flex justify-between gap-3">
      <span className="text-[#5a5248]">{label}</span>
      <span className={clsx('tabular-nums', strong && 'font-bold text-[#1d1a17]')}>{value}</span>
    </div>
  )
  return (
    <div className={clsx('rounded-xl bg-[#fbf6ea] text-[#1d1a17] overflow-hidden shadow-xl border border-black/10', className)}>
      <div className="px-3 py-2 text-center" style={{ background: squareColor(square), color: sq.kind === 'property' && ['yellow', 'lightblue'].includes(sq.group) ? '#1d1a17' : '#fff' }}>
        <p className="text-[0.62em] font-bold tracking-widest opacity-80">TITRE DE PROPRIÉTÉ</p>
        <p className="font-display text-[1.15em] leading-tight uppercase">{sq.name}</p>
      </div>
      <div className={clsx('px-3 py-2 text-[0.85em] flex flex-col', compact ? 'gap-0' : 'gap-0.5')}>
        {sq.kind === 'property' && (
          <>
            {row('Loyer terrain nu', formatMoney(sq.rents[0]), true)}
            {!compact && row('Groupe complet', formatMoney(sq.rents[0] * 2))}
            {[1, 2, 3, 4].map((h) => row(`Avec ${h} maison${h > 1 ? 's' : ''}`, formatMoney(sq.rents[h])))}
            {row('Avec un hôtel', formatMoney(sq.rents[5]), true)}
            <div className="h-px bg-black/10 my-1" />
            {row('Prix d’une maison', formatMoney(sq.houseCost))}
          </>
        )}
        {sq.kind === 'station' && [1, 2, 3, 4].map((n) => row(`${n} gare${n > 1 ? 's' : ''} possédée${n > 1 ? 's' : ''}`, formatMoney(25 * 2 ** (n - 1)), n === 1))}
        {sq.kind === 'utility' && (
          <>
            {row('Une compagnie', '4 × les dés', true)}
            {row('Les deux', '10 × les dés')}
          </>
        )}
        {row('Hypothèque', formatMoney(sq.price / 2))}
        <div className="h-px bg-black/10 my-1" />
        {row('Prix', formatMoney(sq.price), true)}
      </div>
    </div>
  )
}
