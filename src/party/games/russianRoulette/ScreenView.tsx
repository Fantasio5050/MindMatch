import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { PodiumRow } from '../shared/PodiumRow'
import { CHAMBER_COUNT } from '../../../data/russianRoulette'
import type { RussianRouletteClientState } from './types'
import type { Member } from '../../../types'

export function RussianRouletteScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null
  const state = (group?.party.roundData as RussianRouletteClientState | null) ?? null

  const [flash, setFlash] = useState(0)
  const lastPulls = useRef(-1)
  useEffect(() => {
    if (!state) return
    if (state.pullsDone !== lastPulls.current) {
      lastPulls.current = state.pullsDone
      if (state.lastPull?.bang) {
        play('lose')
        setFlash((n) => n + 1)
      } else if (state.lastPull) {
        play('tick')
      }
    }
  }, [state, play])

  if (!group || !state) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const memberName = (id: string) => group.members.find((m) => m.id === id)?.pseudo ?? '?'
  const participants = group.members.filter((m) => state.order.includes(m.id))

  if (status === 'ended') return <FinalPodium members={participants} state={state} />

  const currentId = state.order[state.currentIndex]
  const oddsDenom = Math.max(1, CHAMBER_COUNT - state.chamber)
  const isBang = phase === 'result' && state.lastPull?.bang

  return (
    <div className="relative tv-frame overflow-hidden">
      {/* Flash rouge au BANG */}
      <AnimatePresence>
        {isBang && (
          <motion.div
            key={flash}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0 bg-red-600 pointer-events-none z-20"
          />
        )}
      </AnimatePresence>

      {phase === 'intro' && <IntroScreen />}

      {phase === 'turn' && (
        <motion.div
          animate={isBang ? {} : { x: [0, -2, 2, 0] }}
          transition={{ repeat: Infinity, duration: 0.3 }}
          className="text-center"
        >
          {state.lastPull && !state.lastPull.bang && (
            <motion.p key={state.pullsDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-300 text-2xl mb-6">
              *clic* — {memberName(state.lastPull.pullerId)} a survécu 😮‍💨
            </motion.p>
          )}
          <motion.span
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-9xl inline-block"
          >
            🔫
          </motion.span>
          <h1 className="text-6xl font-extrabold mt-6 mb-3">
            Au tour de <span className="shimmer-text">{memberName(currentId)}</span>
          </h1>
          <p className="text-chalk-soft text-2xl">Chambre {state.chamber + 1}/{CHAMBER_COUNT} — risque 1 sur {oddsDenom}</p>
          <p className="text-chalk-faint text-xl mt-6">Appuie sur ton téléphone 📱</p>
        </motion.div>
      )}

      {isBang && state.lastPull && (
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
          className="relative z-30 text-center max-w-3xl"
        >
          <span className="text-9xl">💥</span>
          <h1 className="text-8xl font-extrabold text-red-400 mb-4">BANG !</h1>
          <p className="text-4xl font-bold mb-6">{memberName(state.lastPull.pullerId)} prend la balle</p>
          {state.lastPull.gageText && (
            <div className="glass-card rounded-3xl px-10 py-6 bg-ink/50">
              <p className="text-chalk-faint uppercase tracking-widest text-lg mb-2">Gage hardcore</p>
              <p className="text-3xl font-semibold">« {state.lastPull.gageText} »</p>
            </div>
          )}
          {state.lastPull.gageDone !== null && (
            <p className={`text-3xl font-bold mt-6 ${state.lastPull.gageDone ? 'text-emerald-300' : 'text-pink-300'}`}>
              {state.lastPull.gageDone ? '✅ Gage relevé !' : '🥃 Cul sec !'}
            </p>
          )}
        </motion.div>
      )}

      {/* Compteur de gorgées, toujours visible */}
      {phase !== 'intro' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-wrap gap-4 justify-center max-w-5xl">
          {participants.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl px-4 py-2 bg-ink/40 flex items-center gap-2">
              <Avatar pseudo={m.pseudo} color={m.color} size={26} photoUrl={m.photoUrl} />
              <span className="text-base font-medium">{m.pseudo}</span>
              {(state.bangs[m.id] ?? 0) > 0 && <span className="text-sm">💥{state.bangs[m.id]}</span>}
              <span className="text-chalk-soft tabular-nums">{state.totalSips[m.id] ?? 0} 🍻</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IntroScreen() {
  const rules = [
    ['🔫', 'Un barillet, 6 chambres, une seule balle.'],
    ['📈', 'À chaque clic survécu, les chances de BANG montent.'],
    ['💥', 'BANG = gage hardcore ou cul sec de 6 gorgées.'],
    ['🏆', 'Le·la moins imbibé·e à la fin a survécu.'],
  ] as const
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl px-12 py-10 max-w-2xl bg-ink/40 text-center">
      <span className="text-8xl">🔫</span>
      <h1 className="text-5xl font-extrabold shimmer-text mt-3 mb-6">Roulette russe</h1>
      <div className="flex flex-col gap-3 text-2xl text-chalk-muted text-left">
        {rules.map(([e, t], i) => (
          <motion.p key={i} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 * i }} className="flex gap-3">
            <span>{e}</span>
            <span>{t}</span>
          </motion.p>
        ))}
      </div>
      <p className="text-chalk-faint text-xl mt-6">L'hôte charge le barillet 📱</p>
    </motion.div>
  )
}

function FinalPodium({ members, state }: { members: Member[]; state: RussianRouletteClientState }) {
  const ranked = [...members].sort((a, b) => (state.totalSips[a.id] ?? 0) - (state.totalSips[b.id] ?? 0))
  return (
    <div className="tv-frame text-center">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">
        Roulette russe — {state.barrelsUsed} barillet{state.barrelsUsed > 1 ? 's' : ''}
      </p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Survivants</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <PodiumRow key={m.id} rank={i} total={ranked.length} width={520} loserEmoji="🍺">
            <span className="text-2xl font-bold w-8 text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-chalk-soft text-lg">💥 {state.bangs[m.id] ?? 0}</span>
            <span className="text-lg text-chalk-soft tabular-nums">{state.totalSips[m.id] ?? 0} 🍻</span>
          </PodiumRow>
        ))}
      </div>
      <p className="text-chalk-faint text-lg mt-8">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
    </div>
  )
}
