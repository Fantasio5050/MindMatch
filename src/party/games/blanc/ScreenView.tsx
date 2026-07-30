import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { PodiumRow } from '../shared/PodiumRow'
import { fillBlank, type BlancClientState } from './types'
import type { Member } from '../../../types'

export function BlancScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const [confetti, setConfetti] = useState(0)
  const lastResults = useRef(-1)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null
  const state = (group?.party.roundData as BlancClientState | null) ?? null

  useEffect(() => {
    if (phase === 'results' && state && state.roundsPlayed !== lastResults.current) {
      lastResults.current = state.roundsPlayed
      const hasWinner = (state.results?.winnerEntryIndices.length ?? 0) > 0
      play(hasWinner ? 'win' : 'lose')
      if (hasWinner) setConfetti((n) => n + 1)
    }
  }, [phase, state, play])

  if (!group || !state) {
    return <div className="min-h-svh flex items-center justify-center"><p className="text-chalk-faint text-xl">Connexion à la salle…</p></div>
  }

  const participants = group.members.filter((m) => state.order.includes(m.id))

  if (status === 'ended') return <FinalPodium members={participants} scores={state.scores} rounds={state.roundsPlayed} />

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-12 py-10">
      <Confetti trigger={confetti} />
      {phase === 'intro' && <IntroScreen />}
      {phase === 'answering' && <AnsweringScreen state={state} participants={participants} />}
      {phase === 'voting' && <VotingScreen state={state} participants={participants} />}
      {phase === 'results' && <ResultsScreen state={state} members={participants} />}
    </div>
  )
}

function BlackCard({ text, size = 'text-4xl' }: { text: string; size?: string }) {
  return (
    <div className="rounded-3xl bg-[#141019] border border-line px-10 py-8 max-w-3xl shadow-2xl">
      <p className={`${size} font-extrabold leading-tight text-white`}>{text}</p>
    </div>
  )
}

function IntroScreen() {
  const rules = [
    ['🖊️', 'Une carte noire : une phrase à trou.'],
    ['🃏', 'Chacun pose sa carte blanche la plus drôle.'],
    ['🗳️', 'On vote pour la plus drôle (jamais la sienne).'],
    ['🏆', "L'auteur·rice de la gagnante marque un point."],
  ] as const
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl">
      <span className="text-7xl mb-4 inline-block">🖊️</span>
      <h1 className="text-6xl font-extrabold shimmer-text mb-8">Le Grand Blanc</h1>
      <div className="flex flex-col gap-4 items-start mx-auto w-fit">
        {rules.map(([emoji, text], i) => (
          <motion.p key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 * i }} className="text-2xl text-chalk-muted flex gap-3">
            <span>{emoji}</span>
            <span>{text}</span>
          </motion.p>
        ))}
      </div>
      <p className="text-chalk-faint text-xl mt-10">L'hôte distribue les cartes 📱</p>
    </motion.div>
  )
}

function AnsweringScreen({ state, participants }: { state: BlancClientState; participants: Member[] }) {
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-6">
        Manche {state.roundsPlayed + 1} / {state.totalRounds}
      </p>
      {state.currentPrompt && <BlackCard text={state.currentPrompt.text} />}
      <p className="text-2xl text-chalk-soft mt-10 mb-6">
        Choisissez votre carte sur le téléphone 📱 — {state.submittedCount}/{state.order.length}
      </p>
      <div className="flex flex-wrap gap-3 justify-center max-w-4xl">
        {participants.map((m) => (
          <div key={m.id} className="glass-card rounded-2xl px-5 py-3 bg-ink/40 flex items-center gap-2">
            <Avatar pseudo={m.pseudo} color={m.color} size={28} photoUrl={m.photoUrl} />
            <span className="text-lg">{m.pseudo}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VotingScreen({ state, participants }: { state: BlancClientState; participants: Member[] }) {
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">Votez pour la plus drôle</p>
      {state.currentPrompt && <BlackCard text={state.currentPrompt.text} size="text-3xl" />}
      <div className="flex flex-wrap gap-4 justify-center max-w-5xl mt-8">
        {state.plays.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.08 * i }}
            className="rounded-2xl bg-white text-[#1a1030] px-6 py-5 w-72 min-h-[7rem] flex items-center text-xl font-bold shadow-xl"
          >
            {p.text}
          </motion.div>
        ))}
      </div>
      <p className="text-2xl text-chalk-soft mt-8">
        {state.votedCount}/{state.order.length} ont voté 📱
      </p>
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {participants.map((m) => (
          <Avatar key={m.id} pseudo={m.pseudo} color={m.color} size={30} photoUrl={m.photoUrl} />
        ))}
      </div>
    </div>
  )
}

function ResultsScreen({ state, members }: { state: BlancClientState; members: Member[] }) {
  const r = state.results
  if (!r) return null
  const memberName = (id: string) => members.find((m) => m.id === id)?.pseudo ?? '?'
  const member = (id: string) => members.find((m) => m.id === id)
  const winnerIdx = r.winnerEntryIndices[0]
  const winner = winnerIdx !== undefined ? r.entries[winnerIdx] : null

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-6">Résultat de la manche</p>

      {winner ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={winnerIdx}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="rounded-3xl bg-white text-[#1a1030] px-10 py-8 max-w-3xl text-3xl font-extrabold leading-tight shadow-2xl ring-4 ring-amber-300/70">
              {fillBlank(r.promptText, winner.text)}
            </div>
            <div className="flex items-center gap-3 mt-5">
              <span className="text-3xl">🏆</span>
              {member(winner.authorId) && (
                <Avatar pseudo={memberName(winner.authorId)} color={member(winner.authorId)!.color} size={40} photoUrl={member(winner.authorId)!.photoUrl} />
              )}
              <span className="text-2xl font-bold">{memberName(winner.authorId)}</span>
              <span className="text-xl text-chalk-soft">· {r.votesByEntry[winnerIdx]} vote{r.votesByEntry[winnerIdx] > 1 ? 's' : ''}</span>
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <p className="text-2xl text-chalk-soft">Aucun vote cette manche…</p>
      )}

      <div className="flex flex-col gap-2 mt-10 w-full max-w-2xl">
        {r.entries.map((e, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-2 ${r.winnerEntryIndices.includes(i) ? 'bg-amber-300/10' : 'bg-ink/30'}`}>
            <span className="w-8 text-center text-chalk-soft tabular-nums text-lg">{r.votesByEntry[i]}</span>
            <span className="flex-1 text-chalk-muted">{e.text}</span>
            <span className="text-chalk-faint text-sm">{memberName(e.authorId)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinalPodium({ members, scores, rounds }: { members: Member[]; scores: Record<string, number>; rounds: number }) {
  const ranked = [...members].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12 text-center">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">Le Grand Blanc — {rounds} manche{rounds > 1 ? 's' : ''}</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <PodiumRow key={m.id} rank={i} total={ranked.length} width={480}>
            <span className="text-2xl font-bold w-8 text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-chalk-soft tabular-nums">{scores[m.id] ?? 0} 🏆</span>
          </PodiumRow>
        ))}
      </div>
    </div>
  )
}
