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

const LOOP = 25 // cases de la boucle en croix ; les suivantes forment la colonne d'arrivée centrale.

/** Contour en croix (plus), sens horaire, départ au bord droit du bras du haut. Coordonnées 0-100.
 * Les 4 bras (haut/bas/gauche/droite) et les 4 carrés d'angle donnent le look « petits chevaux ». */
const PLUS: [number, number][] = [
  [61, 9], [61, 39], [91, 39], [91, 61], [61, 61], [61, 91],
  [39, 91], [39, 61], [9, 61], [9, 39], [39, 39], [39, 9],
]
const PLUS_PERIM = PLUS.reduce((p, a, i) => {
  const b = PLUS[(i + 1) % PLUS.length]
  return p + Math.hypot(b[0] - a[0], b[1] - a[1])
}, 0)
function plusPoint(d: number): { x: number; y: number } {
  let rem = ((d % PLUS_PERIM) + PLUS_PERIM) % PLUS_PERIM
  for (let i = 0; i < PLUS.length; i++) {
    const a = PLUS[i], b = PLUS[(i + 1) % PLUS.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (rem <= len) {
      const t = len === 0 ? 0 : rem / len
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t }
    }
    rem -= len
  }
  return { x: PLUS[0][0], y: PLUS[0][1] }
}

/** Coordonnée (0-100) d'une case : boucle en croix, puis colonne d'arrivée (bras du haut, lane
 * centrale) qui descend jusqu'au but 🏆 au centre. */
function cellXY(i: number): { x: number; y: number } {
  if (i < LOOP) return plusPoint((i / LOOP) * PLUS_PERIM)
  const homeCount = PC_TRACK.length - LOOP // ex. 5
  const j = i - LOOP // 0..homeCount-1
  const y = 30 + ((50 - 30) * j) / Math.max(1, homeCount - 1)
  return { x: 50, y }
}

// Écuries dans les 4 angles (carrés colorés avec un cheval), comme sur un vrai plateau.
const CORNERS = [
  { x: 20, y: 20, color: PC_HORSE_COLORS[0] }, // vert, haut-gauche
  { x: 80, y: 20, color: PC_HORSE_COLORS[1] }, // jaune, haut-droite
  { x: 80, y: 80, color: PC_HORSE_COLORS[2] }, // rouge, bas-droite
  { x: 20, y: 80, color: PC_HORSE_COLORS[3] }, // bleu, bas-gauche
]

// Colonnes d'arrivée décoratives (lane centrale de chaque bras), couleur = angle adjacent.
const HOME_COLUMNS = [
  { pts: [[50, 62], [50, 68], [50, 74], [50, 80]], hex: PC_HORSE_COLORS[2].hex }, // bas → rouge
  { pts: [[38, 50], [32, 50], [26, 50], [20, 50]], hex: PC_HORSE_COLORS[3].hex }, // gauche → bleu (BG)
  { pts: [[62, 50], [68, 50], [74, 50], [80, 50]], hex: PC_HORSE_COLORS[1].hex }, // droite → jaune (HD)
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
    return <div className="min-h-svh flex items-center justify-center"><p className="text-chalk-faint text-xl">Connexion à la salle…</p></div>
  }

  const participants = group.members.filter((m) => state.order.includes(m.id))

  if (status === 'ended') {
    return (
      <div className="tv-frame text-center">
        <Confetti trigger={confetti} />
        <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">Petits Chevaux — course terminée</p>
        <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
        <div className="flex flex-col gap-4 items-center">
          {rankPlayers(participants, state).map((m, i, arr) => (
            <PodiumRow key={m.id} rank={i} total={arr.length} width={520} loserEmoji="🍺">
              <span className="text-2xl font-bold w-8 text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
              <span className="text-3xl" style={{ filter: `drop-shadow(0 2px 3px ${pcColorHex(state.horseColors[m.id])})` }}>🐎</span>
              <Avatar pseudo={m.pseudo} color={m.color} size={44} photoUrl={m.photoUrl} />
              <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
              <span className="text-lg text-chalk-soft tabular-nums">{state.totalSips[m.id] ?? 0} 🍻</span>
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
            <div className="flex flex-col gap-3 text-xl text-chalk-muted">
              <p>🎨 Chacun choisit son cheval sur son téléphone.</p>
              <p>🎯 Tombe pile au centre pour gagner — sinon tu rebondis.</p>
              <p>💥 Écrase un adversaire → il repart au départ et il boit.</p>
              <p>🍺 Les cases font boire, avancer, reculer, ou tirer un gage.</p>
            </div>
            <p className="text-chalk-faint text-lg mt-6">L'hôte lance la course 📱</p>
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
        <div className="glass-card rounded-3xl p-5 bg-ink/40 flex flex-col items-center">
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
            <p className="text-chalk-soft text-lg mt-4 text-center">
              🎲 Au tour de <span className="font-bold text-chalk-muted">{currentMember.pseudo}</span>
            </p>
          )}
          <AnimatePresence mode="wait">
            <motion.p
              key={`t-${state.turnsPlayed}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="text-center text-chalk-muted mt-2 min-h-[2.5rem]"
            >
              {state.lastRoll?.text || 'Que la course commence !'}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="glass-card rounded-3xl p-4 bg-ink/40 flex flex-col gap-2">
          {[...participants]
            .sort((a, b) => (state.positions[b.id] ?? 0) - (state.positions[a.id] ?? 0))
            .map((m) => (
              <div key={m.id} className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ background: pcColorHex(state.horseColors[m.id]) }} />
                <Avatar pseudo={m.pseudo} color={m.color} size={26} photoUrl={m.photoUrl} />
                <span className="flex-1 truncate font-medium">{m.pseudo}</span>
                <span className="text-chalk-soft text-sm tabular-nums">
                  {state.finishOrder.includes(m.id) ? '🏆' : `${state.positions[m.id] ?? 0}/${PC_TRACK.length - 1}`}
                </span>
                <span className="text-chalk-faint text-sm">{state.totalSips[m.id] ?? 0}🍻</span>
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
    <div className="relative shrink-0 rounded-2xl bg-[#0e0a17] border border-line shadow-2xl" style={{ width: 'min(72vh, 660px)', height: 'min(72vh, 660px)' }}>
      {/* Tracé de la croix + colonnes d'arrivée (sous les cases) */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <polygon
          points={PLUS.map((p) => `${p[0]},${p[1]}`).join(' ')}
          fill="rgba(255,255,255,0.025)"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={4}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {HOME_COLUMNS.map((h, i) => (
          <polyline key={i} points={h.pts.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke={`${h.hex}66`} strokeWidth={9} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
        <polyline
          points={Array.from({ length: PC_TRACK.length - LOOP }, (_, j) => cellXY(LOOP + j)).map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke="rgba(251,191,36,0.45)" strokeWidth={9} strokeLinecap="round" vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Écuries : 4 chevaux dans des carrés d'angle */}
      {CORNERS.map((c, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center"
          style={{
            left: `${c.x}%`, top: `${c.y}%`, width: '30%', height: '30%',
            transform: 'translate(-50%, -50%)',
            background: `linear-gradient(150deg, ${c.color.hex}, ${c.color.hex}bb)`,
            border: `4px solid ${c.color.hex}`, borderRadius: 16,
            boxShadow: `0 0 22px ${c.color.hex}55, inset 0 0 22px rgba(0,0,0,0.28)`,
          }}
        >
          <span className="text-[4vw]" style={{ filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.55))' }}>🐎</span>
        </div>
      ))}

      {/* Points décoratifs des colonnes d'arrivée (les 3 autres bras) */}
      {HOME_COLUMNS.map((h, ci) => h.pts.map((p, k) => (
        <div key={`${ci}-${k}`} className="absolute rounded-full" style={{ left: `${p[0]}%`, top: `${p[1]}%`, width: 18, height: 18, marginLeft: -9, marginTop: -9, background: `${h.hex}44`, border: `2px solid ${h.hex}aa` }} />
      )))}

      {/* Cases */}
      {PC_TRACK.map((cell, i) => {
        if (cell.type === 'finish') return null // le centre est rendu comme "but"
        const p = cellXY(i)
        const tint = cellTint(cell.type)
        const isLanding = state.lastRoll?.to === i
        const isHome = i >= LOOP
        return (
          <motion.div
            key={i}
            className="absolute flex items-center justify-center rounded-full"
            style={{
              left: `${p.x}%`, top: `${p.y}%`, width: 32, height: 32, marginLeft: -16, marginTop: -16,
              background: isHome ? 'rgba(251,191,36,0.28)' : tint.bg,
              border: `2px solid ${isHome ? 'rgba(251,191,36,0.85)' : tint.border}`,
            }}
            animate={isLanding ? { scale: [1, 1.35, 1] } : {}}
            transition={{ duration: 0.5 }}
          >
            <span className="text-sm leading-none">{cell.emoji}</span>
          </motion.div>
        )
      })}

      {/* But central : 4 triangles colorés + trophée */}
      <div className="absolute" style={{ left: '50%', top: '50%', width: '19%', height: '19%', transform: 'translate(-50%, -50%)' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full rounded-xl overflow-hidden" style={{ boxShadow: '0 0 26px rgba(251,191,36,0.5)', border: '3px solid rgba(251,191,36,0.9)' }}>
          <polygon points="0,0 100,0 50,50" fill={PC_HORSE_COLORS[0].hex} />
          <polygon points="100,0 100,100 50,50" fill={PC_HORSE_COLORS[1].hex} />
          <polygon points="100,100 0,100 50,50" fill={PC_HORSE_COLORS[2].hex} />
          <polygon points="0,100 0,0 50,50" fill={PC_HORSE_COLORS[3].hex} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[3.2vw]" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }}>🏆</span>
        </div>
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
