import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'

/**
 * Moment — l'orchestrateur de révélation. La primitive la plus importante du produit.
 *
 * Constat de l'audit : les révélations APPARAISSAIENT au lieu de se construire. Un vote se
 * résolvait instantanément, et le moment le plus important d'une partie (« qui est l'intrus ? »)
 * avait exactement le même poids visuel qu'un écran d'attente. Or c'est précisément ce moment-là
 * que les gens racontent le lendemain.
 *
 * Trois temps, toujours les mêmes :
 *
 *   1. SUSPENSION — on sait que ça arrive, on ne sait pas encore quoi. La pièce se tait.
 *   2. BASCULE    — l'information tombe, avec de l'impact.
 *   3. VERDICT    — et surtout : ça RESTE. Le silence après l'impact laisse le groupe réagir.
 *
 * Le temps mort n'est pas une perte de rythme, c'est le produit. Une révélation qui s'enchaîne
 * trop vite tue la réaction collective — c'est le réflexe d'interface qu'on corrige ici.
 *
 * `prefers-reduced-motion` : la SUSPENSION est conservée (c'est du rythme dramatique, pas du
 * mouvement) et seule la bascule animée devient une coupe franche. On ne supprime jamais la
 * tension, on change sa forme.
 */
export type MomentBeat = 'suspense' | 'reveal'

/** Suspension par défaut, alignée sur le token `--dur-suspense`. */
const DEFAULT_SUSPENSE_MS = 600

/**
 * Suit le déroulé d'un moment. Chaque changement de `revealKey` rejoue la séquence depuis la
 * suspension — c'est la clé qui décide qu'« un nouveau moment commence » (n° de manche, id de
 * l'éliminé…), pas le contenu lui-même.
 */
export function useMomentBeat(revealKey: string | number, suspenseMs = DEFAULT_SUSPENSE_MS): MomentBeat {
  const [beat, setBeat] = useState<MomentBeat>('suspense')
  const key = useRef(revealKey)

  useEffect(() => {
    key.current = revealKey
    setBeat('suspense')
    const t = setTimeout(() => setBeat('reveal'), suspenseMs)
    return () => clearTimeout(t)
  }, [revealKey, suspenseMs])

  return beat
}

export function Moment({
  revealKey,
  suspense,
  children,
  suspenseMs = DEFAULT_SUSPENSE_MS,
  className,
}: {
  /** Change = un nouveau moment démarre (n° de manche, id de l'éliminé…). */
  revealKey: string | number
  /** Ce qu'on montre pendant la suspension. Par défaut : trois points qui respirent. */
  suspense?: ReactNode
  /** La révélation elle-même. */
  children: ReactNode
  suspenseMs?: number
  className?: string
}) {
  const beat = useMomentBeat(revealKey, suspenseMs)
  const reduced = useReducedMotion()

  return (
    <div className={clsx('relative w-full flex items-center justify-center', className)}>
      <AnimatePresence mode="wait">
        {beat === 'suspense' ? (
          <motion.div
            key={`s-${revealKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-center"
          >
            {suspense ?? <SuspenseDots reduced={!!reduced} />}
          </motion.div>
        ) : (
          <motion.div
            key={`r-${revealKey}`}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduced ? { duration: 0.16 } : { duration: 0.46, ease: [0.16, 1.02, 0.3, 1] }}
            className="w-full flex items-center justify-center"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Attente dramatique par défaut : trois points qui respirent. Volontairement muet — c'est le
 * vide qui crée l'attente, pas un libellé du genre « révélation en cours… ». */
function SuspenseDots({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-3 h-3 rounded-chip bg-chalk-faint"
          animate={reduced ? undefined : { opacity: [0.25, 1, 0.25] }}
          transition={reduced ? undefined : { duration: 1.1, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}
