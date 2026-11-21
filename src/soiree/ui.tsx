import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../store/usePartyStore'
import { anchorPosition, formatClock, isLetterboxedThumb } from '../lib/jukebox'
import { IconMusic } from '../components/icons'

/**
 * Les briques visuelles du Mode Soirée, partagées par le téléphone, la platine et la TV.
 *
 * Une seule idée graphique : le VINYLE. La pochette du morceau devient l'étiquette d'un disque qui
 * tourne tant que la musique joue — on comprend d'un coup d'œil, même de loin, que « ça tourne ».
 */

type Size = number | string
const css = (s: Size) => (typeof s === 'number' ? `${s}px` : s)

/** Une pochette : carrée ou ronde, avec le recadrage des miniatures YouTube (bandes noires). */
export function TrackArt({
  src,
  size,
  round = false,
  className,
  dim = false,
}: {
  src: string | null | undefined
  size: Size
  round?: boolean
  className?: string
  dim?: boolean
}) {
  const s = css(size)
  return (
    <div
      className={clsx('relative shrink-0 overflow-hidden bg-felt-sunken border border-line', round ? 'rounded-full' : 'rounded-[0.6rem]', className)}
      style={{ width: s, height: s }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className={clsx('w-full h-full object-cover', dim && 'opacity-50 saturate-50')}
          style={isLetterboxedThumb(src) ? { transform: 'scale(1.34)' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-chalk-faint">
          <IconMusic size={typeof size === 'number' ? Math.max(14, Math.round(size * 0.42)) : 20} />
        </div>
      )}
    </div>
  )
}

/**
 * Le disque. La pochette en est l'étiquette ; les sillons sont un dégradé radial répété ; le reflet
 * reste FIXE pendant que le disque tourne dessous — c'est lui qui donne l'illusion du vinyle.
 * L'animation est du CSS pur (compositeur GPU), suspendue en pause et coupée si l'utilisateur a
 * demandé moins de mouvement.
 */
export function Vinyl({ cover, size, spinning, className }: { cover: string | null | undefined; size: Size; spinning: boolean; className?: string }) {
  const s = css(size)
  return (
    <div className={clsx('relative shrink-0 rounded-full', className)} style={{ width: s, height: s }}>
      <div
        className={clsx('absolute inset-0 rounded-full vinyl-spin', !spinning && 'vinyl-paused')}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 0 31%, rgba(242,239,233,0.05) 31.5% 32%, transparent 32.5%), repeating-radial-gradient(circle at 50% 50%, #0d0c11 0 2px, #17151c 2px 3.2px)',
          boxShadow: '0 28px 60px -22px rgba(0,0,0,0.95), inset 0 0 0 1px rgba(242,239,233,0.07)',
        }}
      >
        <div className="absolute rounded-full overflow-hidden bg-spark-dim" style={{ inset: '29%' }}>
          {cover ? (
            <img
              src={cover}
              alt=""
              className="w-full h-full object-cover"
              style={isLetterboxedThumb(cover) ? { transform: 'scale(1.34)' } : undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink/60">
              <IconMusic size={28} />
            </div>
          )}
        </div>
        {/* Le trou central. */}
        <div className="absolute rounded-full bg-ink border border-line" style={{ inset: '48.2%' }} />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            'conic-gradient(from 25deg, transparent 0deg, rgba(242,239,233,0.09) 28deg, transparent 62deg, transparent 180deg, rgba(242,239,233,0.06) 208deg, transparent 242deg)',
        }}
      />
    </div>
  )
}

/**
 * Le fond aux couleurs de la pochette : la pochette elle-même, très floutée et assombrie. Pas
 * d'extraction de couleur (elle demanderait des images servies avec CORS, ce que YouTube ne garantit
 * pas) — le flou fait le même travail, sans dépendance. Fondu doux à chaque changement de morceau.
 */
export function CoverBackdrop({ cover, strength = 'phone' }: { cover: string | null | undefined; strength?: 'phone' | 'stage' }) {
  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {cover && (
          <motion.img
            key={cover}
            src={cover}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: strength === 'stage' ? 0.55 : 0.42 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl saturate-150"
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/80 to-ink" />
    </div>
  )
}

/**
 * La barre de progression, extrapolée de l'ancre de lecture partagée.
 *
 * Elle s'écrit directement dans le DOM quatre fois par seconde (une transition CSS linéaire lisse
 * entre deux pas) : aucun rendu React par image, aucune boucle par frame qui chaufferait un
 * téléphone. Les minutes ne re-rendent qu'à chaque seconde qui change.
 */
export function MusicProgress({ className, tv = false, accent = 'spark' }: { className?: string; tv?: boolean; accent?: 'spark' | 'chalk' }) {
  const bar = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<[string, string]>(['0:00', '—'])

  useEffect(() => {
    let last = 0
    let lastText = ''
    const tick = () => {
      const st = usePartyStore.getState()
      const music = st.group?.music
      const dur = music?.current?.durationMs ?? null
      const pos = music?.current ? anchorPosition(music.anchor, st.serverNow(), dur) : 0
      const p = dur ? Math.max(0, Math.min(1, pos / dur)) : 0
      const el = bar.current
      if (el) {
        // Un saut (nouveau morceau, seek) ne s'anime pas : la barre irait à reculons sur tout l'écran.
        const jump = p < last - 0.005 || (dur ? (p - last) * dur > 2500 : false)
        el.style.transition = jump ? 'none' : 'transform 260ms linear'
        el.style.transform = `scaleX(${p})`
      }
      last = p
      const text = `${formatClock(pos)}|${dur ? formatClock(dur) : '—'}`
      if (text !== lastText) {
        lastText = text
        const [a, b] = text.split('|')
        setLabel([a, b])
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className={clsx('w-full', className)}>
      <div className={clsx('relative w-full overflow-hidden rounded-chip bg-chalk/10', tv ? 'h-2' : 'h-1.5')}>
        <div
          ref={bar}
          className={clsx('absolute inset-0 origin-left rounded-chip', accent === 'spark' ? 'bg-spark' : 'bg-chalk')}
          style={{ transform: 'scaleX(0)' }}
        />
      </div>
      <div className={clsx('flex justify-between mt-1.5 tabular-nums text-chalk-soft', tv ? 'text-tv-xs' : 'text-2xs')}>
        <span>{label[0]}</span>
        <span>{label[1]}</span>
      </div>
    </div>
  )
}

/** Interrupteur — même dessin que les réglages audio de l'appli. */
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  icon,
}: {
  label: string
  hint?: ReactNode
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 w-full py-2 text-left disabled:opacity-40"
    >
      {icon && <span className="mt-0.5 shrink-0 text-chalk-soft">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-chalk">{label}</span>
        {hint && <span className="block text-2xs text-chalk-faint mt-0.5 leading-snug">{hint}</span>}
      </span>
      <span className={clsx('mt-0.5 w-10 h-6 rounded-chip relative shrink-0 transition-colors', checked ? 'bg-spark' : 'bg-felt-sunken border border-line-strong')}>
        <span
          className={clsx('absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-chip bg-chalk transition-transform', checked ? 'translate-x-4' : 'translate-x-0')}
        />
      </span>
    </button>
  )
}

/** Pastille d'état : jade = vivant, sang = coupé, éteinte = en veille. */
export function StatusDot({ tone, pulse = false, className }: { tone: 'live' | 'off' | 'idle'; pulse?: boolean; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block w-2 h-2 rounded-full shrink-0',
        tone === 'live' ? 'bg-jade' : tone === 'off' ? 'bg-blood' : 'bg-chalk-faint',
        pulse && 'animate-pulse',
        className,
      )}
    />
  )
}
