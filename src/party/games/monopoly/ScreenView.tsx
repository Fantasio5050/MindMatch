import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../../../store/usePartyStore'
import { TvViewport } from '../../primitives/TvViewport'
import { BOARD, formatMoney } from '../../../data/monopoly'
import { Deed, TokenBadge } from './ui'
import { eventCaption, holdings, netWorth, squareColor, squareName } from './rules'
import type { MonoClientState, MonoEvent } from './types'
import type { BoardMember, BoardNotice, BoardPhase, MonopolyBoard } from './three/board'
import type { Member } from '../../../types'

/**
 * Monopoly sur la TV : le plateau 3D plein écran, et par-dessus un habillage façon jeu de console —
 * la fortune de chacun en haut, la phrase du moment en bas, le titre de propriété en jeu à droite.
 * Les montants suivent la scène (ils changent quand les pièces arrivent, pas avant). Sans WebGL,
 * repli sur un plateau 2D.
 */
export function MonopolyScreen() {
  const group = usePartyStore((s) => s.group)
  const [flat, setFlat] = useState(false)
  const onUnsupported = useCallback(() => setFlat(true), [])
  const state = (group?.party.roundData ?? null) as MonoClientState | null
  if (!group || !state?.players) return null
  const phase = (group.party.status === 'ended' ? 'ended' : group.party.phase) as BoardPhase
  if (flat) {
    return (
      <TvViewport>
        <FlatBoard state={state} members={group.members} phase={phase} />
      </TvViewport>
    )
  }
  return <Monopoly3D state={state} members={group.members} phase={phase} onUnsupported={onUnsupported} />
}

function Monopoly3D({ state, members, phase, onUnsupported }: { state: MonoClientState; members: Member[]; phase: BoardPhase; onUnsupported: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const board = useRef<MonopolyBoard | null>(null)
  const [ready, setReady] = useState(false)
  const [shown, setShown] = useState<MonoEvent | null>(null)
  const [busy, setBusy] = useState(false)
  const [cashShown, setCashShown] = useState<Record<string, number> | null>(null)
  const boardMembers: BoardMember[] = useMemo(() => members.map((m) => ({ id: m.id, pseudo: m.pseudo, color: m.color, photoUrl: m.photoUrl })), [members])

  useEffect(() => {
    let cancelled = false
    let instance: MonopolyBoard | null = null
    const notify = (n: BoardNotice) => {
      if (n.type === 'event') {
        setBusy(true)
        setShown(n.event)
      } else if (n.type === 'cash') setCashShown(n.cash)
      else {
        setBusy(false)
        setCashShown(null)
      }
    }
    void import('./three/board')
      .then(({ MonopolyBoard }) => MonopolyBoard.create(host.current!, notify))
      .then((b) => {
        if (cancelled) {
          b.dispose()
          return
        }
        instance = b
        board.current = b
        setReady(true)
      })
      .catch((error) => {
        console.error('Monopoly 3D indisponible, repli en 2D :', error)
        if (!cancelled) onUnsupported()
      })
    return () => {
      cancelled = true
      instance?.dispose()
      board.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || !board.current) return
    if (board.current.fatal) {
      onUnsupported()
      return
    }
    board.current.sync(state, boardMembers, phase)
  }, [ready, state, boardMembers, phase, onUnsupported])

  return (
    <div className="fixed inset-0 bg-[#07090b]">
      <div ref={host} className="absolute inset-0" />
      <Hud state={state} members={members} phase={phase} shown={shown} busy={busy} cashShown={cashShown} />
    </div>
  )
}

function Hud({ state, members, phase, shown, busy, cashShown }: { state: MonoClientState; members: Member[]; phase: BoardPhase; shown: MonoEvent | null; busy: boolean; cashShown: Record<string, number> | null }) {
  const byId = (id: string | null | undefined) => members.find((m) => m.id === id)
  const name = (id: string | null) => byId(id)?.pseudo ?? '?'
  // Pendant que la scène rejoue, les fortunes affichées sont celles qu'elle a déjà montrées.
  const cash = (id: string) => cashShown?.[id] ?? state.players.find((p) => p.id === id)?.cash ?? 0
  const cur = state.players[state.turn]
  const caption = shown ? eventCaption(shown, name) : null
  const ranked = [...state.players].sort((a, b) => netWorth(state, b.id) - netWorth(state, a.id))

  return (
    <div className="pointer-events-none absolute inset-0" style={{ padding: 'var(--tv-gutter-y) var(--tv-gutter-x)', paddingTop: 'var(--tv-gutter-top)' }}>
      {/* Bandeau des joueurs : pion, nom, fortune (en fin de partie, le classement le remplace). */}
      {phase === 'turn' && (
        <div className="absolute flex flex-col gap-2.5" style={{ left: 'var(--tv-gutter-x)', top: 'var(--tv-gutter-top)', width: 'calc(30 * var(--tv-unit))' }}>
          {state.players.map((p) => {
            const m = byId(p.id)
            if (!m) return null
            const current = phase === 'turn' && cur?.id === p.id
            return (
              <motion.div
                key={p.id}
                layout
                className={clsx(
                  'flex items-center gap-3 rounded-sheet border px-4 py-2 backdrop-blur-sm',
                  current ? 'bg-ink/85 border-spark' : 'bg-ink/65 border-line',
                  p.bankrupt && 'opacity-40',
                )}
                style={current ? { boxShadow: `0 0 calc(2.5 * var(--tv-unit)) ${m.color}66` } : undefined}
              >
                <TokenBadge token={p.token} color={m.color} size={38} />
                <div className="leading-none">
                  <p className={clsx('text-tv-sm text-chalk font-semibold', p.bankrupt && 'line-through')}>{m.pseudo}</p>
                  <motion.p key={cash(p.id)} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="font-stage text-tv-base tabular-nums mt-1" style={{ color: '#f5c542' }}>
                    {formatMoney(cash(p.id))}
                  </motion.p>
                </div>
                {p.inJail && <span className="text-tv-xs rounded-chip bg-blood/30 text-blood px-2 py-0.5">Prison</span>}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* La phrase du moment. */}
      <AnimatePresence mode="wait">
        {phase === 'turn' && caption && (
          <motion.div
            key={shown?.seq}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-1/2 -translate-x-1/2 rounded-sheet bg-ink/80 border border-line px-6 py-3 backdrop-blur-sm"
            style={{ bottom: 'var(--tv-gutter-y)' }}
          >
            <p className="text-tv-lg text-chalk whitespace-nowrap">{caption}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contexte : propriété en jeu, enchère, dette, échange, prochain coup. */}
      {phase === 'turn' && !busy && cur && (
        <div className="absolute flex flex-col items-end gap-3" style={{ right: 'var(--tv-gutter-x)', top: 'var(--tv-gutter-top)', width: 'calc(34 * var(--tv-unit))' }}>
          <ContextPanel state={state} name={name} />
        </div>
      )}

      {phase === 'intro' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute rounded-sheet bg-ink/80 border border-line px-7 py-5 backdrop-blur-sm"
          style={{ left: 'var(--tv-gutter-x)', top: 'var(--tv-gutter-top)', maxWidth: '34%' }}
        >
          <p className="font-stage text-tv-2xl text-chalk mb-2">Monopoly</p>
          <ul className="text-tv-sm text-chalk-muted flex flex-col gap-1.5">
            <li>Chacun 1 500 €. Lance les dés depuis ton téléphone.</li>
            <li>Achète ce que tu veux ; ce que tu refuses part aux enchères.</li>
            <li>Groupe complet ? Construis maisons et hôtels.</li>
            <li>Taxes et amendes nourrissent la cagnotte du Parc gratuit.</li>
            <li>Le dernier non ruiné gagne — ou le plus riche quand l’hôte arrête.</li>
          </ul>
          <p className="kicker text-tv-xs mt-3">L'hôte lance la partie</p>
        </motion.div>
      )}

      {phase === 'ended' && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.5 }}
          className="absolute rounded-sheet bg-ink/85 border border-line px-7 py-5 backdrop-blur-sm"
          style={{ left: 'var(--tv-gutter-x)', bottom: 'var(--tv-gutter-y)', minWidth: '26%' }}
        >
          <p className="kicker text-tv-xs mb-1">Fortune finale</p>
          <p className="font-stage text-tv-2xl text-brass mb-4">{name(state.winner)}</p>
          <div className="flex flex-col gap-2">
            {ranked.map((p, i) => {
              const m = byId(p.id)
              if (!m) return null
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-tv-sm text-chalk-faint w-6">{i + 1}</span>
                  <TokenBadge token={p.token} color={m.color} size={26} />
                  <span className={clsx('text-tv-sm text-chalk flex-1 truncate', p.bankrupt && 'line-through opacity-50')}>{m.pseudo}</span>
                  <span className="text-tv-sm tabular-nums" style={{ color: '#f5c542' }}>
                    {p.bankrupt ? 'Ruiné' : formatMoney(netWorth(state, p.id))}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}

function ContextPanel({ state, name }: { state: MonoClientState; name: (id: string | null) => string }) {
  const cur = state.players[state.turn]
  const panel = 'rounded-sheet bg-ink/80 border border-line px-5 py-3 backdrop-blur-sm text-right'
  return (
    <>
      {state.step === 'buy' && (
        <>
          <div className={panel}>
            <p className="kicker text-tv-xs">À vendre</p>
            <p className="text-tv-base text-chalk">{name(cur.id)} réfléchit…</p>
          </div>
          <Deed square={cur.pos} className="text-tv-sm w-full" compact />
        </>
      )}
      {state.step === 'auction' && state.auction && (
        <>
          <div className={panel}>
            <p className="kicker text-tv-xs">Enchères — sur vos téléphones</p>
            <p className="font-stage text-tv-xl" style={{ color: '#f5c542' }}>
              {state.auction.high ? formatMoney(state.auction.high.amount) : 'Pas d’offre'}
            </p>
            {state.auction.high && <p className="text-tv-sm text-chalk-muted">{name(state.auction.high.id)} mène</p>}
          </div>
          <Deed square={state.auction.square} className="text-tv-sm w-full" compact />
        </>
      )}
      {state.step === 'debt' && state.debt && (
        <div className={panel} style={{ borderColor: 'rgba(255,93,93,0.6)' }}>
          <p className="kicker text-tv-xs">Dette</p>
          <p className="text-tv-base text-chalk">
            {name(state.debt.memberId)} doit {formatMoney(state.debt.amount)}
          </p>
          <p className="text-tv-xs text-chalk-muted">Vendre, hypothéquer… ou faire faillite</p>
        </div>
      )}
      {state.step === 'card' && state.card && (
        <div className={panel}>
          <p className="kicker text-tv-xs">{state.card.deck === 'chance' ? 'Chance' : 'Caisse de communauté'}</p>
          <p className="text-tv-sm text-chalk">{name(cur.id)} lit sa carte…</p>
        </div>
      )}
      {(state.step === 'roll' || state.step === 'jail') && (
        <div className={panel}>
          <p className="kicker text-tv-xs">{state.step === 'jail' ? 'En prison' : state.again ? 'Double : on rejoue' : 'À jouer'}</p>
          <p className="text-tv-base text-chalk">{name(cur.id)} lance les dés</p>
        </div>
      )}
      {state.trade && (
        <div className={panel}>
          <p className="kicker text-tv-xs">Échange proposé</p>
          <p className="text-tv-sm text-chalk">
            {name(state.trade.from)} → {name(state.trade.to)}
          </p>
        </div>
      )}
      {state.pot > 0 && (
        <div className={panel}>
          <p className="kicker text-tv-xs">Cagnotte du Parc gratuit</p>
          <p className="font-stage text-tv-lg" style={{ color: '#3ddc97' }}>
            {formatMoney(state.pot)}
          </p>
        </div>
      )}
    </>
  )
}

/** Plateau 2D de secours : les 40 cases en couronne, les pions dessus, l'essentiel au centre. */
function FlatBoard({ state, members, phase }: { state: MonoClientState; members: Member[]; phase: BoardPhase }) {
  const byId = (id: string | null | undefined) => members.find((m) => m.id === id)
  const name = (id: string | null) => byId(id)?.pseudo ?? '?'
  const last = [...state.events].reverse().find((e) => eventCaption(e, name))
  const cellPos = (i: number) => {
    const side = Math.floor(i / 10)
    const k = i % 10
    if (side === 0) return { col: 11 - k, row: 11 }
    if (side === 1) return { col: 1, row: 11 - k }
    if (side === 2) return { col: 1 + k, row: 1 }
    return { col: 11, row: 1 + k }
  }
  return (
    <div className="tv-frame !justify-start !pt-6">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(11, 52px)', gridTemplateRows: 'repeat(11, 52px)' }}>
        {BOARD.map((sq, i) => {
          const { col, row } = cellPos(i)
          const owner = byId(state.owners[i])
          const here = state.players.filter((p) => p.pos === i && !p.bankrupt)
          return (
            <div key={i} className="relative rounded bg-[#f4eddb] text-[#1d1a17] overflow-hidden" style={{ gridColumn: col, gridRow: row }}>
              <div className="h-1.5" style={{ background: sq.kind === 'property' ? squareColor(i) : 'transparent' }} />
              <p className="text-[7px] leading-tight font-bold px-0.5 line-clamp-2">{squareName(i)}</p>
              {owner && <div className="absolute bottom-0 inset-x-0 h-1" style={{ background: owner.color }} />}
              <div className="absolute bottom-1 inset-x-0 flex flex-wrap justify-center gap-px">
                {here.map((p) => (
                  <TokenBadge key={p.id} token={p.token} color={byId(p.id)?.color ?? '#999'} size={16} />
                ))}
              </div>
            </div>
          )
        })}
        <div className="flex flex-col items-center justify-center text-center gap-2 px-6" style={{ gridColumn: '2 / 11', gridRow: '2 / 11' }}>
          <p className="font-stage text-4xl text-chalk">Monopoly</p>
          {state.dice && <p className="text-2xl text-chalk">🎲 {state.dice[0]} + {state.dice[1]}</p>}
          {last && <p className="text-lg text-chalk-muted">{eventCaption(last, name)}</p>}
          {phase === 'ended' && <p className="text-2xl text-brass">{name(state.winner)} l’emporte</p>}
          <div className="flex flex-wrap justify-center gap-3 mt-3">
            {state.players.map((p) => (
              <div key={p.id} className={clsx('flex items-center gap-2 rounded-full bg-white/5 px-3 py-1', p.bankrupt && 'opacity-40')}>
                <TokenBadge token={p.token} color={byId(p.id)?.color ?? '#999'} size={22} />
                <span className="text-base text-chalk">{name(p.id)}</span>
                <span className="text-base tabular-nums text-[#f5c542]">{formatMoney(p.cash)}</span>
                <span className="text-xs text-chalk-faint">{holdings(state, p.id).length} titre{holdings(state, p.id).length > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
