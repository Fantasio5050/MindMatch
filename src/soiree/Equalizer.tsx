import { useMemo } from 'react'
import clsx from 'clsx'

/**
 * Égaliseur de la platine — SYNTHÉTIQUE, et assumé comme tel : les lecteurs YouTube et Spotify ne
 * donnent pas accès au flux audio, ces barres ne mesurent donc rien. Elles dansent quand la musique
 * joue et retombent quand elle s'arrête : un signe de vie lisible de loin, rien de plus.
 * Chaque barre a son tempo et son amplitude (dérivés de son rang, pas du hasard : pas de saut au rendu).
 */
export function Equalizer({ playing, bars = 32, className }: { playing: boolean; bars?: number; className?: string }) {
  const specs = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => ({
        duration: 0.52 + ((i * 37) % 11) / 13,
        delay: -((i * 53) % 17) / 9,
        height: 0.38 + (((i * 29) % 13) / 13) * 0.62,
      })),
    [bars],
  )
  return (
    <div className={clsx('flex items-end gap-[3px]', !playing && 'eq-paused', className)} aria-hidden>
      {specs.map((s, i) => (
        <span
          key={i}
          className="eq-bar flex-1 rounded-t-[2px] bg-gradient-to-t from-spark-dim to-spark"
          style={{ height: `${s.height * 100}%`, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s`, opacity: 0.3 + s.height * 0.35 }}
        />
      ))}
    </div>
  )
}
