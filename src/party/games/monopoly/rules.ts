import { BOARD, GROUP_COLORS, formatMoney, isBuyable } from '../../../data/monopoly'
import type { MonoEvent, MonoState } from './types'

/** Calculs partagés par le serveur et les écrans (sans React). */

/** Propriétés d'un joueur, dans l'ordre du plateau. */
export function holdings(s: MonoState, id: string): number[] {
  return Object.entries(s.owners)
    .filter(([, owner]) => owner === id)
    .map(([k]) => Number(k))
    .sort((a, b) => a - b)
}

/** Fortune : liquide + terrains (à moitié prix s'ils sont hypothéqués) + bâtiments. */
export function netWorth(s: MonoState, id: string): number {
  const p = s.players.find((x) => x.id === id)
  if (!p || p.bankrupt) return 0
  let total = p.cash
  for (const i of holdings(s, id)) {
    const sq = BOARD[i]
    if (!isBuyable(sq)) continue
    total += s.mortgaged[i] ? sq.price / 2 : sq.price
    if (sq.kind === 'property') total += (s.houses[i] ?? 0) * sq.houseCost
  }
  return total
}

export const squareName = (i: number) => BOARD[i]?.name ?? '?'

export function squareColor(i: number): string {
  const sq = BOARD[i]
  if (sq?.kind === 'property') return GROUP_COLORS[sq.group]
  if (sq?.kind === 'station') return '#2d2a26'
  if (sq?.kind === 'utility') return '#7b8794'
  return '#555'
}

/** Phrase qui raconte un événement, pour le bandeau de la TV et le fil des téléphones. */
export function eventCaption(ev: MonoEvent, name: (id: string | null) => string): string | null {
  switch (ev.type) {
    case 'start':
      return null
    case 'roll':
      return `${name(ev.who)} fait ${ev.dice[0]} + ${ev.dice[1]}${ev.dice[0] === ev.dice[1] ? ' — double !' : ''}`
    case 'move':
      if (ev.mode === 'jump') return ev.to === 10 ? `${name(ev.who)} file en prison` : `${name(ev.who)} se rend ${squareName(ev.to)}`
      return `${name(ev.who)} ${ev.mode === 'back' ? 'recule' : 'avance'} jusqu’à ${squareName(ev.to)}`
    case 'go':
      return `${name(ev.who)} passe par la case Départ : +${formatMoney(ev.amount)}`
    case 'buy':
      return `${name(ev.who)} achète ${squareName(ev.square)} pour ${formatMoney(ev.price)}`
    case 'rent':
      return `${name(ev.who)} paie ${formatMoney(ev.amount)} de loyer à ${name(ev.to)}`
    case 'tax':
      return `${name(ev.who)} paie ${formatMoney(ev.amount)} — ${squareName(ev.square)}`
    case 'card':
      return `${name(ev.who)} tire une carte ${ev.deck === 'chance' ? 'Chance' : 'Caisse de communauté'}`
    case 'money':
      return ev.amount >= 0 ? `${name(ev.who)} reçoit ${formatMoney(ev.amount)}` : `${name(ev.who)} paie ${formatMoney(-ev.amount)}`
    case 'pot':
      return `${name(ev.who)} rafle la cagnotte du Parc gratuit : ${formatMoney(ev.amount)} !`
    case 'jail':
      return `${name(ev.who)} est en prison`
    case 'free':
      return `${name(ev.who)} sort de prison${ev.how === 'bail' ? ' en payant la caution' : ev.how === 'card' ? ' grâce à sa carte' : ev.how === 'doubles' ? ' sur un double' : ''}`
    case 'build':
      return ev.houses >= 5 ? `${name(ev.who)} construit un hôtel ${squareName(ev.square)}` : `${name(ev.who)} construit une maison ${squareName(ev.square)}`
    case 'sell':
      return `${name(ev.who)} revend une maison ${squareName(ev.square)}`
    case 'mortgage':
      return ev.on ? `${name(ev.who)} hypothèque ${squareName(ev.square)}` : `${name(ev.who)} lève l’hypothèque ${squareName(ev.square)}`
    case 'auction':
      return `${squareName(ev.square)} part aux enchères`
    case 'bid':
      return `${name(ev.who)} offre ${formatMoney(ev.amount)}`
    case 'won':
      return ev.who ? `${name(ev.who)} remporte ${squareName(ev.square)} pour ${formatMoney(ev.amount)}` : `Personne ne veut de ${squareName(ev.square)}`
    case 'trade':
      return `${name(ev.from)} et ${name(ev.to)} concluent un échange`
    case 'bankrupt':
      return `${name(ev.who)} fait faillite`
    case 'end':
      return ev.winner ? `Partie terminée — ${name(ev.winner)} l’emporte` : 'Partie terminée'
  }
}
