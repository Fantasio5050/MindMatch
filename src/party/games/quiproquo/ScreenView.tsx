import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { Avatar } from '../../../components/Avatar'
import type { QuiproquoClientState } from './types'
import type { Member } from '../../../types'

export function QuiproquoScreen() {
  const group = usePartyStore((s) => s.group)

  if (!group) {
    return <div className="min-h-svh flex items-center justify-center"><p className="text-chalk-faint text-xl">Connexion…</p></div>
  }

  const { party, members } = group
  const state = party.roundData as QuiproquoClientState | null

  if (!state) {
    return <div className="tv-frame flex items-center justify-center"><p className="text-chalk-faint text-2xl">Préparation…</p></div>
  }

  if (state.phase === 'ended') {
    return <FinalPodium members={members} scores={state.scores} />
  }

  if (state.phase === 'reveal-constraints') {
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6">
        <span className="text-6xl">🎭</span>
        <p className="text-4xl font-extrabold shimmer-text">Quiproquo</p>
        <p className="text-xl text-chalk-soft">Round {state.round} / {state.totalRounds}</p>
        <p className="text-lg text-chalk-faint">Regardez secrètement votre contrainte sur votre téléphone</p>
        <div className="grid grid-cols-4 gap-4 mt-4">
          {members.map(m => (
            <div key={m.id} className="flex flex-col items-center gap-2">
              <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
              <span className="text-xs">{m.pseudo}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (state.phase === 'discussion') {
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6">
        <p className="text-chalk-faint text-xl uppercase tracking-widest">Discussion libre</p>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl border border-violet-400/30 bg-violet-500/10 px-8 py-6 max-w-2xl text-center"
        >
          <p className="text-3xl font-extrabold">{state.topic}</p>
        </motion.div>
        <p className="text-lg text-chalk-faint mt-4">Chacun respecte sa contrainte secrète… Démasquez les autres !</p>
        <div className="grid grid-cols-4 gap-3 mt-6">
          {members.map(m => (
            <div key={m.id} className="flex flex-col items-center gap-1">
              <Avatar pseudo={m.pseudo} color={m.color} size={40} photoUrl={m.photoUrl} />
              <span className="text-xs">{m.pseudo}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (state.phase === 'guessing') {
    const totalGuesses = Object.values(state.allGuesses ?? {}).reduce((acc: number, g: Record<string, string>) => acc + Object.keys(g).length, 0)
    const totalNeeded = members.length * (members.length - 1)
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6">
        <span className="text-6xl">🔍</span>
        <p className="text-3xl font-extrabold shimmer-text">Devinez les contraintes</p>
        <div className="w-96 max-w-full">
          <div className="flex justify-between text-sm text-chalk-faint mb-2">
            <span>Progression</span>
            <span>{totalGuesses} / {totalNeeded}</span>
          </div>
          <div className="h-4 rounded-full bg-felt-raised overflow-hidden">
            <motion.div
              className="h-full bg-violet-400"
              animate={{ width: `${totalNeeded > 0 ? (totalGuesses / totalNeeded) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-6">
          {members.map(m => {
            const myGuesses = state.allGuesses?.[m.id] ?? {}
            const done = members.filter(t => t.id !== m.id).every(t => myGuesses[t.id])
            return (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <Avatar pseudo={m.pseudo} color={m.color} size={40} photoUrl={m.photoUrl} />
                <span className="text-xs">{m.pseudo}</span>
                {done && <span className="text-xs text-emerald-300">✓</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (state.phase === 'results') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`results-${state.round}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="tv-frame flex flex-col items-center justify-center gap-6"
        >
          <p className="text-3xl font-extrabold">Résultats du round {state.round}</p>
          <div className="flex flex-col gap-4 max-w-2xl">
            {state.results.map(r => {
              const m = members.find(mm => mm.id === r.memberId)
              const constraint = state.allConstraints.find(c => c.id === r.constraintId)
              return (
                <motion.div
                  key={r.memberId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${r.guessedCorrectly ? 'border-pink-400/30 bg-pink-500/10' : 'border-emerald-400/30 bg-emerald-500/10'}`}
                >
                  <Avatar pseudo={m?.pseudo ?? '?'} color={m?.color ?? '#fff'} size={48} photoUrl={m?.photoUrl} />
                  <div className="text-left flex-1">
                    <p className="text-lg font-bold">{m?.pseudo}</p>
                    <p className="text-sm text-chalk-soft">{constraint?.text}</p>
                  </div>
                  <span className={`text-2xl font-bold ${r.guessedCorrectly ? 'text-pink-300' : 'text-emerald-300'}`}>
                    {r.guessedCorrectly ? `👎 ${r.guessedBy.length}` : '🛡️'}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return <div className="tv-frame flex items-center justify-center"><p className="text-chalk-faint text-2xl">Chargement…</p></div>
}

function FinalPodium({ members, scores }: { members: Member[]; scores: Record<string, number> }) {
  const ranked = [...members].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
  return (
    <div className="tv-frame flex flex-col items-center justify-center gap-8">
      <span className="text-7xl">🎭</span>
      <p className="text-4xl font-extrabold shimmer-text">Classement final</p>
      <div className="flex flex-col gap-4">
        {ranked.map((m, i) => (
          <div key={m.id} className="flex items-center gap-4">
            <span className="text-3xl font-bold w-10 text-center">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={56} photoUrl={m.photoUrl} />
            <span className="text-2xl font-bold">{m.pseudo}</span>
            <span className="text-xl text-violet-300 font-mono">{scores[m.id] ?? 0} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}