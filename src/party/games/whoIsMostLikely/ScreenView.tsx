import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import type { WhoIsMostLikelyClientState } from './types'

export function WhoIsMostLikelyScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null

  useEffect(() => {
    if (phase === 'reveal' && lastPhase.current !== 'reveal') {
      play('win')
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
  const state = party.roundData as WhoIsMostLikelyClientState | null

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' && <FinalPodium members={members} />}

      {status !== 'ended' && phase === 'voting' && state && (
        <VotingScreen state={state} totalPlayers={members.length} />
      )}

      {status !== 'ended' && phase === 'reveal' && state && <RevealScreen state={state} members={members} />}

      {status !== 'ended' && !phase && (
        <p className="text-white/40 text-2xl">Préparation de la manche…</p>
      )}
    </div>
  )
}

function VotingScreen({ state, totalPlayers }: { state: WhoIsMostLikelyClientState; totalPlayers: number }) {
  return (
    <motion.div
      key={state.currentQuestion?.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center max-w-4xl"
    >
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">
        Manche {state.history.length + 1} / {state.totalRounds}
      </p>
      <span className="text-8xl mb-6 inline-block">{state.currentQuestion?.emoji}</span>
      <h1 className="text-5xl font-extrabold leading-tight mb-10">Qui est {state.currentQuestion?.text}</h1>

      <div className="flex items-center justify-center gap-4">
        <div className="h-3 w-96 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
            animate={{ width: `${(state.votedCount / totalPlayers) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-white/60 text-lg tabular-nums">
          {state.votedCount}/{totalPlayers}
        </span>
      </div>
      <p className="text-white/30 text-lg mt-6">Votez sur votre téléphone 📱</p>
    </motion.div>
  )
}

function RevealScreen({
  state,
  members,
}: {
  state: WhoIsMostLikelyClientState
  members: { id: string; pseudo: string; color: string }[]
}) {
  const last = state.history[state.history.length - 1]
  const winner = last?.winnerId ? members.find((m) => m.id === last.winnerId) : null
  const ranked = members.map((m) => ({ member: m, votes: last?.tally[m.id] ?? 0 })).sort((a, b) => b.votes - a.votes)
  const maxVotes = Math.max(1, ...ranked.map((r) => r.votes))

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={last?.question.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl"
      >
        <p className="text-white/40 text-xl text-center uppercase tracking-widest mb-4">
          {last?.question.text}
        </p>

        {winner ? (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.7 }}
            className="flex flex-col items-center mb-10"
          >
            <Avatar pseudo={winner.pseudo} color={winner.color} size={96} />
            <p className="text-4xl font-extrabold shimmer-text mt-4">{winner.pseudo}</p>
          </motion.div>
        ) : (
          <p className="text-center text-white/50 text-2xl mb-10">Égalité parfaite !</p>
        )}

        <div className="flex flex-col gap-3">
          {ranked.map(({ member, votes }, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i }}
              className="flex items-center gap-4"
            >
              <Avatar pseudo={member.pseudo} color={member.color} size={40} />
              <span className="w-28 text-lg font-medium truncate">{member.pseudo}</span>
              <div className="flex-1 h-6 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${member.color}99, ${member.color})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(votes / maxVotes) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + 0.08 * i }}
                />
              </div>
              <span className="w-10 text-right text-lg tabular-nums text-white/60">{votes}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members }: { members: { id: string; pseudo: string; color: string; xp: number }[] }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="text-center">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Partie terminée</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
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
            <span className="text-lg text-white/60 tabular-nums">{m.xp} XP</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
