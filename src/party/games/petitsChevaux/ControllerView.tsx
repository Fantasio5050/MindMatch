import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { PC_TRACK, PC_FINISH_INDEX, PC_HORSE_COLORS, pcColorHex, type PCCell } from '../../../data/petitsChevaux'
import type { PetitsChevauxClientState } from './types'
import type { Member } from '../../../types'

export function PetitsChevauxController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()

  const state = (group?.party.roundData as PetitsChevauxClientState | null) ?? null
  const rollKey = state?.lastRoll ? `${state.lastRoll.playerId}-${state.turnsPlayed}` : null
  const seen = useRef<string | null>(null)
  const selfId = currentMember?.id ?? null

  useEffect(() => {
    if (!state?.lastRoll || rollKey === seen.current) return
    seen.current = rollKey
    if (selfId && state.lastRoll.captured.includes(selfId)) play('lose')
    else if (state.lastRoll.playerId === selfId) play('pop')
  }, [rollKey, state, selfId, play])

  if (!group || !currentMember) return null
  const { party } = group

  if (party.status === 'ended' && state) {
    return <FinalResults members={group.members.filter((m) => state.order.includes(m.id))} state={state} onExit={() => navigate('/lobby')} />
  }
  if (!state) {
    return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-chalk-soft text-sm">Préparation du plateau…</p></div>
  }

  if (party.phase === 'intro') {
    return (
      <IntroView
        state={state}
        members={group.members}
        selfId={currentMember.id}
        isHost={isHost}
        onPick={(color) => {
          play('vote')
          sendAction('pickColor', { color })
        }}
        onStart={() => hostAdvance()}
      />
    )
  }

  const currentId = state.order[state.currentIndex]
  const isMyTurn = currentId === currentMember.id
  const iFinished = state.finishOrder.includes(currentMember.id)
  const currentPseudo = group.members.find((m) => m.id === currentId)?.pseudo ?? '?'
  const myPos = state.positions[currentMember.id] ?? 0
  const myColor = pcColorHex(state.horseColors[currentMember.id])

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-8 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Tour {state.turnsPlayed + 1}</p>

      <AnimatePresence mode="wait">
        {state.lastRoll && (
          <motion.div
            key={`${state.lastRoll.playerId}-${state.turnsPlayed}`}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className="glass-card rounded-2xl px-4 py-3 mb-4 text-center"
          >
            <p className="text-sm">
              🎲 <b>{group.members.find((m) => m.id === state.lastRoll!.playerId)?.pseudo ?? '?'}</b> a fait un{' '}
              <b className="text-fuchsia-300">{state.lastRoll.die}</b>
            </p>
            {state.lastRoll.text && <p className="text-xs text-chalk-soft mt-1">{state.lastRoll.text}</p>}
            {state.lastRoll.captured.length > 0 && (
              <p className="text-xs text-pink-300 mt-1">
                💥 {state.lastRoll.captured.map((id) => group.members.find((m) => m.id === id)?.pseudo ?? '?').join(', ')} renvoyé·e au départ !
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini-plateau : permet de suivre la course sans écran TV (fallback téléphone seul). */}
      <MiniTrack state={state} />

      <div className="flex-1 flex flex-col items-center justify-center">
        {iFinished ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <Card className="text-center">
              <p className="text-5xl mb-2">🏆</p>
              <p className="font-bold">Ton cheval est à l'arrivée !</p>
              <p className="text-chalk-soft text-sm">Regarde les autres galérer 😏</p>
            </Card>
          </motion.div>
        ) : isMyTurn ? (
          <motion.div key="myturn" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-col items-center">
            <p className="text-chalk-soft text-sm mb-3">
              Case {myPos} / {PC_FINISH_INDEX} — à toi de jouer !
            </p>
            <motion.button
              whileTap={{ scale: 0.9 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              onClick={() => {
                play('tick')
                sendAction('roll', {})
              }}
              className="w-40 h-40 rounded-3xl text-white text-6xl font-extrabold shadow-2xl flex items-center justify-center border-4 border-line-strong"
              style={{ background: `linear-gradient(135deg, ${myColor}, ${myColor}bb)` }}
            >
              🎲
            </motion.button>
            <p className="text-chalk-faint text-sm mt-4">Lance le dé pour ton cheval 🐴</p>
          </motion.div>
        ) : (
          <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
            <Card className="text-center">
              <p className="text-chalk-soft text-sm mb-2">En attente…</p>
              <p className="font-semibold">C'est au tour de {currentPseudo} 🎲</p>
              <p className="text-chalk-faint text-sm mt-2">Ton cheval : case {myPos} / {PC_FINISH_INDEX}</p>
            </Card>
          </motion.div>
        )}
      </div>

      {isHost && !isMyTurn && !iFinished && (
        <Button fullWidth variant="ghost" onClick={() => hostAdvance()} className="!py-2 text-sm mt-4">
          Passer le tour de {currentPseudo} (absent·e)
        </Button>
      )}
      <p className="text-center text-chalk-faint text-xs mt-4">📺 Suis la course sur la TV</p>
    </div>
  )
}

function miniCellTint(type: PCCell['type']): string {
  switch (type) {
    case 'drink': return 'rgba(244,114,182,0.55)'
    case 'culsec': return 'rgba(255,255,255,0.75)'
    case 'everyone': return 'rgba(96,165,250,0.55)'
    case 'forward': return 'rgba(52,211,153,0.55)'
    case 'back': return 'rgba(251,146,60,0.55)'
    case 'gage': return 'rgba(217,130,250,0.55)'
    case 'finish': return 'rgba(251,191,36,0.8)'
    default: return 'rgba(255,255,255,0.14)'
  }
}

/** Piste compacte sur le téléphone — le jeu reste jouable sans affichage TV. */
function MiniTrack({ state }: { state: PetitsChevauxClientState }) {
  return (
    <div className="glass-card rounded-2xl px-3 pt-4 pb-2.5 mb-4">
      <div className="flex flex-wrap items-center justify-center gap-[3px]">
        {PC_TRACK.map((cell, i) => {
          const here = state.order.filter((id) => (state.positions[id] ?? 0) === i && !state.finishOrder.includes(id))
          return (
            <div key={i} className="relative w-2.5 h-2.5 rounded-full shrink-0" style={{ background: miniCellTint(cell.type) }}>
              {here.length > 0 && (
                <span className="absolute -top-[7px] left-1/2 -translate-x-1/2 flex -space-x-1">
                  {here.map((id) => (
                    <span
                      key={id}
                      className="w-2.5 h-2.5 rounded-full border border-black/60"
                      style={{ background: pcColorHex(state.horseColors[id]) }}
                    />
                  ))}
                </span>
              )}
            </div>
          )
        })}
        <span className="text-[11px] leading-none ml-0.5">🏆</span>
      </div>
    </div>
  )
}

function IntroView({
  state,
  members,
  selfId,
  isHost,
  onPick,
  onStart,
}: {
  state: PetitsChevauxClientState
  members: Member[]
  selfId: string
  isHost: boolean
  onPick: (color: string) => void
  onStart: () => void
}) {
  const myColor = state.horseColors[selfId]
  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-5">
        <span className="text-5xl">🐴</span>
        <h1 className="text-2xl font-extrabold mt-2">Petits Chevaux</h1>
        <p className="text-chalk-faint text-sm">Le plateau est sur la TV 📺</p>
      </div>

      <Card className="mb-4">
        <p className="text-sm font-semibold text-center mb-3">Choisis ton cheval 🐎</p>
        <div className="grid grid-cols-2 gap-3">
          {PC_HORSE_COLORS.map((c) => {
            const mine = myColor === c.key
            const takenBy = members.filter((m) => state.horseColors[m.id] === c.key && state.order.includes(m.id))
            return (
              <motion.button
                key={c.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => onPick(c.key)}
                className={`rounded-2xl p-3 flex flex-col items-center gap-1 border-2 transition-colors ${mine ? 'border-white' : 'border-transparent'}`}
                style={{ background: `${c.hex}26` }}
              >
                <span className="text-4xl" style={{ filter: `drop-shadow(0 2px 3px ${c.hex})` }}>🐎</span>
                <span className="text-sm font-bold" style={{ color: c.hex }}>{c.name}</span>
                <div className="flex -space-x-1.5 h-5">
                  {takenBy.map((m) => (
                    <Avatar key={m.id} pseudo={m.pseudo} color={m.color} size={18} photoUrl={m.photoUrl} />
                  ))}
                </div>
              </motion.button>
            )
          })}
        </div>
      </Card>

      <Card className="mb-6">
        <ul className="flex flex-col gap-2 text-xs text-chalk-muted">
          <li className="flex gap-2"><span>🎯</span><span>Tombe pile sur l'arrivée au centre — si tu dépasses, tu rebondis !</span></li>
          <li className="flex gap-2"><span>💥</span><span>Atterris pile sur un cheval adverse et il repart au départ (il boit 2).</span></li>
          <li className="flex gap-2"><span>🍺</span><span>Les cases déclenchent : bois, tournée, avance, recule, gage, cul sec.</span></li>
        </ul>
      </Card>

      {isHost ? (
        <Button fullWidth onClick={onStart}>
          Lancer la course ! 🐴
        </Button>
      ) : (
        <p className="text-center text-chalk-faint text-sm">En attente que l'hôte lance la course…</p>
      )}
      <p className="text-center text-chalk-faint text-xs mt-4">💧 Tu peux toujours remplacer l'alcool par de l'eau.</p>
    </div>
  )
}

function FinalResults({ members, state, onExit }: { members: Member[]; state: PetitsChevauxClientState; onExit: () => void }) {
  const ranked = rankPlayers(members, state)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Course terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🐴 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <span className="text-2xl" style={{ filter: `drop-shadow(0 1px 2px ${pcColorHex(state.horseColors[m.id])})` }}>🐎</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={32} photoUrl={m.photoUrl} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-chalk-soft">{state.totalSips[m.id] ?? 0} 🍻</span>
          </Card>
        ))}
      </div>
      <p className="text-center text-chalk-faint text-xs mb-4">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}

/** Classement : d'abord l'ordre d'arrivée, puis les autres par position décroissante (proximité de
 * l'arrivée), départage aux gorgées bues (moins = mieux). Partagé avec l'écran TV. */
export function rankPlayers(members: Member[], state: PetitsChevauxClientState): Member[] {
  return [...members].sort((a, b) => {
    const fa = state.finishOrder.indexOf(a.id)
    const fb = state.finishOrder.indexOf(b.id)
    if (fa !== -1 && fb !== -1) return fa - fb
    if (fa !== -1) return -1
    if (fb !== -1) return 1
    const pa = state.positions[a.id] ?? 0
    const pb = state.positions[b.id] ?? 0
    if (pb !== pa) return pb - pa
    return (state.totalSips[a.id] ?? 0) - (state.totalSips[b.id] ?? 0)
  })
}
