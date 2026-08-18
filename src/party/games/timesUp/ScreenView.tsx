import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { Avatar } from '../../../components/Avatar'
import { ROUND_LABELS } from './types'
import type { TimesUpClientState } from './types'
import type { Member } from '../../../types'

export function TimesUpScreen() {
  const group = usePartyStore((s) => s.group)

  if (!group) {
    return <div className="min-h-svh flex items-center justify-center"><p className="text-chalk-faint text-xl">Connexion à la salle…</p></div>
  }

  const { party, members } = group
  const state = party.roundData as TimesUpClientState | null

  if (!state) {
    return <div className="tv-frame flex items-center justify-center"><p className="text-chalk-faint text-2xl">Préparation…</p></div>
  }

  if (state.phase === 'ended') {
    return <FinalPodium members={members} scores={state.scores} />
  }

  const describer = members.find(m => m.id === state.currentDescriber?.memberId)

  // Intro / between rounds
  if (!state.currentDescriber) {
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6">
        <span className="text-7xl">⏰</span>
        <p className="text-4xl font-extrabold shimmer-text">Time's Up</p>
        <p className="text-2xl text-chalk-soft">{ROUND_LABELS[state.round]}</p>
        <p className="text-lg text-chalk-faint">{state.totalCards || state.cardsRemaining} cartes à deviner</p>
      </div>
    )
  }

  // Active turn
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${state.round}-${state.currentDescriber?.memberId}-${state.currentCard?.id}`}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="tv-frame flex flex-col items-center justify-center gap-6"
      >
        <p className="text-chalk-faint text-xl uppercase tracking-widest">{ROUND_LABELS[state.round]}</p>

        <div className="flex flex-col items-center gap-3">
          <Avatar pseudo={describer?.pseudo ?? '?'} color={describer?.color ?? '#fff'} size={80} photoUrl={describer?.photoUrl} />
          <p className="text-3xl font-extrabold shimmer-text">{describer?.pseudo}</p>
        </div>

        {state.currentCard && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-8 py-6"
          >
            <p className="text-4xl font-extrabold">{state.currentCard.text}</p>
          </motion.div>
        )}

        {/* Timer ring */}
        <div className="relative w-24 h-24 mt-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-felt-raised" />
            <motion.circle
              cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
              className={state.timeLeft <= 5 ? 'text-red-400' : 'text-amber-400'}
              strokeDasharray={283}
              animate={{ strokeDashoffset: 283 - (283 * state.timeLeft) / 30 }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-2xl font-mono font-bold ${state.timeLeft <= 5 ? 'text-red-400' : 'text-amber-300'}`}>
            {state.timeLeft}s
          </span>
        </div>

        {/* Found this turn */}
        {state.lastFound && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg text-emerald-300"
          >
            ✅ {state.lastFound}
          </motion.p>
        )}

        {/* Round progress */}
        <div className="flex gap-2 mt-4">
          {Array.from({ length: state.totalCards }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${i < (state.foundCards?.length ?? 0) ? 'bg-emerald-400' : 'bg-felt-raised'}`}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members, scores }: { members: Member[]; scores: Record<string, number> }) {
  const ranked = [...members].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
  return (
    <div className="tv-frame flex flex-col items-center justify-center gap-8">
      <span className="text-7xl">🏆</span>
      <p className="text-4xl font-extrabold shimmer-text">Classement final</p>
      <div className="flex flex-col gap-4">
        {ranked.map((m, i) => (
          <div key={m.id} className="flex items-center gap-4">
            <span className="text-3xl font-bold w-10 text-center">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={56} photoUrl={m.photoUrl} />
            <span className="text-2xl font-bold">{m.pseudo}</span>
            <span className="text-xl text-emerald-300 font-mono">{scores[m.id] ?? 0} cartes</span>
          </div>
        ))}
      </div>
    </div>
  )
}