import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../../../store/usePartyStore'
import { useAppStore } from '../../../store/useAppStore'
import { useSound } from '../../../hooks/useSound'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { HostCue } from '../../primitives'
import { cardImage, UNO_HEX, type PlayColor } from './three/cardFaces'
import { COLOR_LABELS, PLAYABLE_COLORS, type UnoCard, type UnoClientState } from './types'
import type { Member } from '../../../types'

/**
 * La manette UNO : ta main, et ce qu'il faut pour jouer vite.
 *
 * Les cartes sont dessinées par le même code que celles de la table 3D (`cardFaces.ts`) : la carte
 * qu'on touche au téléphone est celle qu'on voit atterrir sur la TV. La main tient toujours dans
 * l'écran — les cartes se chevauchent d'autant plus qu'il y en a, puis passent sur deux rangées —
 * pour ne jamais chercher une carte en faisant défiler.
 */
export function UnoController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const myId = useAppStore((s) => s.identity?.memberId) ?? null
  const { play } = useSound()
  const lastSeq = useRef(0)
  const [wildCard, setWildCard] = useState<UnoCard | null>(null)

  const state = (group?.party.roundData ?? null) as UnoClientState | null

  useEffect(() => {
    const evt = state?.lastEvent
    if (!evt || evt.seq === lastSeq.current) return
    lastSeq.current = evt.seq
    if (evt.type === 'penalty' && evt.memberId === myId) play('lose')
    else if (evt.type === 'play' && evt.memberId !== myId) play('tick')
  }, [state?.lastEvent, play, myId])

  // Ton tour : une petite vibration, pour lever les yeux de la conversation.
  const myTurn = !!state?.myTurn
  useEffect(() => {
    if (myTurn) navigator.vibrate?.(40)
  }, [myTurn])

  if (!group || !state || !myId) return null
  const byId = (id: string | null | undefined) => group.members.find((m) => m.id === id)

  if (group.party.status === 'ended' || state.phase === 'ended') {
    return <FinalView state={state} members={group.members} myId={myId} onExit={() => navigate('/lobby')} />
  }

  if (state.phase === 'intro') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="kicker text-2xs text-center mb-1">Distribution</p>
        <h1 className="font-display text-3xl text-chalk text-center mb-6">UNO</h1>
        <HandFan hand={state.hand} playableIds={[]} active={false} onPlay={() => {}} />
        <ul className="flex flex-col gap-2 text-sm text-chalk-muted my-6 max-w-xs mx-auto">
          <li>Même couleur ou même valeur que la défausse.</li>
          <li>
            À deux cartes, appuie sur <b className="text-chalk">UNO</b> avant de poser.
          </li>
          <li>Oublié ? Les autres crient « Contre-UNO » : tu pioches 2.</li>
          <li>Après une pioche, seule la carte piochée peut être posée.</li>
        </ul>
        <div className="mt-auto">
          {isHost ? (
            <Button fullWidth onClick={() => hostAdvance()}>
              Lancer la partie
            </Button>
          ) : (
            <HostCue action="lance la partie" />
          )}
        </div>
      </div>
    )
  }

  const current = byId(state.currentPlayer?.memberId)
  const exposed = byId(state.exposed)

  const playCard = (card: UnoCard) => {
    if (card.color === 'wild') {
      setWildCard(card)
      return
    }
    play('pop')
    sendAction('play-card', { cardId: card.id })
  }

  return (
    <div className="min-h-svh flex flex-col px-4 pt-[4.5rem] pb-8 safe-top">
      {/* Le tour : qui joue, et la carte à couvrir. */}
      <div className="flex items-center gap-3 mb-4">
        <Discard state={state} />
        <div className="flex-1 min-w-0">
          {state.myTurn ? (
            <motion.p
              key="me"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display text-3xl text-spark leading-none"
            >
              À toi !
            </motion.p>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              {current && <Avatar pseudo={current.pseudo} color={current.color} size={26} photoUrl={current.photoUrl} />}
              <p className="text-base text-chalk truncate">
                <b>{current?.pseudo}</b> <span className="text-chalk-soft">joue</span>
              </p>
            </div>
          )}
          <p className="text-sm text-chalk-soft mt-1.5 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: UNO_HEX[state.currentColor] }} />
            {COLOR_LABELS[state.currentColor]}
            <span className="text-chalk-faint">·</span>
            <span className={clsx('inline-block', state.direction === -1 && '-scale-x-100')}>↻</span>
            <span className="text-chalk-faint">·</span>
            {state.deckCount} en pioche
          </p>
        </div>
      </div>

      {/* La table : nombre de cartes de chacun, dans l'ordre de jeu. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 mb-3">
        {state.order.map((pid) => {
          const m = byId(pid)
          if (!m) return null
          const count = state.handCounts[pid] ?? 0
          const isCurrent = state.currentPlayer?.memberId === pid
          const safe = state.unoSafeIds.includes(pid) && count <= 2
          return (
            <div
              key={pid}
              className={clsx(
                'flex items-center gap-1.5 rounded-chip border pl-1 pr-2.5 py-1 whitespace-nowrap shrink-0',
                isCurrent ? 'border-spark/60 bg-spark/10' : 'border-line bg-felt',
              )}
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={18} photoUrl={m.photoUrl} />
              <span className="text-xs text-chalk-muted">{pid === myId ? 'Toi' : m.pseudo}</span>
              <span
                className={clsx(
                  'text-xs font-bold tabular-nums',
                  state.exposed === pid ? 'text-blood' : safe ? 'text-brass' : 'text-chalk',
                )}
              >
                {safe ? 'UNO' : count}
              </span>
            </div>
          )
        })}
      </div>

      {/* Les deux cris du jeu : annoncer, ou attraper quelqu'un qui a oublié. */}
      <AnimatePresence>
        {state.mustCallUno && (
          <motion.button
            key="uno"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              play('vote')
              navigator.vibrate?.(60)
              sendAction('call-uno', {})
            }}
            className="mb-3 rounded-card py-4 font-display text-3xl italic text-ink shadow-raised"
            style={{ background: UNO_HEX.yellow }}
          >
            UNO !
          </motion.button>
        )}
        {state.canCatch && exposed && (
          <motion.div key="catch" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3">
            <Button fullWidth variant="danger" onClick={() => sendAction('catch-uno', { targetId: exposed.id })}>
              Contre-UNO ! {exposed.pseudo} n'a rien dit
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ta main. */}
      <div className="flex-1 flex flex-col justify-end">
        <p className="kicker text-2xs text-center mb-2">
          Ta main · {state.hand.length} carte{state.hand.length > 1 ? 's' : ''}
        </p>
        <HandFan hand={state.hand} playableIds={state.playableIds} active={state.myTurn} onPlay={playCard} />

        {state.myTurn ? (
          <div className="mt-4">
            <Button fullWidth variant={state.canPlay && !state.hasDrawn ? 'secondary' : 'primary'} onClick={() => sendAction(state.hasDrawn ? 'pass' : 'draw-card', {})}>
              {state.hasDrawn ? 'Garder et passer' : 'Piocher'}
            </Button>
            <p className="text-center text-xs text-chalk-faint mt-2">
              {state.hasDrawn ? 'La carte piochée passe : pose-la ou garde-la.' : state.canPlay ? 'Touche une carte qui brille.' : 'Rien ne passe : pioche.'}
            </p>
          </div>
        ) : (
          <div className="mt-4 flex justify-center gap-2">
            {isHost && (
              <Button variant="ghost" onClick={() => hostAdvance()} className="!min-h-0 py-2 text-sm">
                Passer {current?.pseudo ?? 'le joueur'} (absent)
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Joker : choix de la couleur, un geste. */}
      <AnimatePresence>
        {wildCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/80 flex items-end"
            onClick={() => setWildCard(null)}
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              className="w-full rounded-t-sheet bg-felt-raised border-t border-line-strong px-5 pt-5 pb-8 safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <img src={cardImage(wildCard)} alt="" className="w-12 rounded-md" />
                <p className="font-display text-xl text-chalk">Quelle couleur ?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PLAYABLE_COLORS.map((color) => (
                  <motion.button
                    key={color}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      play('pop')
                      sendAction('play-card', { cardId: wildCard.id, chosenColor: color })
                      setWildCard(null)
                    }}
                    className="rounded-card py-6 font-display text-xl text-white shadow-card"
                    style={{ background: UNO_HEX[color as PlayColor] }}
                  >
                    {COLOR_LABELS[color]}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Discard({ state }: { state: UnoClientState }) {
  const top = state.topCard
  if (!top) return null
  const tint = top.color === 'wild' ? state.currentColor : null
  return (
    <AnimatePresence mode="popLayout">
      <motion.img
        key={top.id}
        src={cardImage(top, tint)}
        alt=""
        initial={{ y: -30, rotate: -12, opacity: 0 }}
        animate={{ y: 0, rotate: -4, opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-16 shrink-0 rounded-lg shadow-raised"
        style={{ boxShadow: `0 0 0 3px ${UNO_HEX[state.currentColor]}55, 0 8px 22px rgba(0,0,0,0.5)` }}
      />
    </AnimatePresence>
  )
}

const COLOR_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 }
const VALUE_ORDER = (v: UnoCard['value']) => (typeof v === 'number' ? v : { skip: 10, reverse: 11, draw2: 12, wild: 13, wild4: 14 }[v])
const CARD_W = 88
const CARD_H = 132
const MIN_STEP = 28

/** La main, triée par couleur puis par valeur, qui tient toujours dans la largeur de l'écran. */
function HandFan({
  hand,
  playableIds,
  active,
  onPlay,
}: {
  hand: UnoCard[]
  playableIds: string[]
  active: boolean
  onPlay: (card: UnoCard) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(340)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sorted = useMemo(
    () => [...hand].sort((a, b) => COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || VALUE_ORDER(a.value) - VALUE_ORDER(b.value)),
    [hand],
  )
  // Une rangée tant que le chevauchement laisse voir l'index de chaque carte, sinon deux.
  const fitStep = (n: number) => (n <= 1 ? 0 : Math.min(CARD_W + 6, (width - CARD_W) / (n - 1)))
  const rows = fitStep(sorted.length) >= MIN_STEP ? [sorted] : [sorted.slice(0, Math.ceil(sorted.length / 2)), sorted.slice(Math.ceil(sorted.length / 2))]

  return (
    <div ref={box} className="flex flex-col gap-2">
      {rows.map((row, r) => {
        const step = fitStep(row.length)
        const total = row.length > 0 ? CARD_W + step * (row.length - 1) : 0
        return (
          <div key={r} className="relative mx-auto" style={{ width: total, height: CARD_H + 14 }}>
            <AnimatePresence>
              {row.map((card, i) => {
                const playable = active && playableIds.includes(card.id)
                return (
                  <motion.button
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: active && !playable ? 0.45 : 1, y: playable ? 0 : 14 }}
                    exit={{ opacity: 0, y: -60, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    whileTap={playable ? { scale: 0.94, y: -6 } : undefined}
                    disabled={!playable}
                    onClick={() => onPlay(card)}
                    className="absolute top-0"
                    data-testid="uno-card"
                    data-playable={playable ? 'true' : 'false'}
                    style={{ left: i * step, width: CARD_W, zIndex: i }}
                    aria-label={`${card.color} ${card.value}`}
                  >
                    <img
                      src={cardImage(card)}
                      alt=""
                      draggable={false}
                      className="w-full rounded-lg"
                      style={{
                        boxShadow: playable
                          ? '0 0 0 2px #FF3D7F, 0 0 18px rgba(255,61,127,0.55), 0 6px 14px rgba(0,0,0,0.5)'
                          : '0 6px 14px rgba(0,0,0,0.5)',
                      }}
                    />
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        )
      })}
      {hand.length === 0 && <div style={{ height: CARD_H + 14 }} />}
    </div>
  )
}

function FinalView({ state, members, myId, onExit }: { state: UnoClientState; members: Member[]; myId: string; onExit: () => void }) {
  const winner = members.find((m) => m.id === state.winner)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
        <p className="kicker text-2xs mb-3">Main vidée</p>
        {winner && (
          <div className="flex flex-col items-center gap-2">
            <Avatar pseudo={winner.pseudo} color={winner.color} size={64} photoUrl={winner.photoUrl} />
            <p className="font-display text-2xl text-chalk">{winner.id === myId ? 'Tu gagnes !' : `${winner.pseudo} gagne`}</p>
          </div>
        )}
      </motion.div>
      <div className="flex flex-col gap-2 mb-6">
        {(state.ranking ?? []).map((r, i) => {
          const m = members.find((x) => x.id === r.memberId)
          if (!m) return null
          return (
            <div
              key={m.id}
              className={clsx('flex items-center gap-3 rounded-control border px-3 py-2.5', m.id === myId ? 'bg-felt-raised border-spark/40' : 'bg-felt border-line')}
            >
              <span className="w-5 text-sm text-chalk-soft tabular-nums">{i + 1}</span>
              <Avatar pseudo={m.pseudo} color={m.color} size={28} photoUrl={m.photoUrl} />
              <span className="flex-1 text-sm text-chalk truncate">{m.pseudo}</span>
              <span className="text-sm text-chalk-soft">{r.cardsLeft === 0 ? 'Vainqueur' : `${r.cardsLeft} carte${r.cardsLeft > 1 ? 's' : ''}`}</span>
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
