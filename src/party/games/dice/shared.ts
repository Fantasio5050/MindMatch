import { useEffect, useRef, useState } from 'react'
import { ROLL_ANIM_MS, type DiceClientState, type DiceRoll } from './types'
import type { Member } from '../../../types'

export const sips = (n: number) => `${n} gorgée${n > 1 ? 's' : ''}`

/** La petite phrase qui accompagne chaque résultat. */
export const FLAVOR: Record<number, string> = {
  1: 'Petite nature.',
  2: 'Ça passe tout seul.',
  3: 'Pile au milieu.',
  4: 'Ça commence à chauffer.',
  5: 'Aïe. Courage.',
  6: 'SIX ! Le verre est à toi.',
}

/**
 * Suit les lancers reçus et dit si le dernier est encore « en train de rouler » à l'écran.
 * Un lancer déjà là au montage (reconnexion) est affiché posé, sans rejouer l'animation.
 */
export function useRollAnimation(lastRoll: DiceRoll | null | undefined, duration = ROLL_ANIM_MS) {
  const n = lastRoll?.n ?? null
  const seen = useRef<number | null>(n)
  const timer = useRef<number | undefined>(undefined)
  const [rollingN, setRollingN] = useState<number | null>(null)

  // Dépend du NUMÉRO du lancer, pas de l'objet : chaque diffusion du salon recrée l'objet.
  useEffect(() => {
    if (n === null || n === seen.current) return
    seen.current = n
    setRollingN(n)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setRollingN((cur) => (cur === n ? null : cur)), duration)
  }, [n, duration])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { rolling: rollingN !== null && rollingN === n }
}

/** À qui le tour : le joueur attendu, ou le suivant encore présent s'il a quitté le groupe (même
 * règle que le serveur). */
export function currentTurn(state: DiceClientState, members: { id: string }[]): string | null {
  const n = state.order.length
  for (let k = 0; k < n; k++) {
    const id = state.order[(state.currentIndex + k) % n]
    if (members.some((m) => m.id === id)) return id
  }
  return null
}

/** Classement final : le plus assoiffé en tête. */
export function ranking(state: DiceClientState, members: Member[]): Member[] {
  return state.order
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m)
    .sort((a, b) => (state.totalSips[b.id] ?? 0) - (state.totalSips[a.id] ?? 0))
}
