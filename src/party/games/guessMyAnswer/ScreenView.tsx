import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { PodiumRow } from '../shared/PodiumRow'
import { Confetti } from '../../../components/Confetti'
import type { GuessMyAnswerClientState } from './types'
import type { Member } from '../../../types'

export function GuessMyAnswerScreen() {
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
  const state = party.roundData as GuessMyAnswerClientState | null

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' && <FinalPodium members={members} />}

      {status !== 'ended' && phase === 'voting' && state && (
        <VotingScreen state={state} members={members} />
      )}

      {status !== 'ended' && phase === 'reveal' && state && <RevealScreen state={state} members={members} />}

      {status !== 'ended' && !phase && <p className="text-white/40 text-2xl">Préparation de la manche…</p>}
    </div>
  )
}

function VotingScreen({ state, members }: { state: GuessMyAnswerClientState; members: Member[] }) {
  const target = members.find((m) => m.id === state.targetMemberId)
  const expectedVoters = Math.max(members.length - 1, 1)

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
      <div className="flex flex-col items-center gap-3 mb-6">
        <Avatar pseudo={target?.pseudo ?? '?'} color={target?.color ?? '#fff'} size={72} photoUrl={target?.photoUrl} />
        <h1 className="text-4xl font-extrabold leading-tight">
          Que répondrait <span className="shimmer-text">{target?.pseudo}</span> ?
        </h1>
      </div>
      <p className="text-2xl text-white/70 mb-10">{state.currentQuestion?.prompt}</p>

      <div className="flex items-center justify-center gap-4">
        <div className="h-3 w-96 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
            animate={{ width: `${(state.votedCount / expectedVoters) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-white/60 text-lg tabular-nums">
          {state.votedCount}/{expectedVoters}
        </span>
      </div>
      <p className="text-white/30 text-lg mt-6">Devinez sur votre téléphone 📱</p>
    </motion.div>
  )
}

function RevealScreen({ state, members }: { state: GuessMyAnswerClientState; members: Member[] }) {
  const last = state.history[state.history.length - 1]
  const target = last ? members.find((m) => m.id === last.targetMemberId) : null
  const correctOption = last?.question.options.find((o) => o.id === last.correctOptionId)
  const correctGuessers = members.filter((m) => last?.correctGuesserIds.includes(m.id))

  return (
    <AnimatePresence mode="wait">
      <motion.div key={last?.question.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
        <p className="text-white/40 text-xl text-center uppercase tracking-widest mb-4">
          La vraie réponse de {target?.pseudo}
        </p>

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.7 }}
          className="flex flex-col items-center mb-10"
        >
          <span className="text-6xl mb-3">{correctOption?.emoji}</span>
          <p className="text-4xl font-extrabold shimmer-text text-center">{correctOption?.label}</p>
        </motion.div>

        <p className="text-white/40 text-xl text-center uppercase tracking-widest mb-4">Ont deviné juste</p>
        {correctGuessers.length > 0 ? (
          <div className="flex flex-wrap gap-4 justify-center">
            {correctGuessers.map((m) => (
              <div key={m.id} className="flex items-center gap-2 glass-card rounded-full pl-1.5 pr-4 py-2">
                <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
                <span className="text-lg font-medium">{m.pseudo}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-white/50 text-2xl">Personne n'a trouvé cette fois !</p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members }: { members: Member[] }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="text-center">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Partie terminée</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <PodiumRow key={m.id} rank={i} total={ranked.length} width={420}>
            <span className="text-2xl font-bold w-8 text-white/50">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-white/60 tabular-nums">{m.xp} XP</span>
          </PodiumRow>
        ))}
      </div>
    </div>
  )
}
