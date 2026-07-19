import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { PodiumRow } from '../shared/PodiumRow'
import { PC_TRACK, PC_HORSE_COLORS, pcColorHex, type PCCell } from '../../../data/petitsChevaux'
import { rankPlayers } from './ControllerView'
import type { PetitsChevauxClientState } from './types'
import type { Member } from '../../../types'

const RING = 25 // cases sur l'anneau carré ; les 5 dernières forment la ligne d'arrivée centrale.

/** Coordonnée (0-100) d'une case sur le plateau : anneau carré façon plateau de petits chevaux,
 * puis colonne d'arrivée qui plonge vers le centre (le but 🏆). */
function cellXY(i: number): { x: number; y: number } {
  if (i < RING) {
    const u = (0.125 + i / RING) % 1 // départ en haut-centre, sens horaire
    return squareRing(u)
  }
  const j = i - RING // 0..(len-RING-1)
  const y = 28 + ((50 - 28) * j) / Math.max(1, PC_TRACK.length - 1 - RING)
  return { x: 50, y }
}
function squareRing(u: number): { x: number; y: number } {
  const A = 20, B = 80, S = B - A
  const s = u * 4
  if (s < 1) return { x: A + S * s, y: A }
  if (s < 2) return { x: B, y: A + S * (s - 1) }
  if (s < 3) return { x: B - S * (s - 2), y: B }
  return { x: A, y: B - S * (s - 3) }
}

const CORNERS = [
  { x: 13, y: 13, color: PC_HORSE_COLORS[0] }, // vert, haut-gauche
  { x: 87, y: 13, color: PC_HORSE_COLORS[1] }, // jaune, haut-droite
  { x: 87, y: 87, color: PC_HORSE_COLORS[2] }, // rouge, bas-droite
  { x: 13, y: 87, color: PC_HORSE_COLORS[3] }, // bleu, bas-gauche
]

function cellTint(type: PCCell['type']): { bg: string; border: string } {
  switch (type) {
    case 'start': return { bg: 'rgba(255,255,255,0.18)', border: 'rgba(255,255,255,0.5)' }
    case 'drink': return { bg: 'rgba(224,68,124,0.35)', border: 'rgba(244,114,182,0.7)' }
    case 'culsec': return { bg: 'rgba(0,0,0,0.55)', border: 'rgba(255,255,255,0.4)' }
    case 'everyone': return { bg: 'rgba(47,127,212,0.35)', border: 'rgba(96,165,250,0.7)' }
    case 'forward': return { bg: 'rgba(63,164,91,0.35)', border: 'rgba(52,211,153,0.7)' }
    case 'back': return { bg: 'rgba(226,132,37,0.35)', border: 'rgba(251,146,60,0.7)' }
    case 'gage': return { bg: 'rgba(168,85,247,0.35)', border: 'rgba(217,130,250,0.7)' }
    default: return { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.25)' }
  }
}

/** Indices de cases traversés de `a` à `b` inclus (pour l'animation de saut du pion). */
function pathBetween(a: number, b: number): number[] {
  const out: number[] = []
  const step = a <= b ? 1 : -1
  for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i)
  return out
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

  if (status === 'ended') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12 text-center">
        <Confetti trigger={confetti} />
        <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Petits Chevaux — course terminée</p>
        <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
        <div className="flex flex-col gap-4 items-center">
          {rankPlayers(participants, state).map((m, i, arr) => (
            <PodiumRow key={m.id} rank={i} total={arr.length} width={520} loserEmoji="🍺">
              <span className="text-2xl font-bold w-8 text-white/50">{i === 0 ? '🏆' : i + 1}</span>
              <span className="text-3xl" style={{ filter: `drop-shadow(0 2px 3px ${pcColorHex(state.horseColors[m.id])})` }}>🐎</span>
              <Avatar pseudo={m.pseudo} color={m.color} size={44} photoUrl={m.photoUrl} />
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
        <div className="flex items-center gap-16">
          <Board state={state} participants={participants} />
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-md">
            <span className="text-6xl mb-3 inline-block">🐴</span>
            <h1 className="text-5xl font-extrabold shimmer-text mb-6">Petits Chevaux</h1>
            <div className="flex flex-col gap-3 text-xl text-white/80">
              <p>🎨 Chacun choisit son cheval sur son téléphone.</p>
              <p>🎯 Tombe pile au centre pour gagner — sinon tu rebondis.</p>
              <p>💥 Écrase un adversaire → il repart au départ et il boit.</p>
              <p>🍺 Les cases font boire, avancer, reculer, ou tirer un gage.</p>
            </div>
            <p className="text-white/30 text-lg mt-6">L'hôte lance la course 📱</p>
          </motion.div>
        </div>
      </div>
    )
  }

  const currentId = state.order[state.currentIndex]
  const currentMember = group.members.find((m) => m.id === currentId)

  return (
    <div className="min-h-svh flex items-center justify-center gap-12 px-10 py-6">
      <Confetti trigger={confetti} />
      <Board state={state} participants={participants} />

      {/* Panneau latéral : dé, événement, classement */}
      <div className="w-[320px] flex flex-col gap-5">
        <div className="glass-card rounded-3xl p-5 bg-black/40 flex flex-col items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.turnsPlayed}
              initial={{ rotate: -160, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 13 }}
              className="w-20 h-20 rounded-2xl bg-white text-[#1a1030] text-5xl font-extrabold flex items-center justify-center shadow-xl"
            >
              {state.lastRoll ? state.lastRoll.die : '🎲'}
            </motion.div>
          </AnimatePresence>
          {currentMember && (
            <p className="text-white/60 text-lg mt-4 text-center">
              🎲 Au tour de <span className="font-bold text-white/90">{currentMember.pseudo}</span>
            </p>
          )}
          <AnimatePresence mode="wait">
            <motion.p
              key={`t-${state.turnsPlayed}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="text-center text-white/80 mt-2 min-h-[2.5rem]"
            >
              {state.lastRoll?.text || 'Que la course commence !'}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="glass-card rounded-3xl p-4 bg-black/40 flex flex-col gap-2">
          {[...participants]
            .sort((a, b) => (state.positions[b.id] ?? 0) - (state.positions[a.id] ?? 0))
            .map((m) => (
              <div key={m.id} className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ background: pcColorHex(state.horseColors[m.id]) }} />
                <Avatar pseudo={m.pseudo} color={m.color} size={26} photoUrl={m.photoUrl} />
                <span className="flex-1 truncate font-medium">{m.pseudo}</span>
                <span className="text-white/50 text-sm tabular-nums">
                  {state.finishOrder.includes(m.id) ? '🏆' : `${state.positions[m.id] ?? 0}/${PC_TRACK.length - 1}`}
                </span>
                <span className="text-white/40 text-sm">{state.totalSips[m.id] ?? 0}🍻</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function Board({ state, participants }: { state: PetitsChevauxClientState; participants: Member[] }) {
  // Décalage stable par joueur pour que plusieurs pions sur la même case ne se superposent pas.
  const offsets: Record<string, { dx: number; dy: number }> = {}
  participants.forEach((m, i) => {
    const a = (i / Math.max(1, participants.length)) * Math.PI * 2
    offsets[m.id] = { dx: Math.cos(a) * 2.4, dy: Math.sin(a) * 2.4 }
  })

  return (
    <div className="relative shrink-0 rounded-2xl bg-[#0e0a17] border border-white/10 shadow-2xl" style={{ width: 'min(72vh, 660px)', height: 'min(72vh, 660px)' }}>
      {/* Tracé de la piste (sous les cases) */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <polyline
          points={PC_TRACK.map((_, i) => { const p = cellXY(i); return `${p.x},${p.y}` }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={4.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Écuries : 4 chevaux dans les coins */}
      {CORNERS.map((c, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center rounded-full"
          style={{
            left: `${c.x}%`, top: `${c.y}%`, width: '19%', height: '19%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle at 50% 40%, ${c.color.hex}dd, ${c.color.hex}77)`,
            border: `3px solid ${c.color.hex}`,
            boxShadow: `0 0 18px ${c.color.hex}66`,
          }}
        >
          <span className="text-[2.6vw]" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>🐎</span>
        </div>
      ))}

      {/* Cases */}
      {PC_TRACK.map((cell, i) => {
        if (cell.type === 'finish') return null // le centre est rendu comme "but"
        const p = cellXY(i)
        const tint = cellTint(cell.type)
        const isLanding = state.lastRoll?.to === i
        return (
          <motion.div
            key={i}
            className="absolute flex items-center justify-center rounded-full"
            style={{
              left: `${p.x}%`, top: `${p.y}%`, width: 34, height: 34, marginLeft: -17, marginTop: -17,
              background: tint.bg, border: `2px solid ${tint.border}`,
            }}
            animate={isLanding ? { scale: [1, 1.35, 1] } : {}}
            transition={{ duration: 0.5 }}
          >
            <span className="text-base leading-none">{cell.emoji}</span>
          </motion.div>
        )
      })}

      {/* But central */}
      <div
        className="absolute flex flex-col items-center justify-center rounded-full"
        style={{
          left: '50%', top: '50%', width: '17%', height: '17%', transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle at 50% 40%, rgba(251,191,36,0.9), rgba(146,64,14,0.7))',
          border: '3px solid rgba(251,191,36,0.9)',
          boxShadow: '0 0 24px rgba(251,191,36,0.5)',
        }}
      >
        <span className="text-[2.8vw]">🏆</span>
      </div>

      {/* Pions (chevaux) */}
      {participants.map((m) => {
        const pos = state.positions[m.id] ?? 0
        const off = offsets[m.id]
        const hex = pcColorHex(state.horseColors[m.id])
        const isMover = state.lastRoll?.playerId === m.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let animate: any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let transition: any
        if (isMover && state.lastRoll) {
          const path = pathBetween(state.lastRoll.from, state.lastRoll.to)
          animate = {
            left: path.map((i) => `${cellXY(i).x + off.dx}%`),
            top: path.map((i) => `${cellXY(i).y + off.dy}%`),
            scale: path.map((_, k) => (k % 2 === 0 ? 1 : 1.18)),
          }
          transition = { duration: Math.max(0.45, path.length * 0.16), ease: 'easeInOut' }
        } else {
          const p = cellXY(pos)
          animate = { left: `${p.x + off.dx}%`, top: `${p.y + off.dy}%`, scale: 1 }
          transition = { type: 'spring', stiffness: 130, damping: 18 }
        }
        return (
          <motion.div
            key={m.id}
            className="absolute z-10 flex items-center justify-center rounded-full"
            style={{ width: 38, height: 38, marginLeft: -19, marginTop: -19 }}
            animate={animate}
            transition={transition}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center border-2 border-white/70"
              style={{ background: `radial-gradient(circle at 50% 35%, ${hex}, ${hex}aa)`, boxShadow: `0 3px 8px rgba(0,0,0,0.5), 0 0 10px ${hex}88` }}
            >
              <span className="text-lg leading-none">🐎</span>
            </div>
            <div className="absolute -bottom-1 -right-1">
              <Avatar pseudo={m.pseudo} color={m.color} size={16} photoUrl={m.photoUrl} />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
