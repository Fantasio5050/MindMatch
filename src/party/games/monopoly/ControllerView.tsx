import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../../../store/usePartyStore'
import { useAppStore } from '../../../store/useAppStore'
import { useSound } from '../../../hooks/useSound'
import { Button } from '../../../components/Button'
import { HostCue } from '../../primitives'
import { BAIL, BOARD, GROUP_SQUARES, formatMoney, isBuyable } from '../../../data/monopoly'
import { CssDie } from '../dice/CssDie'
import { Deed, TokenBadge } from './ui'
import { eventCaption, holdings, netWorth, squareColor, squareName } from './rules'
import type { MonoClientState, MonoOffer, MonoPlayer } from './types'
import type { Member } from '../../../types'

/**
 * La manette du Monopoly : ta fortune, l'action du moment, tes titres.
 *
 * Une seule grosse action à la fois (lancer, acheter, enchérir, lire la carte, finir le tour), et
 * tout le reste à portée de pouce : construire, hypothéquer, proposer un échange. Quand ce n'est pas
 * ton tour, tu suis la partie au fil des événements — et tu peux toujours enchérir ou négocier.
 */
export function MonopolyController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const myId = useAppStore((s) => s.identity?.memberId) ?? null
  const { play } = useSound()
  const [tab, setTab] = useState<'play' | 'titles' | 'trade'>('play')
  const state = (group?.party.roundData ?? null) as MonoClientState | null

  const me = state?.players?.find((p) => p.id === myId) ?? null
  const cur = state?.players?.[state.turn] ?? null
  const myTurn = !!me && cur?.id === me.id && group?.party.phase === 'turn'
  useEffect(() => {
    if (myTurn) navigator.vibrate?.([30, 60, 30])
  }, [myTurn, state?.step])

  if (!group || !state?.players || !myId) return null
  const act = (type: string, payload: unknown = {}) => {
    play('pop')
    sendAction(type, payload)
  }
  const byId = (id: string | null | undefined) => group.members.find((m) => m.id === id)
  const name = (id: string | null) => (id === myId ? 'Toi' : (byId(id)?.pseudo ?? '?'))
  // Les phrases du fil sont à la troisième personne : on y garde le vrai pseudo, même pour soi.
  const pseudo = (id: string | null) => byId(id)?.pseudo ?? '?'

  if (group.party.status === 'ended' || group.party.phase === 'ended') {
    return <FinalView state={state} members={group.members} myId={myId} onExit={() => navigate('/lobby')} />
  }

  if (group.party.phase === 'intro') {
    return (
      <div className="min-h-svh flex flex-col items-center px-6 pt-[4.5rem] pb-10 safe-top text-center">
        <p className="kicker text-2xs mb-2">Édition Paris</p>
        <h1 className="font-display text-3xl text-chalk mb-3">Monopoly</h1>
        {me && (
          <div className="flex items-center gap-3 mb-6">
            <TokenBadge token={me.token} color={byId(me.id)?.color ?? '#999'} size={44} />
            <p className="text-chalk-soft text-sm text-left">
              Ton pion
              <br />
              <b className="text-chalk">1 500 €</b> pour commencer
            </p>
          </div>
        )}
        <ul className="text-chalk-soft text-sm text-left max-w-xs flex flex-col gap-2 mb-8">
          <li>Lance les dés, achète ce qui te plaît, encaisse les loyers.</li>
          <li>Ce que personne n’achète part aux enchères — tout le monde peut miser.</li>
          <li>Un groupe complet ? Construis : maisons, puis hôtel.</li>
          <li>Taxes et amendes vont dans la cagnotte du Parc gratuit.</li>
        </ul>
        <div className="mt-auto w-full">
          {isHost ? (
            <Button fullWidth onClick={() => { play('start'); hostAdvance() }}>
              C'est parti
            </Button>
          ) : (
            <HostCue action="lance la partie" />
          )}
        </div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="kicker text-2xs text-center mb-2">Spectateur</p>
        <p className="text-chalk-soft text-sm text-center mb-6">La table est pleine (8 pions) : tu suis la partie.</p>
        <Feed state={state} name={pseudo} />
      </div>
    )
  }

  const color = byId(me.id)?.color ?? '#999'
  return (
    <div className="min-h-svh flex flex-col px-5 pt-[4.5rem] pb-8 safe-top">
      {/* Ta fortune. */}
      <div className="flex items-center gap-3 mb-4">
        <TokenBadge token={me.token} color={color} size={44} />
        <div className="flex-1 min-w-0">
          <motion.p key={me.cash} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-display text-2xl text-[#f5c542] tabular-nums leading-none">
            {formatMoney(me.cash)}
          </motion.p>
          <p className="text-xs text-chalk-faint truncate mt-1">
            {me.inJail ? 'En prison' : squareName(me.pos)} · {titles(holdings(state, me.id).length)}
            {me.jailCards > 0 && ' · carte « Libéré de prison »'}
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4">
        {(
          [
            ['play', 'Partie'],
            ['titles', 'Mes titres'],
            ['trade', 'Échanger'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx('flex-1 h-9 rounded-chip text-sm border', tab === k ? 'bg-felt-raised border-spark/50 text-chalk' : 'border-line text-chalk-muted')}>
            {label}
          </button>
        ))}
      </div>

      <IncomingTrade state={state} me={me} name={name} act={act} />

      {tab === 'play' && <PlayTab state={state} me={me} cur={cur} myTurn={myTurn} name={name} pseudo={pseudo} act={act} members={group.members} />}
      {tab === 'titles' && <TitlesTab state={state} me={me} myTurn={myTurn} act={act} />}
      {tab === 'trade' && <TradeTab state={state} me={me} name={name} act={act} members={group.members} onSent={() => setTab('play')} />}

      {isHost && (
        <div className="mt-auto pt-6 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => { play('pop'); hostAdvance() }}>
            Forcer ({FORCE_LABEL[state.step]})
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => act('finish')}>
            Terminer
          </Button>
        </div>
      )}
    </div>
  )
}

const FORCE_LABEL: Record<MonoClientState['step'], string> = {
  roll: 'lancer',
  jail: 'lancer',
  buy: 'enchères',
  auction: 'adjuger',
  card: 'lire',
  debt: 'faillite',
  done: 'suivant',
}

const titles = (n: number) => `${n} titre${n > 1 ? 's' : ''}`

type Act = (type: string, payload?: unknown) => void
type Name = (id: string | null) => string

/** Dés du dernier lancer : ils roulent un instant à chaque nouveau lancer. */
function LastDice({ state }: { state: MonoClientState }) {
  const last = [...state.events].reverse().find((e) => e.type === 'roll')
  const seq = last?.seq ?? 0
  const seen = useRef(seq)
  const [rolling, setRolling] = useState(false)
  useEffect(() => {
    if (seq === seen.current) return
    seen.current = seq
    setRolling(true)
    const t = window.setTimeout(() => setRolling(false), 1500)
    return () => window.clearTimeout(t)
  }, [seq])
  if (!last || last.type !== 'roll') return null
  return (
    <div className="flex justify-center gap-4 my-2">
      {last.dice.map((v, k) => (
        <CssDie key={k} value={v} rollKey={seq * 2 + k} rolling={rolling} size={58} duration={1.2} />
      ))}
    </div>
  )
}

function PlayTab({ state, me, cur, myTurn, name, pseudo, act, members }: { state: MonoClientState; me: MonoPlayer; cur: MonoPlayer | null; myTurn: boolean; name: Name; pseudo: Name; act: Act; members: Member[] }) {
  const step = state.step
  const square = BOARD[me.pos]
  const panel = 'rounded-sheet bg-felt border border-line p-4'
  return (
    <div className="flex flex-col gap-4">
      <LastDice state={state} />

      {/* Enchères : tout le monde joue. */}
      {step === 'auction' && state.auction && <AuctionPanel state={state} me={me} name={name} act={act} />}

      {myTurn && step === 'roll' && (
        <div className={clsx(panel, 'text-center')}>
          <p className="font-display text-xl text-chalk mb-1">{state.again ? 'Double ! Rejoue' : 'À toi !'}</p>
          <p className="text-xs text-chalk-faint mb-4">Les dés roulent sur la TV.</p>
          <Button fullWidth onClick={() => act('roll')}>
            Lancer les dés
          </Button>
        </div>
      )}

      {myTurn && step === 'jail' && (
        <div className={panel}>
          <p className="font-display text-xl text-chalk mb-1">En prison</p>
          <p className="text-xs text-chalk-faint mb-4">Tentative {me.jailTurns + 1} sur 3 — au troisième échec, la caution est obligatoire.</p>
          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={() => act('roll')}>
              Tenter un double
            </Button>
            <Button variant="secondary" fullWidth disabled={me.cash < BAIL} onClick={() => act('pay-bail')}>
              Payer la caution ({formatMoney(BAIL)})
            </Button>
            {me.jailCards > 0 && (
              <Button variant="secondary" fullWidth onClick={() => act('use-card')}>
                Utiliser « Libéré de prison »
              </Button>
            )}
          </div>
        </div>
      )}

      {myTurn && step === 'buy' && isBuyable(square) && (
        <div className="flex flex-col gap-3">
          <Deed square={me.pos} className="text-sm" />
          <div className="flex gap-2">
            <Button className="flex-1" disabled={me.cash < square.price} onClick={() => act('buy')}>
              Acheter {formatMoney(square.price)}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => act('decline')}>
              Enchères
            </Button>
          </div>
          {me.cash < square.price && <p className="text-xs text-blood text-center">Pas assez d’argent : la case part aux enchères.</p>}
        </div>
      )}

      {myTurn && step === 'card' && state.card && (
        <div className="rounded-sheet border-2 p-5 bg-[#fbf6ea] text-[#1d1a17]" style={{ borderColor: state.card.deck === 'chance' ? '#e8641b' : '#2b6cb0' }}>
          <p className="font-display text-lg mb-2" style={{ color: state.card.deck === 'chance' ? '#e8641b' : '#2b6cb0' }}>
            {state.card.deck === 'chance' ? 'Chance' : 'Caisse de communauté'}
          </p>
          <p className="text-base mb-4">{state.card.text}</p>
          <Button fullWidth onClick={() => act('ack')}>
            OK
          </Button>
        </div>
      )}

      {step === 'debt' && state.debt?.memberId === me.id && (
        <div className={clsx(panel, 'border-blood/50')}>
          <p className="font-display text-xl text-chalk mb-1">Tu dois {formatMoney(state.debt.amount)}</p>
          <p className="text-xs text-chalk-faint mb-4">Vends des maisons ou hypothèque dans « Mes titres », puis paie. Sinon, c’est la faillite.</p>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={me.cash < state.debt.amount} onClick={() => act('pay-debt')}>
              Payer
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => act('bankrupt')}>
              Faillite
            </Button>
          </div>
        </div>
      )}

      {myTurn && step === 'done' && (
        <div className={clsx(panel, 'text-center')}>
          <p className="text-sm text-chalk-soft mb-3">Construire, hypothéquer, échanger… puis passe la main.</p>
          <Button fullWidth onClick={() => act('end-turn')}>
            Fin du tour
          </Button>
        </div>
      )}

      {!myTurn && cur && step !== 'auction' && !(step === 'debt' && state.debt?.memberId === me.id) && (
        <HostCue action={STEP_TEXT[step]} memberId={cur.id} />
      )}

      <Feed state={state} name={pseudo} />
      <Standings state={state} members={members} />
    </div>
  )
}

const STEP_TEXT: Record<MonoClientState['step'], string> = {
  roll: 'lance les dés',
  jail: 'tente de sortir de prison',
  buy: 'hésite à acheter',
  auction: 'met aux enchères',
  card: 'lit sa carte',
  debt: 'cherche de quoi payer',
  done: 'termine son tour',
}

function AuctionPanel({ state, me, name, act }: { state: MonoClientState; me: MonoPlayer; name: Name; act: Act }) {
  const a = state.auction!
  const high = a.high?.amount ?? 0
  const passed = a.passed.includes(me.id)
  const leading = a.high?.id === me.id
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-sheet bg-felt border border-[#f5c542]/40 p-4 text-center">
        <p className="kicker text-2xs mb-1">Enchères</p>
        <p className="font-display text-2xl text-[#f5c542] tabular-nums">{a.high ? formatMoney(high) : 'Pas d’offre'}</p>
        {a.high && <p className="text-xs text-chalk-faint">{leading ? 'Tu mènes !' : `${name(a.high.id)} mène`}</p>}
        {!passed && !leading && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[10, 50, 100].map((inc) => {
              const amount = high + inc
              return (
                <Button key={inc} variant="secondary" disabled={amount > me.cash} onClick={() => act('bid', { amount })}>
                  {formatMoney(amount)}
                </Button>
              )
            })}
          </div>
        )}
        {!passed && !leading && (
          <button className="mt-3 text-sm text-chalk-muted underline" onClick={() => act('pass')}>
            Je passe
          </button>
        )}
        {passed && <p className="text-sm text-chalk-muted mt-3">Tu as passé.</p>}
      </div>
      <Deed square={a.square} className="text-sm" compact />
    </div>
  )
}

function Feed({ state, name }: { state: MonoClientState; name: Name }) {
  const lines = state.events
    .map((e) => ({ seq: e.seq, text: eventCaption(e, name) }))
    .filter((l): l is { seq: number; text: string } => !!l.text)
    .slice(-4)
    .reverse()
  if (!lines.length) return null
  return (
    <div className="flex flex-col gap-1">
      <AnimatePresence initial={false}>
        {lines.map((l, k) => (
          <motion.p key={l.seq} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1 - k * 0.22, y: 0 }} className="text-sm text-chalk-soft">
            {l.text}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Standings({ state, members }: { state: MonoClientState; members: Member[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {state.players.map((p, i) => {
        const m = members.find((x) => x.id === p.id)
        if (!m) return null
        return (
          <div key={p.id} className={clsx('flex items-center gap-2.5 rounded-control border px-3 py-2', i === state.turn ? 'border-spark/50 bg-felt-raised' : 'border-line bg-felt', p.bankrupt && 'opacity-40')}>
            <TokenBadge token={p.token} color={m.color} size={24} />
            <span className={clsx('flex-1 text-sm text-chalk truncate', p.bankrupt && 'line-through')}>{m.pseudo}</span>
            <span className="text-xs text-chalk-faint">{titles(holdings(state, p.id).length)}</span>
            <span className="text-sm text-[#f5c542] tabular-nums w-20 text-right">{formatMoney(p.cash)}</span>
          </div>
        )
      })}
    </div>
  )
}

function TitlesTab({ state, me, myTurn, act }: { state: MonoClientState; me: MonoPlayer; myTurn: boolean; act: Act }) {
  const mine = holdings(state, me.id)
  const canBuild = myTurn && (state.step === 'roll' || state.step === 'done')
  if (!mine.length) return <p className="text-sm text-chalk-muted text-center mt-6">Aucun titre pour l’instant. Achète en tombant sur une case libre !</p>
  return (
    <div className="flex flex-col gap-2">
      {mine.map((i) => {
        const sq = BOARD[i]
        if (!isBuyable(sq)) return null
        const h = state.houses[i] ?? 0
        const mortgaged = !!state.mortgaged[i]
        const group = sq.kind === 'property' ? GROUP_SQUARES[sq.group] : []
        const full = sq.kind === 'property' && group.every((g) => state.owners[g] === me.id)
        const groupHouses = group.map((g) => state.houses[g] ?? 0)
        const buildable = full && !group.some((g) => state.mortgaged[g]) && h < 5 && h <= Math.min(...groupHouses) && sq.kind === 'property' && me.cash >= sq.houseCost
        const sellable = h > 0 && h >= Math.max(...groupHouses)
        const mortgageable = !mortgaged && !groupHouses.some((x) => x > 0)
        const lift = Math.ceil((sq.price / 2) * 1.1)
        return (
          <div key={i} className={clsx('rounded-control border border-line bg-felt overflow-hidden', mortgaged && 'opacity-60')}>
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="w-2.5 h-8 rounded-full" style={{ background: squareColor(i) }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-chalk truncate">{sq.name}</p>
                <p className="text-2xs text-chalk-faint">
                  {mortgaged ? 'Hypothéqué' : h === 5 ? 'Hôtel' : h > 0 ? `${h} maison${h > 1 ? 's' : ''}` : full ? 'Groupe complet' : formatMoney(sq.price)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {sq.kind === 'property' && full && (
                <SmallButton disabled={!canBuild || !buildable} onClick={() => act('build', { square: i })}>
                  {h === 4 ? 'Hôtel' : 'Maison'} −{formatMoney(sq.houseCost)}
                </SmallButton>
              )}
              {sq.kind === 'property' && h > 0 && (
                <SmallButton disabled={!sellable} onClick={() => act('sell', { square: i })}>
                  Revendre +{formatMoney(sq.houseCost / 2)}
                </SmallButton>
              )}
              {!mortgaged && (
                <SmallButton disabled={!mortgageable} onClick={() => act('mortgage', { square: i })}>
                  Hypothéquer +{formatMoney(sq.price / 2)}
                </SmallButton>
              )}
              {mortgaged && (
                <SmallButton disabled={!canBuild || me.cash < lift} onClick={() => act('unmortgage', { square: i })}>
                  Lever −{formatMoney(lift)}
                </SmallButton>
              )}
            </div>
          </div>
        )
      })}
      <p className="text-2xs text-chalk-faint text-center mt-1">On construit à son tour, de façon équilibrée dans un groupe.</p>
    </div>
  )
}

function SmallButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className="h-8 px-2.5 rounded-chip border border-line text-xs text-chalk-soft disabled:opacity-35 active:bg-felt-raised">
      {children}
    </button>
  )
}

function tradable(state: MonoClientState, id: string): number[] {
  return holdings(state, id).filter((i) => {
    const sq = BOARD[i]
    return sq.kind !== 'property' || !GROUP_SQUARES[sq.group].some((g) => (state.houses[g] ?? 0) > 0)
  })
}

function SquareChip({ i, on, onClick }: { i: number; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={clsx('flex items-center gap-1.5 h-8 px-2.5 rounded-chip border text-xs', on ? 'border-spark bg-spark/15 text-chalk' : 'border-line text-chalk-soft')}>
      <span className="w-2 h-2 rounded-full" style={{ background: squareColor(i) }} />
      {squareName(i)}
    </button>
  )
}

function CashStepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <SmallButton disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 50))}>−50</SmallButton>
      <span className="text-sm text-[#f5c542] tabular-nums w-20 text-center">{formatMoney(value)}</span>
      <SmallButton disabled={value + 50 > max} onClick={() => onChange(Math.min(max, value + 50))}>+50</SmallButton>
    </div>
  )
}

function TradeTab({ state, me, name, act, members, onSent }: { state: MonoClientState; me: MonoPlayer; name: Name; act: Act; members: Member[]; onSent: () => void }) {
  const others = state.players.filter((p) => p.id !== me.id && !p.bankrupt)
  const [to, setTo] = useState<string | null>(others[0]?.id ?? null)
  const [give, setGive] = useState<MonoOffer>({ cash: 0, squares: [], jailCards: 0 })
  const [get, setGet] = useState<MonoOffer>({ cash: 0, squares: [], jailCards: 0 })
  const partner = state.players.find((p) => p.id === to)

  if (state.trade && state.trade.from === me.id) {
    return (
      <div className="rounded-sheet bg-felt border border-line p-4 text-center">
        <p className="text-sm text-chalk-soft mb-3">Proposition envoyée à {name(state.trade.to)}. En attente de sa réponse…</p>
        <Button variant="secondary" fullWidth onClick={() => act('cancel-trade')}>
          Annuler
        </Button>
      </div>
    )
  }
  if (state.trade) return <p className="text-sm text-chalk-muted text-center mt-6">Un échange est déjà en cours entre {name(state.trade.from)} et {name(state.trade.to)}.</p>
  if (!others.length) return null

  const toggle = (o: MonoOffer, set: (o: MonoOffer) => void, i: number) => set({ ...o, squares: o.squares.includes(i) ? o.squares.filter((x) => x !== i) : [...o.squares, i] })
  const empty = give.cash === 0 && get.cash === 0 && !give.squares.length && !get.squares.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {others.map((p) => (
          <button key={p.id} onClick={() => { setTo(p.id); setGet({ cash: 0, squares: [], jailCards: 0 }) }} className={clsx('flex items-center gap-2 h-9 px-3 rounded-chip border text-sm', to === p.id ? 'border-spark bg-felt-raised text-chalk' : 'border-line text-chalk-muted')}>
            <TokenBadge token={p.token} color={members.find((m) => m.id === p.id)?.color ?? '#999'} size={20} />
            {name(p.id)}
          </button>
        ))}
      </div>
      <div>
        <p className="kicker text-2xs mb-2">Tu donnes</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tradable(state, me.id).map((i) => (
            <SquareChip key={i} i={i} on={give.squares.includes(i)} onClick={() => toggle(give, setGive, i)} />
          ))}
        </div>
        <CashStepper value={give.cash} max={me.cash} onChange={(cash) => setGive({ ...give, cash })} />
      </div>
      {partner && (
        <div>
          <p className="kicker text-2xs mb-2">Tu reçois de {name(partner.id)}</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tradable(state, partner.id).map((i) => (
              <SquareChip key={i} i={i} on={get.squares.includes(i)} onClick={() => toggle(get, setGet, i)} />
            ))}
          </div>
          <CashStepper value={get.cash} max={partner.cash} onChange={(cash) => setGet({ ...get, cash })} />
        </div>
      )}
      <Button
        fullWidth
        disabled={!to || empty}
        onClick={() => {
          act('propose-trade', { to, give, get })
          setGive({ cash: 0, squares: [], jailCards: 0 })
          setGet({ cash: 0, squares: [], jailCards: 0 })
          onSent()
        }}
      >
        Proposer l’échange
      </Button>
    </div>
  )
}

function OfferText({ o }: { o: MonoOffer }) {
  const parts = [...o.squares.map(squareName), ...(o.cash > 0 ? [formatMoney(o.cash)] : [])]
  return <span className="text-chalk">{parts.length ? parts.join(', ') : 'rien'}</span>
}

function IncomingTrade({ state, me, name, act }: { state: MonoClientState; me: MonoPlayer; name: Name; act: Act }) {
  const t = state.trade
  if (!t || t.to !== me.id) return null
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-sheet border-2 border-spark/60 bg-felt-raised p-4 mb-4">
      <p className="font-display text-lg text-chalk mb-2">{name(t.from)} te propose un échange</p>
      <p className="text-sm text-chalk-soft">
        Tu reçois : <OfferText o={t.give} />
      </p>
      <p className="text-sm text-chalk-soft mb-4">
        Tu donnes : <OfferText o={t.get} />
      </p>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => act('accept-trade')}>
          Accepter
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => act('decline-trade')}>
          Refuser
        </Button>
      </div>
    </motion.div>
  )
}

function FinalView({ state, members, myId, onExit }: { state: MonoClientState; members: Member[]; myId: string; onExit: () => void }) {
  const ranked = [...state.players].sort((a, b) => netWorth(state, b.id) - netWorth(state, a.id))
  const winner = members.find((m) => m.id === state.winner)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
        <p className="kicker text-2xs mb-2">Partie terminée</p>
        <p className="font-display text-2xl text-chalk">{winner ? (winner.id === myId ? 'Tu gagnes !' : `${winner.pseudo} gagne`) : 'Fin de partie'}</p>
      </motion.div>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((p, i) => {
          const m = members.find((x) => x.id === p.id)
          if (!m) return null
          return (
            <div key={p.id} className={clsx('flex items-center gap-3 rounded-control border px-3 py-2.5', p.id === myId ? 'bg-felt-raised border-spark/40' : 'bg-felt border-line')}>
              <span className="w-5 text-sm text-chalk-soft tabular-nums">{i + 1}</span>
              <TokenBadge token={p.token} color={m.color} size={28} />
              <span className={clsx('flex-1 text-sm text-chalk truncate', p.bankrupt && 'line-through opacity-60')}>{m.pseudo}</span>
              <span className="text-sm text-[#f5c542] tabular-nums">{p.bankrupt ? 'Ruiné' : formatMoney(netWorth(state, p.id))}</span>
            </div>
          )
        })}
      </div>
      <Button fullWidth onClick={onExit} className="mt-auto">
        Retour au salon
      </Button>
    </div>
  )
}
