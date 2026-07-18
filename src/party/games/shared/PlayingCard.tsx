import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CardFace } from '../pyramid/CardFace'

/** Carte à jouer animée, réutilisable par tous les jeux de cartes (Blackjack, Pyramide, PMU,
 * Autoroute, Palmier). Réutilise le visuel de `CardFace` mais ajoute :
 *  - une entrée "distribuée" (glisse + zoom depuis le haut, décalable en cascade via `dealDelay`),
 *  - un flip 3D pour révéler une carte face cachée (`flipReveal`), comme quand le croupier
 *    retourne sa carte au Blackjack.
 * Le composant persiste tant que sa `key` est stable : les cartes déjà posées ne se rejouent pas,
 * seule une nouvelle carte (tirage) refait l'animation d'entrée. */
export function PlayingCard({
  rank,
  suit,
  size = 56,
  faceDown = false,
  selected = false,
  dealDelay = 0,
  /** true = la carte apparaît face cachée puis se retourne toute seule (révélation). */
  flipReveal = false,
}: {
  rank?: number
  suit?: number
  size?: number
  faceDown?: boolean
  selected?: boolean
  dealDelay?: number
  flipReveal?: boolean
}) {
  const [revealed, setRevealed] = useState(!flipReveal)
  useEffect(() => {
    if (!flipReveal) return
    const t = setTimeout(() => setRevealed(true), dealDelay * 1000 + 260)
    return () => clearTimeout(t)
  }, [flipReveal, dealDelay])

  const isFaceDown = flipReveal ? !revealed : faceDown
  const h = size * 1.4

  return (
    <motion.div
      style={{ width: size, height: h, perspective: 700 }}
      initial={{ opacity: 0, y: -26, scale: 0.82, rotate: -6 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={{ delay: dealDelay, type: 'spring', stiffness: 260, damping: 22 }}
    >
      <motion.div
        style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFaceDown ? 180 : 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
      >
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <CardFace rank={rank} suit={suit} size={size} selected={selected} />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <CardFace faceDown size={size} />
        </div>
      </motion.div>
    </motion.div>
  )
}
