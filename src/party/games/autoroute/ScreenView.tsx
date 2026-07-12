import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { CardFace } from '../pyramid/CardFace'
import { rankLabel } from '../pyramid/types'
import { ROAD_LENGTH } from './types'
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

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' && <FinalPodium members={members} totals={state?.totalSipsReceived ?? {}} />}

      {status !== 'ended' && phase === 'predicting' && state && (
        <PredictingScreen state={state} members={members} />
      )}

      {status !== 'ended' && phase === 'reveal' && state && <RevealScreen state={state} members={members} />}

      {status !== 'ended' && !phase && <p className="text-white/40 text-2xl">Préparation de la manche…</p>}
    </div>
  )
}

function PredictingScreen({ state, members }: { state: AutorouteClientState; members: Member[] }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-4xl">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">
        Manche {state.history.length + 1} / {state.totalRounds}
      </p>
      <span className="text-6xl mb-4 inline-block">🛣️</span>
      {state.referenceCard && (
        <div className="flex justify-center mb-6">
          <CardFace rank={state.referenceCard.rank} suit={state.referenceCard.suit} size={120} />
        </div>
      )}
      <h1 className="text-4xl font-extrabold leading-tight mb-10">La prochaine carte sera plus haute ou plus basse ?</h1>

      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="h-3 w-96 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
            animate={{ width: `${(state.votedCount / members.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-white/60 text-lg tabular-nums">
          {state.votedCount}/{members.length}
        </span>
      </div>
      <p className="text-white/30 text-lg">Pariez sur votre téléphone 📱</p>

      <RoadOverview members={members} progress={state.progress} />
    </motion.div>
  )
}

function RoadOverview({ members, progress }: { members: Member[]; progress: Record<string, number> }) {
  return (
    <div className="flex flex-col gap-2 mt-10 max-w-md mx-auto">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3">
          <Avatar pseudo={m.pseudo} color={m.color} size={28} />
          <div className="flex gap-1">
            {Array.from({ length: ROAD_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-6 h-2.5 rounded-full ${i < (progress[m.id] ?? 0) ? 'bg-gradient-to-r from-fuchsia-400 to-purple-400' : 'bg-white/10'}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function RevealScreen({ state, members }: { state: AutorouteClientState; members: Member[] }) {
  const last = state.history[state.history.length - 1]

  return (
    <AnimatePresence mode="wait">
      <motion.div key={last?.drawnCard.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl text-center">
        <div className="flex items-center justify-center gap-8 mb-8">
          {last && <CardFace rank={last.referenceCard.rank} suit={last.referenceCard.suit} size={110} />}
          <span className="text-4xl text-white/30">→</span>
          {last && (
            <motion.div initial={{ scale: 0.6, rotateY: 90 }} animate={{ scale: 1, rotateY: 0 }} transition={{ duration: 0.4 }}>
              <CardFace rank={last.drawnCard.rank} suit={last.drawnCard.suit} size={110} />
            </motion.div>
          )}
        </div>

        {last?.tie ? (
          <p className="text-white/50 text-2xl mb-8">
            Égalité ({rankLabel(last.referenceCard.rank)} = {rankLabel(last.drawnCard.rank)}) — manche annulée !
          </p>
        ) : (
          <p className="text-white/50 text-2xl mb-8">
            C'était plus {last && last.drawnCard.rank > last.referenceCard.rank ? 'haut ⬆️' : 'bas ⬇️'} !
          </p>
        )}

        <div className="flex flex-col gap-3">
          {members.map((m, i) => {
            const result = last?.results[m.id]
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i }}
                className="flex items-center gap-4"
              >
                <Avatar pseudo={m.pseudo} color={m.color} size={40} />
                <span className="w-32 text-lg font-medium truncate text-left">{m.pseudo}</span>
                <span className="flex-1 text-left">
                  {result ? (
                    <span className={result.correct ? 'text-emerald-300' : 'text-pink-300'}>
                      {result.correct
                        ? result.lapCompleted
                          ? '🏁 Termine la route !'
                          : `✅ Avance (${result.newProgress}/${ROAD_LENGTH})`
                        : `❌ Boit ${result.sipsOwed} gorgée${result.sipsOwed > 1 ? 's' : ''}`}
                    </span>
                  ) : (
                    <span className="text-white/30">N'a pas parié</span>
                  )}
                </span>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members, totals }: { members: Member[]; totals: Record<string, number> }) {
  const ranked = [...members].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0))
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
            className="flex items-center gap-4 glass-card rounded-2xl px-8 py-4 w-[420px]"
          >
            <span className="text-2xl font-bold w-8 text-white/50">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-white/60 tabular-nums">{totals[m.id] ?? 0} gorgées</span>
          </motion.div>
        ))}
      </div>
      <p className="text-white/30 text-lg mt-8">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
    </div>
  )
}
