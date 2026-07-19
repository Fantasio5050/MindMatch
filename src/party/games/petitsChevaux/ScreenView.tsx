import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { PodiumRow } from '../shared/PodiumRow'
import { PC_TRACK, type PCCell } from '../../../data/petitsChevaux'
import { rankPlayers } from './ControllerView'
import type { PetitsChevauxClientState } from './types'

const COLS = 6

/** Cases regroupées en lignes, en serpentin (boustrophédon) : la ligne 0 va de gauche à droite,
 * la ligne 1 de droite à gauche, etc. — comme un vrai plateau de jeu de l'oie. */
function boustrophedonRows(cells: PCCell[]): PCCell[][] {
  const rows: PCCell[][] = []
  for (let i = 0; i < cells.length; i += COLS) {
    const row = cells.slice(i, i + COLS)
    rows.push((i / COLS) % 2 === 1 ? [...row].reverse() : row)
  }
  return rows
}

function cellStyle(type: PCCell['type']): string {
  switch (type) {
    case 'start': return 'bg-white/15 border-white/30'
    case 'finish': return 'bg-amber-400/25 border-amber-300/60'
    case 'drink': return 'bg-pink-500/20 border-pink-400/40'
    case 'culsec': return 'bg-black/50 border-white/20'
    case 'everyone': return 'bg-sky-500/20 border-sky-400/40'
    case 'forward': return 'bg-emerald-500/20 border-emerald-400/40'
    case 'back': return 'bg-orange-500/20 border-orange-400/40'
    case 'gage': return 'bg-fuchsia-500/20 border-fuchsia-400/40'
    default: return 'bg-white/5 border-white/10'
  }
}

export function PetitsChevauxScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const [confetti, setConfetti] = useState(0)
  const lastTurn = useRef(-1)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null
  const state = (group?.party.roundData as PetitsChevauxClientState | null) ?? null

  useEffect(() => {
    if (!state?.lastRoll || state.turnsPlayed === lastTurn.current) return
    lastTurn.current = state.turnsPlayed
    if (state.lastRoll.captured.length > 0) play('lose')
    else play('tick')
  }, [state, play])

  useEffect(() => {
    if (status === 'ended') setConfetti((n) => n + 1)
  }, [status])

  if (!group || !state) {
    return <div className="min-h-svh flex items-center justify-center"><p className="text-white/40 text-xl">Connexion à la salle…</p></div>
  }

  const participants = group.members.filter((m) => state.order.includes(m.id))
  const rows = boustrophedonRows(PC_TRACK)

  if (status === 'ended') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12 text-center">
        <Confetti trigger={confetti} />
        <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Petits Chevaux — course terminée</p>
        <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
        <div className="flex flex-col gap-4 items-center">
          {rankPlayers(participants, state).map((m, i, arr) => (
            <PodiumRow key={m.id} rank={i} total={arr.length} width={500} loserEmoji="🍺">
              <span className="text-2xl font-bold w-8 text-white/50">{i === 0 ? '🏆' : i + 1}</span>
              <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
              <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
              <span className="text-lg text-white/60 tabular-nums">{state.totalSips[m.id] ?? 0} 🍻</span>
            </PodiumRow>
          ))}
        </div>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-svh flex items-center justify-center px-12">
        <Confetti trigger={confetti} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl">
          <span className="text-7xl mb-4 inline-block">🐴</span>
          <h1 className="text-6xl font-extrabold shimmer-text mb-8">Petits Chevaux</h1>
          <div className="flex flex-col gap-3 text-xl text-white/80 text-left mx-auto w-fit">
            <p>🎲 Chacun son tour, lance le dé et avance ton cheval.</p>
            <p>🎯 Il faut tomber pile sur l'arrivée — sinon on rebondit en arrière !</p>
            <p>💥 Tomber sur un adversaire le renvoie au départ (et il boit).</p>
            <p>🍺 Les cases : bois, distribue, avance, recule, gage, cul sec.</p>
          </div>
          <p className="text-white/30 text-xl mt-8">L'hôte lance la course 📱</p>
        </motion.div>
      </div>
    )
  }

  const currentId = state.order[state.currentIndex]
  const currentMember = group.members.find((m) => m.id === currentId)

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-10 py-8">
      <Confetti trigger={confetti} />

      {/* Bandeau : dé + événement + à qui le tour */}
      <div className="flex items-center gap-6 mb-6 min-h-[5rem]">
        {state.lastRoll && (
          <motion.div
            key={state.turnsPlayed}
            initial={{ rotate: -180, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="w-16 h-16 rounded-2xl bg-white text-[#1a1030] text-4xl font-extrabold flex items-center justify-center shadow-xl"
          >
            {state.lastRoll.die}
          </motion.div>
        )}
        <div className="text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={state.turnsPlayed}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-2xl font-bold"
            >
              {state.lastRoll?.text ? state.lastRoll.text : 'Que la course commence !'}
            </motion.p>
          </AnimatePresence>
          {currentMember && (
            <p className="text-white/50 text-lg mt-1">
              🎲 Au tour de <span className="font-semibold text-white/80">{currentMember.pseudo}</span>
            </p>
          )}
        </div>
      </div>

      {/* Plateau en serpentin */}
      <LayoutGroup>
        <div className="flex flex-col gap-2">
          {rows.map((row, r) => (
            <div key={r} className="flex gap-2">
              {row.map((cell) => {
                const here = participants.filter((m) => (state.positions[m.id] ?? 0) === cell.index)
                const isCurrentCell = state.lastRoll?.to === cell.index
                return (
                  <motion.div
                    key={cell.index}
                    animate={isCurrentCell ? { scale: [1, 1.12, 1] } : {}}
                    transition={{ duration: 0.5 }}
                    className={`relative w-[104px] h-[84px] rounded-xl border flex flex-col items-center justify-center ${cellStyle(cell.type)}`}
                  >
                    <span className="text-2xl leading-none">{cell.emoji || <span className="text-white/15 text-xs">{cell.index}</span>}</span>
                    {cell.label && <span className="text-[9px] text-white/50 text-center leading-tight px-1 mt-0.5 line-clamp-2">{cell.label}</span>}
                    {/* Pions présents sur la case */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex -space-x-2">
                      {here.map((m) => (
                        <motion.div key={m.id} layoutId={`pawn-${m.id}`} transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="rounded-full ring-2 ring-black/40">
                          <Avatar pseudo={m.pseudo} color={m.color} size={26} photoUrl={m.photoUrl} />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ))}
        </div>
      </LayoutGroup>

      {/* Tally des gorgées */}
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        {[...participants]
          .sort((a, b) => (state.positions[b.id] ?? 0) - (state.positions[a.id] ?? 0))
          .map((m) => (
            <div key={m.id} className="flex items-center gap-2 glass-card rounded-full pl-1.5 pr-3 py-1.5 bg-black/30">
              <Avatar pseudo={m.pseudo} color={m.color} size={26} photoUrl={m.photoUrl} />
              <span className="text-sm font-medium">{m.pseudo}</span>
              <span className="text-xs text-white/40">
                {state.finishOrder.includes(m.id) ? '🏆' : `${state.positions[m.id] ?? 0}/${PC_TRACK.length - 1}`} · {state.totalSips[m.id] ?? 0}🍻
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
