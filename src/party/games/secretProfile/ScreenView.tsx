import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { PodiumRow } from '../shared/PodiumRow'
import { Confetti } from '../../../components/Confetti'
import { TRAIT_MAP } from '../../../data/traits'
import { CLUE_PHRASES } from './types'
import type { SecretProfileClientState } from './types'
import type { Member } from '../../../types'

export function SecretProfileScreen() {
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
        <p className="text-chalk-faint text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const { party, members } = group
  const state = party.roundData as SecretProfileClientState | null

  return (
    <div className="tv-frame">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' && <FinalPodium members={members} />}

      {status !== 'ended' && phase === 'voting' && state && (
        <VotingScreen state={state} totalPlayers={members.length} />
      )}

      {status !== 'ended' && phase === 'reveal' && state && <RevealScreen state={state} members={members} />}

      {status !== 'ended' && !phase && <p className="text-chalk-faint text-2xl">Préparation de la manche…</p>}
    </div>
  )
}

function VotingScreen({ state, totalPlayers }: { state: SecretProfileClientState; totalPlayers: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-3xl">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">
        Manche {state.history.length + 1} / {state.totalRounds}
      </p>
      <span className="text-8xl mb-6 inline-block">🔍</span>
      <h1 className="text-5xl font-extrabold leading-tight mb-10">Qui est le profil secret ?</h1>

      <div className="flex flex-col gap-4 mb-10">
        {state.clueTraits.map((t) => (
          <div key={t} className="glass-card rounded-2xl px-6 py-4 text-2xl text-chalk-muted">
            {TRAIT_MAP[t].emoji} <b>{TRAIT_MAP[t].label}</b> — {CLUE_PHRASES[t]}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="h-3 w-96 rounded-full bg-felt-raised overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
            animate={{ width: `${(state.votedCount / totalPlayers) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-chalk-soft text-lg tabular-nums">
          {state.votedCount}/{totalPlayers}
        </span>
      </div>
      <p className="text-chalk-faint text-lg mt-6">Devinez sur votre téléphone 📱</p>
    </motion.div>
  )
}

function RevealScreen({ state, members }: { state: SecretProfileClientState; members: Member[] }) {
  const last = state.history[state.history.length - 1]
  const mystery = last ? members.find((m) => m.id === last.mysteryMemberId) : null
  const ranked = members.map((m) => ({ member: m, votes: last?.tally[m.id] ?? 0 })).sort((a, b) => b.votes - a.votes)
  const maxVotes = Math.max(1, ...ranked.map((r) => r.votes))

  return (
    <AnimatePresence mode="wait">
      <motion.div key={mystery?.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
        <p className="text-chalk-faint text-xl text-center uppercase tracking-widest mb-4">Le profil secret était…</p>

        {mystery && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.7 }}
            className="flex flex-col items-center mb-10"
          >
            <Avatar pseudo={mystery.pseudo} color={mystery.color} size={96} photoUrl={mystery.photoUrl} />
            <p className="text-4xl font-extrabold shimmer-text mt-4">{mystery.pseudo}</p>
          </motion.div>
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
              <Avatar pseudo={member.pseudo} color={member.color} size={40} photoUrl={member.photoUrl} />
              <span className="w-28 text-lg font-medium truncate">{member.pseudo}</span>
              <div className="flex-1 h-6 rounded-full bg-felt-raised overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${member.color}99, ${member.color})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(votes / maxVotes) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + 0.08 * i }}
                />
              </div>
              <span className="w-10 text-right text-lg tabular-nums text-chalk-soft">{votes}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members }: { members: Member[] }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="text-center">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">Partie terminée</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <PodiumRow key={m.id} rank={i} total={ranked.length} width={420}>
            <span className="text-2xl font-bold w-8 text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-chalk-soft tabular-nums">{m.xp} XP</span>
          </PodiumRow>
        ))}
      </div>
    </div>
  )
}
