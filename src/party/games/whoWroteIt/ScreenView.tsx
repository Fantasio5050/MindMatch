import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import type { WhoWroteItClientState } from './types'
import type { Member } from '../../../types'

export function WhoWroteItScreen() {
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
  const state = party.roundData as WhoWroteItClientState | null

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' && <FinalPodium members={members} />}

      {status !== 'ended' && phase === 'writing' && state && (
        <WritingScreen state={state} totalPlayers={members.length} />
      )}

      {status !== 'ended' && phase === 'guessing' && state && <GuessingScreen state={state} />}

      {status !== 'ended' && phase === 'reveal' && state && <RevealScreen state={state} members={members} />}

      {status !== 'ended' && !phase && <p className="text-white/40 text-2xl">Préparation de la manche…</p>}
    </div>
  )
}

function WritingScreen({ state, totalPlayers }: { state: WhoWroteItClientState; totalPlayers: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-4xl">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">
        Manche {state.history.length + 1} / {state.totalRounds}
      </p>
      <span className="text-8xl mb-6 inline-block">✍️</span>
      <h1 className="text-5xl font-extrabold leading-tight mb-10">{state.currentPrompt?.text}</h1>

      <div className="flex items-center justify-center gap-4">
        <div className="h-3 w-96 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
            animate={{ width: `${(state.submittedCount / totalPlayers) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-white/60 text-lg tabular-nums">
          {state.submittedCount}/{totalPlayers}
        </span>
      </div>
      <p className="text-white/30 text-lg mt-6">Écrivez sur votre téléphone 📱</p>
    </motion.div>
  )
}

function GuessingScreen({ state }: { state: WhoWroteItClientState }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-4xl">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">{state.currentPrompt?.text}</p>
      <h1 className="text-4xl font-extrabold shimmer-text mb-10">Qui a écrit quoi ?</h1>
      <div className="flex flex-col gap-4 mb-8">
        {state.entries.map((entry, i) => (
          <div key={i} className="glass-card rounded-2xl px-6 py-4 text-xl text-white/80">
            « {entry.text} »
          </div>
        ))}
      </div>
      <p className="text-white/30 text-lg">Devinez sur votre téléphone 📱</p>
    </motion.div>
  )
}

function RevealScreen({ state, members }: { state: WhoWroteItClientState; members: Member[] }) {
  const last = state.history[state.history.length - 1]
  return (
    <AnimatePresence mode="wait">
      <motion.div key={last?.prompt.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
        <p className="text-white/40 text-xl text-center uppercase tracking-widest mb-6">Les vrais auteurs</p>

        <div className="flex flex-col gap-4">
          {last?.entries.map((entry, i) => {
            const author = members.find((m) => m.id === entry.authorId)
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="flex items-center gap-4 glass-card rounded-2xl px-6 py-4"
              >
                <Avatar pseudo={author?.pseudo ?? '?'} color={author?.color ?? '#fff'} size={48} />
                <div className="flex-1 text-left">
                  <p className="text-lg font-bold">{author?.pseudo}</p>
                  <p className="text-white/60">« {entry.text} »</p>
                </div>
              </motion.div>
            )
          })}
        </div>
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
