import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../../../store/usePartyStore'
import { useAppStore } from '../../../store/useAppStore'
import { useSound } from '../../../hooks/useSound'
import { Button } from '../../../components/Button'
import { Player } from '../../../components/Player'
import { HostCue } from '../../primitives'
import { CssDie } from './CssDie'
import { FLAVOR, sips, useRollAnimation } from './shared'
import type { DiceClientState } from './types'
import type { Member } from '../../../types'

/**
 * La manette du Lancer de dés.
 *
 * À ton tour, un gros dé à saisir : on appuie pour le secouer (il tremble, le téléphone vibre), on
 * relâche pour lancer. Le tirage est fait par le serveur ; ici on le regarde rouler en 3D CSS — sur
 * tous les téléphones, pour qu'une soirée sans TV ait aussi son moment de suspense.
 */
export function DiceController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const myId = useAppStore((s) => s.identity?.memberId) ?? null
  const { play } = useSound()
  const state = (group?.party.roundData ?? null) as DiceClientState | null
  const { rolling } = useRollAnimation(state?.lastRoll)

  const currentId = state ? (state.order[state.currentIndex] ?? null) : null
  const myTurn = !!state && group?.party.phase === 'turn' && currentId === myId && !rolling
  // Ton tour : une petite vibration, pour lever les yeux de la conversation.
  useEffect(() => {
    if (myTurn) navigator.vibrate?.([30, 60, 30])
  }, [myTurn])

  // Le résultat tombe : petit son côté téléphone, vibration longue pour celui qui boit.
  const lastSeen = useRef(state?.lastRoll?.n ?? 0)
  useEffect(() => {
    const roll = state?.lastRoll
    if (!roll || rolling || roll.n === lastSeen.current) return
    lastSeen.current = roll.n
    play('pop')
    if (roll.memberId === myId) navigator.vibrate?.(Array.from({ length: roll.value }, () => [90, 70]).flat())
  }, [state?.lastRoll, rolling, myId, play])

  if (!group || !state || !myId) return null
  const byId = (id: string | null | undefined) => group.members.find((m) => m.id === id)

  if (group.party.status === 'ended' || group.party.phase === 'ended') {
    return <FinalView state={state} members={group.members} myId={myId} onExit={() => navigate('/lobby')} />
  }

  if (group.party.phase === 'intro') {
    return (
      <div className="min-h-svh flex flex-col items-center px-6 pt-[4.5rem] pb-10 safe-top text-center">
        <p className="kicker text-2xs mb-2">18+ · dès 2 joueurs</p>
        <h1 className="font-display text-3xl text-chalk mb-3">Lancer de dés</h1>
        <p className="text-chalk-soft text-sm max-w-xs mb-8">
          Chacun son tour, tu lances le dé. Ce que tu fais, <b className="text-chalk">tu le bois</b>. C'est tout.
        </p>
        <CssDie value={6} rollKey={0} rolling={false} size={110} />
        <div className="mt-auto w-full pt-10">
          {isHost ? (
            <Button
              fullWidth
              onClick={() => {
                play('start')
                hostAdvance()
              }}
            >
              C'est parti
            </Button>
          ) : (
            <HostCue action="lance la partie" />
          )}
        </div>
      </div>
    )
  }

  const last = state.lastRoll
  const roller = byId(last?.memberId)
  const current = byId(currentId)
  // Pendant que ton dé roule, ton total n'en dit pas plus que le dé.
  const mine = (state.totalSips[myId] ?? 0) - (rolling && last?.memberId === myId ? last.value : 0)

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      {/* Le dernier lancer, pour tout le monde. */}
      <div className="flex flex-col items-center text-center">
        <p className="kicker text-2xs mb-8">{last ? `Lancer n° ${last.n}` : 'Premier lancer'}</p>
        {last ? (
          <>
            <CssDie value={last.value} rollKey={last.n} rolling={rolling} size={104} glow={roller?.color} />
            <div className="h-16 mt-5">
              <AnimatePresence mode="wait">
                {rolling ? (
                  <motion.p key="rolling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-chalk-soft text-sm">
                    {roller?.id === myId ? 'Ton dé roule…' : `Le dé de ${roller?.pseudo ?? '…'} roule…`}
                  </motion.p>
                ) : (
                  <motion.div key={`r${last.n}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="font-display text-xl text-chalk">
                      {roller?.id === myId ? 'Tu bois' : `${roller?.pseudo ?? '?'} boit`} <span className="text-[#f5a524]">{sips(last.value)}</span>
                    </p>
                    <p className="text-chalk-faint text-xs mt-1">{FLAVOR[last.value]}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <p className="text-chalk-soft text-sm mb-6">Le dé n'a pas encore roulé.</p>
        )}
      </div>

      {/* Ton tour, ou celui de quelqu'un d'autre. */}
      <div className="mt-6 flex flex-col items-center">
        {myTurn ? (
          <ThrowPad key={last?.n ?? 0} onThrow={() => sendAction('roll', {})} />
        ) : current && !rolling ? (
          <HostCue action={current.id === myId ? 'lances le dé' : 'lance le dé'} memberId={current.id} />
        ) : null}
      </div>

      <div className="mt-auto pt-8">
        <div className="flex items-center justify-between rounded-control bg-felt border border-line px-4 py-3 mb-3">
          <span className="text-sm text-chalk-soft">Tu as bu</span>
          <span className="font-display text-lg text-[#f5a524] tabular-nums">{sips(mine)}</span>
        </div>
        {isHost && (
          <div className="flex gap-2">
            {current && current.id !== myId && (
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  play('pop')
                  hostAdvance()
                }}
              >
                Passer {current.pseudo}
              </Button>
            )}
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                play('pop')
                sendAction('finish', {})
              }}
            >
              Terminer
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Le dé à lancer : appuyer le secoue (vibrations en rafale), relâcher le lance. Un simple tap
 * marche aussi — on ne punit pas ceux qui ne devinent pas le geste.
 */
function ThrowPad({ onThrow }: { onThrow: () => void }) {
  const [holding, setHolding] = useState(false)
  const [thrown, setThrown] = useState(false)
  const buzz = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearInterval(buzz.current), [])
  // Lancer refusé par le serveur (trop tôt, connexion perdue) : le dé revient dans la main.
  useEffect(() => {
    if (!thrown) return
    const t = window.setTimeout(() => setThrown(false), 3000)
    return () => window.clearTimeout(t)
  }, [thrown])

  const start = () => {
    if (thrown) return
    setHolding(true)
    navigator.vibrate?.(25)
    buzz.current = window.setInterval(() => navigator.vibrate?.(18), 110)
  }
  const release = () => {
    window.clearInterval(buzz.current)
    if (thrown) return
    setHolding(false)
    setThrown(true)
    navigator.vibrate?.(60)
    onThrow()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-display text-2xl text-chalk">À toi !</p>
      <motion.button
        type="button"
        aria-label="Lancer le dé"
        data-testid="dice-throw"
        onPointerDown={start}
        onPointerUp={release}
        onPointerLeave={() => holding && release()}
        onPointerCancel={() => holding && release()}
        onContextMenu={(e) => e.preventDefault()}
        disabled={thrown}
        animate={
          thrown
            ? { y: -260, rotate: 540, scale: 0.4, opacity: 0 }
            : holding
              ? { x: [0, -6, 7, -5, 6, 0], rotate: [0, -8, 9, -7, 8, 0], scale: 0.94 }
              : { y: [0, -8, 0], rotate: 0, scale: 1 }
        }
        transition={
          thrown
            ? { duration: 0.55, ease: 'easeIn' }
            : holding
              ? { duration: 0.32, repeat: Infinity }
              : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
        }
        className={clsx('relative touch-none select-none rounded-[28px] p-3', holding ? 'bg-spark/15' : 'bg-white/[0.03]')}
        style={{ WebkitTouchCallout: 'none' }}
      >
        <CssDie value={5} rollKey={0} rolling={false} size={132} />
      </motion.button>
      <p className="text-chalk-faint text-xs">{holding ? 'Relâche pour lancer !' : 'Maintiens pour secouer, relâche pour lancer'}</p>
    </div>
  )
}

function FinalView({ state, members, myId, onExit }: { state: DiceClientState; members: Member[]; myId: string; onExit: () => void }) {
  const ranked = state.order
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m)
    .sort((a, b) => (state.totalSips[b.id] ?? 0) - (state.totalSips[a.id] ?? 0))
  const top = ranked[0]
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
        <p className="kicker text-2xs mb-3">Santé ! · {state.rolls} lancers</p>
        {top && (
          <div className="flex flex-col items-center gap-2">
            <Player member={top} size="focus" showName={false} />
            <p className="font-display text-2xl text-chalk">{top.id === myId ? 'Tu es le plus assoiffé' : `${top.pseudo}, le plus assoiffé`}</p>
          </div>
        )}
      </motion.div>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <div
            key={m.id}
            className={clsx('flex items-center gap-3 rounded-control border px-3 py-2.5', m.id === myId ? 'bg-felt-raised border-spark/40' : 'bg-felt border-line')}
          >
            <span className="w-5 text-sm text-chalk-soft tabular-nums">{i + 1}</span>
            <Player member={m} size="chip" showName={false} />
            <span className="flex-1 text-sm text-chalk truncate">{m.pseudo}</span>
            <span className="text-sm text-[#f5a524] tabular-nums">{sips(state.totalSips[m.id] ?? 0)}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-chalk-faint text-xs mb-4">Buvez de l'eau, et pas de volant ce soir.</p>
      <Button fullWidth onClick={onExit} className="mt-auto">
        Retour au salon
      </Button>
    </div>
  )
}
