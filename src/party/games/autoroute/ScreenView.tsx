import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { CardFace } from '../pyramid/CardFace'
import { TrackStrip } from './ControllerView'
import { QUESTION_META, choiceLabel } from './types'
import type { AutorouteClientState } from './types'
import type { Member } from '../../../types'

export function AutorouteScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null

  useEffect(() => {
    if (phase === 'reveal' && lastPhase.current !== 'reveal') {
      play('reveal')
      setConfettiTrigger((n) => n + 1)
    }
    lastPhase.current = phase
  }, [phase, play])

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const { party, members } = group
  const state = party.roundData as AutorouteClientState | null
  const participants = members.filter((m) => state && m.id in state.positions)

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' && state && <FinalPodium members={participants} state={state} />}

      {status !== 'ended' && phase === 'intro' && state && <IntroScreen trackLength={state.track.length} />}

      {status !== 'ended' && phase === 'predicting' && state && (
        <PredictingScreen state={state} participants={participants} />
      )}

      {status !== 'ended' && phase === 'reveal' && state && <RevealScreen state={state} participants={participants} />}

      {status !== 'ended' && !phase && <p className="text-white/40 text-2xl">Préparation de la manche…</p>}
    </div>
  )
}

function IntroScreen({ trackLength }: { trackLength: number }) {
  const rules = [
    ['🔁', 'Plus haut/plus bas → Rouge/noir → Inter/Exter — puis le cycle recommence'],
    ['💰', 'Péage : passage obligatoire, 1 gorgée'],
    ['❌', "Raté : 1 gorgée et on recule d'une case (égalité = perdu)"],
    ['🏁', "Objectif : atteindre le bout de l'autoroute"],
  ] as const

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-3xl">
      <span className="text-7xl mb-4 inline-block">🛣️</span>
      <h1 className="text-5xl font-extrabold shimmer-text mb-3">Autoroute</h1>
      <p className="text-white/50 text-2xl mb-10">{trackLength} cases jusqu'à l'arrivée</p>
      <div className="flex flex-col gap-4 items-start mx-auto w-fit">
        {rules.map(([emoji, text], i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 * i }}
            className="text-2xl text-white/80 flex gap-3"
          >
            <span>{emoji}</span>
            <span>{text}</span>
          </motion.p>
        ))}
      </div>
      <p className="text-white/30 text-xl mt-10">L'hôte donne le départ sur son téléphone 📱</p>
    </motion.div>
  )
}

function PredictingScreen({ state, participants }: { state: AutorouteClientState; participants: Member[] }) {
  const activeCount = participants.filter((m) => !state.finished[m.id]).length

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-5xl w-full">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-6">Manche {state.history.length + 1}</p>
      <span className="text-6xl mb-8 inline-block">🛣️</span>

      <div className="mb-10 scale-150 origin-center">
        <TrackStrip track={state.track} positions={state.positions} finished={state.finished} members={participants} cellSize={18} />
      </div>

      <div className="flex flex-col gap-3 items-center mb-10 mt-16">
        {participants
          .filter((m) => !state.finished[m.id])
          .map((m) => {
            const cell = state.track[state.positions[m.id] ?? 0]
            return (
              <div key={m.id} className="flex items-center gap-4">
                <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
                <span className="w-40 text-lg font-medium truncate text-left">{m.pseudo}</span>
                <span className="text-white/50 text-lg">
                  {cell?.type === 'question' ? QUESTION_META[cell.kind].title : '💰 Péage'}
                </span>
              </div>
            )
          })}
      </div>

      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="h-3 w-96 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
            animate={{ width: `${activeCount > 0 ? (state.votedCount / activeCount) * 100 : 0}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-white/60 text-lg tabular-nums">
          {state.votedCount}/{activeCount}
        </span>
      </div>
      <p className="text-white/30 text-lg">Chacun répond à SA question sur son téléphone 📱</p>
    </motion.div>
  )
}

function RevealScreen({ state, participants }: { state: AutorouteClientState; participants: Member[] }) {
  const last = state.history[state.history.length - 1]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state.history.length}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl text-center"
      >
        <p className="text-white/40 text-xl uppercase tracking-widest mb-8">Résultats de la manche</p>

        <div className="mb-10 scale-150 origin-center">
          <TrackStrip track={state.track} positions={state.positions} finished={state.finished} members={participants} cellSize={18} />
        </div>

        <div className="flex flex-col gap-4 mt-16">
          {participants.map((m, i) => {
            const result = last?.results[m.id]
            if (!result) {
              if (!state.finished[m.id]) return null
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i }}
                  className="flex items-center gap-4 opacity-50"
                >
                  <Avatar pseudo={m.pseudo} color={m.color} size={40} photoUrl={m.photoUrl} />
                  <span className="w-40 text-lg font-medium truncate text-left">{m.pseudo}</span>
                  <span className="text-white/40 text-lg">🏁 Déjà arrivé·e</span>
                </motion.div>
              )
            }
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i }}
                className="flex items-center gap-4"
              >
                <Avatar pseudo={m.pseudo} color={m.color} size={40} photoUrl={m.photoUrl} />
                <span className="w-40 text-lg font-medium truncate text-left">{m.pseudo}</span>
                <motion.div initial={{ scale: 0.6, rotateY: 90 }} animate={{ scale: 1, rotateY: 0 }} transition={{ duration: 0.4, delay: 0.1 + 0.08 * i }}>
                  <CardFace rank={result.drawnCard.rank} suit={result.drawnCard.suit} size={48} />
                </motion.div>
                <span className="flex-1 text-left text-lg">
                  <span className="text-white/40 mr-3">{choiceLabel(result.choice)}</span>
                  <span className={result.correct ? 'text-emerald-300' : 'text-pink-300'}>
                    {result.finished
                      ? "🏁 Franchit l'arrivée !"
                      : result.correct
                        ? result.tollSips > 0
                          ? `✅ Avance — péage ${result.tollSips} gorgée${result.tollSips > 1 ? 's' : ''} 💰`
                          : '✅ Avance'
                        : "❌ Boit 1 gorgée et recule d'une case"}
                  </span>
                </span>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members, state }: { members: Member[]; state: AutorouteClientState }) {
  const totals = state.totalSipsReceived
  const ranked = [...members].sort((a, b) => {
    const fa = state.finishOrder.indexOf(a.id)
    const fb = state.finishOrder.indexOf(b.id)
    if (fa !== -1 && fb !== -1) return fa - fb
    if (fa !== -1) return -1
    if (fb !== -1) return 1
    return (totals[a.id] ?? 0) - (totals[b.id] ?? 0)
  })

  return (
    <div className="text-center">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Autoroute terminée</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🛣️ Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="flex items-center gap-4 glass-card rounded-2xl px-8 py-4 w-[460px]"
          >
            <span className="text-2xl font-bold w-8 text-white/50">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-white/60 tabular-nums">
              {totals[m.id] ?? 0} gorgée{(totals[m.id] ?? 0) !== 1 ? 's' : ''}
            </span>
          </motion.div>
        ))}
      </div>
      <p className="text-white/30 text-lg mt-8">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
    </div>
  )
}
