import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Avatar } from './Avatar'
import type { Member } from '../types'

/**
 * Player — le composant central du produit.
 *
 * Principe : « le groupe est le sujet, l'interface est le décor ». Un joueur n'est pas une entrée
 * de liste, c'est l'objet le plus important à l'écran. D'où 4 tailles allant du jeton discret au
 * plan de scène TV, et des ÉTATS lisibles d'un coup d'œil à 4 mètres.
 *
 * Les états sont volontairement peu nombreux et cumulables :
 *  - `speaking` : c'est son tour (halo `spark`) — l'info la plus urgente, elle domine tout.
 *  - `acted`    : a voté / a rendu (liseré `jade`) — c'est ce qui rend l'attente vivante.
 *  - `eliminated` : hors-jeu (désaturé, barré).
 *  - `offline`  : déconnecté (atténué) — factuel, jamais accusateur.
 *  - `host`     : couronne laiton.
 */
export type PlayerSize = 'chip' | 'md' | 'focus' | 'stage'

/* Les deux tailles de scène sont FLUIDES : figées en pixels, le rail des joueurs occupait à lui
 * seul plus du tiers de la hauteur d'un écran de TV court, et poussait la scène par-dessus le
 * titre. Les valeurs plafond (88 / 140) restent celles d'origine, en 1080p. */
const AVATAR_PX: Record<PlayerSize, number | string> = {
  chip: 26,
  md: 40,
  focus: 'var(--tv-avatar-focus)',
  stage: 'var(--tv-avatar-stage)',
}
const NAME_CLASS: Record<PlayerSize, string> = {
  chip: 'text-xs',
  md: 'text-sm',
  focus: 'text-tv-sm',
  stage: 'text-tv-lg font-display',
}

export interface PlayerProps {
  member: Member
  size?: PlayerSize
  speaking?: boolean
  acted?: boolean
  eliminated?: boolean
  offline?: boolean
  host?: boolean
  /** Libellé secondaire (rôle révélé, score, « dernier à répondre »…). */
  caption?: string
  captionClassName?: string
  showName?: boolean
  className?: string
}

export function Player({
  member,
  size = 'md',
  speaking = false,
  acted = false,
  eliminated = false,
  offline = false,
  host = false,
  caption,
  captionClassName,
  showName = true,
  className,
}: PlayerProps) {
  const px = AVATAR_PX[size]
  // Longueur CSS unique, que la taille soit un nombre de pixels ou une expression fluide.
  const sz = typeof px === 'number' ? `${px}px` : px
  const ring = speaking
    ? 'ring-2 ring-spark'
    : acted
      ? 'ring-2 ring-jade/70'
      : 'ring-1 ring-line'

  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 transition-opacity',
        size === 'focus' || size === 'stage' ? 'flex-col gap-3' : '',
        eliminated && 'opacity-45',
        offline && !eliminated && 'opacity-55',
        className,
      )}
    >
      <div className="relative shrink-0">
        {/* Halo de parole : le seul mouvement toléré sur un avatar, parce qu'il porte une
            information urgente (« c'est à toi »), pas une décoration. */}
        {speaking && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-chip bg-spark/25"
            animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className={clsx('relative rounded-chip', ring, eliminated && 'grayscale')}>
          <Avatar pseudo={member.pseudo} color={member.color} size={px} photoUrl={member.photoUrl} />
        </div>
        {host && (
          <span
            className="absolute -bottom-0.5 -right-0.5 rounded-chip bg-brass text-ink grid place-items-center font-bold"
            style={{
              width: `max(14px, calc(${sz} * 0.34))`,
              height: `max(14px, calc(${sz} * 0.34))`,
              fontSize: `max(8px, calc(${sz} * 0.2))`,
            }}
            aria-label="Hôte"
          >
            ★
          </span>
        )}
      </div>

      {showName && (
        <div className={clsx('min-w-0', size === 'focus' || size === 'stage' ? 'text-center' : '')}>
          <p className={clsx(NAME_CLASS[size], 'truncate', eliminated ? 'text-chalk-soft line-through' : 'text-chalk')}>
            {member.pseudo}
          </p>
          {caption && (
            <p className={clsx(size === 'stage' || size === 'focus' ? 'text-tv-xs' : 'text-2xs', 'text-chalk-soft truncate', captionClassName)}>
              {caption}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
