import type { PmuClientState } from './types'

/**
 * Le décompte réel d'une course, dérivé de l'état serveur.
 *
 * ## Le défaut corrigé
 * L'écran des résultats annonçait « distribue 4 gorgées » / « boit 2 gorgées » d'après le verdict
 * initial, et ne bougeait plus. Or la distribution vient APRÈS : les gagnants désignent leurs
 * victimes une par une depuis leur téléphone. La pièce ne voyait donc jamais qui donnait à qui, ni
 * ce que chacun buvait vraiment — c'est-à-dire précisément l'information autour de laquelle le jeu
 * est construit.
 *
 * Deuxième erreur, plus discrète : un perdant affichait uniquement la mise qu'il avait perdue. Les
 * gorgées REÇUES d'un gagnant n'apparaissaient nulle part. Le total montré était donc faux même
 * une fois la distribution terminée.
 *
 * Ces fonctions sont partagées par la TV et le téléphone : les deux surfaces ne peuvent plus
 * diverger sur un chiffre que les gens vont réellement boire.
 */

/** Ce qu'un joueur a reçu pendant CETTE course, et de qui. */
export function receivedBy(state: PmuClientState, memberId: string): Record<string, number> {
  const from: Record<string, number> = {}
  for (const [giverId, entry] of Object.entries(state.raceResults)) {
    const n = entry.given[memberId] ?? 0
    if (n > 0) from[giverId] = n
  }
  return from
}

export interface PmuTally {
  /** Gorgées dues au titre de son propre pari perdu. */
  owed: number
  /** Gorgées reçues des gagnants pendant cette course. */
  received: number
  /** Ce que le joueur boit réellement — la seule valeur à afficher en gros. */
  total: number
  /** Gorgées à distribuer, s'il a gagné. */
  toGive: number
  /** Gorgées qu'il lui reste à distribuer. */
  remaining: number
  won: boolean
  /** A participé à la course (a parié). Un non-parieur peut quand même recevoir des gorgées. */
  raced: boolean
}

export function tallyFor(state: PmuClientState, memberId: string): PmuTally {
  const r = state.raceResults[memberId]
  const received = Object.values(receivedBy(state, memberId)).reduce((a, b) => a + b, 0)
  const owed = r && !r.won ? r.sipsToDrink : 0
  return {
    owed,
    received,
    total: owed + received,
    toGive: r?.sipsToGive ?? 0,
    remaining: r?.remaining ?? 0,
    won: !!r?.won,
    raced: !!r,
  }
}

/** Les gagnants qui n'ont pas fini de distribuer — c'est vers eux que la pièce doit se tourner. */
export function pendingGivers(state: PmuClientState): string[] {
  return Object.entries(state.raceResults)
    .filter(([, r]) => r.remaining > 0)
    .map(([id]) => id)
}

/** Vrai quand plus une seule gorgée n'attend d'être attribuée. */
export function allDistributed(state: PmuClientState): boolean {
  return pendingGivers(state).length === 0
}

/**
 * Qui doit apparaître à l'écran des résultats.
 *
 * Pas seulement les parieurs : quelqu'un qui n'a pas misé peut très bien se voir offrir des
 * gorgées par un gagnant. L'oublier reviendrait à faire boire un joueur sans que la pièce le voie.
 */
export function involvedIds(state: PmuClientState, memberIds: string[]): string[] {
  return memberIds.filter((id) => state.raceResults[id] || tallyFor(state, id).received > 0)
}
