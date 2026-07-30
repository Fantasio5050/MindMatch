import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'
import { dur, ease } from '../../lib/motion'
import { cueImpact, cueSuspense, type CueTone } from '../../lib/cues'
import { useSurface } from '../surface'

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
 * ## Le son fait partie du moment, il n'est pas posé à côté
 * Les jeux déclenchaient leur son de révélation au changement de phase, donc AVANT la bascule
 * visuelle qu'ils ne connaissaient pas. La primitive joue maintenant elle-même la séquence, aux
 * instants exacts où elle bouge : le calage n'est plus à maintenir, il est structurel. Et il est
 * réservé à la scène — huit téléphones qui sonnent à 40 ms d'écart font du bruit, pas du drame.
 *
 * `prefers-reduced-motion` : la SUSPENSION est conservée (c'est du rythme dramatique, pas du
 * mouvement) et seule la bascule animée devient une coupe franche. Le son, lui, ne change pas :
 * ce n'est pas du mouvement, et c'est justement ce qui porte la tension quand l'image se calme.
 */
export type MomentBeat = 'suspense' | 'reveal'

/**
 * Suit le déroulé d'un moment. Chaque changement de `revealKey` rejoue la séquence depuis la
 * suspension — c'est la clé qui décide qu'« un nouveau moment commence » (n° de manche, id de
 * l'éliminé…), pas le contenu lui-même.
 */
export function useMomentBeat(revealKey: string | number, suspenseMs?: number): MomentBeat {
  const [beat, setBeat] = useState<MomentBeat>('suspense')

  useEffect(() => {
    const ms = suspenseMs ?? dur.suspense * 1000
    setBeat('suspense')
    const t = setTimeout(() => setBeat('reveal'), ms)
    return () => clearTimeout(t)
  }, [revealKey, suspenseMs])

  return beat
}

export function Moment({
  revealKey,
  suspense,
  children,
  suspenseMs,
  tone = 'neutral',
  cue = true,
  className,
}: {
  /** Change = un nouveau moment démarre (n° de manche, id de l'éliminé…). */
  revealKey: string | number
  /** Ce qu'on montre pendant la suspension. Par défaut : trois points qui respirent. */
  suspense?: ReactNode
  /** La révélation elle-même. */
  children: ReactNode
  /** Durée de la suspension. Par défaut le token `--dur-suspense`. */
  suspenseMs?: number
  /** Couleur du moment — c'est elle qui décide de ce qu'on ENTEND à la bascule. */
  tone?: CueTone
  /** Couper la séquence sonore (moment secondaire, ou jeu qui gère déjà son propre son). */
  cue?: boolean
  className?: string
}) {
  const ms = suspenseMs ?? dur.suspense * 1000
  const reduced = useReducedMotion()
  const surface = useSurface()

  // La scène porte le son. Un moment rendu dans une main reste muet.
  const audible = cue && surface === 'tv'
  const beat = useMomentBeat(revealKey, ms)

  const cued = useRef<string | number | null>(null)
  const impacted = useRef<string | number | null>(null)
  useEffect(() => {
    if (!audible) return
    // Une clé = une séquence. Sans ce garde, un re-render pendant la suspension rejouerait la
    // montée depuis le début et on entendrait un bégaiement.
    if (cued.current === revealKey) return
    cued.current = revealKey
    cueSuspense(ms / 1000)
  }, [audible, revealKey, ms])

  return (
    <div className={clsx('relative w-full flex items-center justify-center', className)}>
      <AnimatePresence mode="wait">
        {beat === 'suspense' ? (
          <motion.div
            key={`s-${revealKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.quick }}
            className="flex items-center justify-center"
          >
            {suspense ?? <SuspenseDots reduced={!!reduced} />}
          </motion.div>
        ) : (
          <motion.div
            key={`r-${revealKey}`}
            // Repère de test : c'est l'apparition de ce nœud qui DÉFINIT la bascule visuelle. Il
            // permet de mesurer le calage son/image au lieu de l'estimer à l'oreille.
            data-moment-reveal=""
            // L'impact est joué par le nœud QUI APPARAÎT, pas par un minuteur parallèle.
            //
            // La mesure a montré pourquoi ça compte : `AnimatePresence mode="wait"` attend la
            // sortie de la suspension avant de monter la révélation. La bascule visuelle arrive
            // donc APRÈS le changement d'état, et tout son calé sur l'état tombe en avance. En le
            // déclenchant au démarrage de l'animation d'entrée, le calage devient exact quelles
            // que soient les durées choisies dans les tokens.
            onAnimationStart={() => {
              if (!audible || impacted.current === revealKey) return
              impacted.current = revealKey
              cueImpact(tone)
            }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduced ? { duration: dur.base } : { duration: dur.deal, ease: ease.impact }}
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
