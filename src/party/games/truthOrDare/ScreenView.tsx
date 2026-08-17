import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { Avatar } from '../../../components/Avatar'
import { CHOICE_LABEL, CHOICE_ICON } from './types'
import type { TruthOrDareClientState } from './types'
import type { Member } from '../../../types'

export function TruthOrDareScreen() {
  const group = usePartyStore((s) => s.group)

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const { party, members } = group
  const state = party.roundData as TruthOrDareClientState | null

  return (
    <div className="tv-frame">
      {party.status === 'ended' && <FinalPodium members={members} />}

      {party.status !== 'ended' && party.phase === 'choosing' && state && (
        <ChoosingScreen state={state} members={members} />
      )}

      {party.status !== 'ended' && party.phase === 'revealed' && state && (
        <RevealedScreen state={state} members={members} />
      )}

      {party.status !== 'ended' && party.phase === 'result' && state && (
        <ResultScreen state={state} members={members} />
      )}

      {party.status !== 'ended' && !party.phase && (
        <p className="text-chalk-faint text-2xl">Préparation…</p>
      )}
    </div>
  )
}

function ChoosingScreen({ state, members }: { state: TruthOrDareClientState; members: Member[] }) {
  const current = members.find((m) => m.id === state.currentMemberId)
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`choose-${state.turnIndex}`}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-4xl"
      >
        <p className="text-chalk-faint text-xl uppercase tracking-widest mb-6">
          Tour {state.history.length + 1} / {state.totalRounds}
        </p>

        <div className="flex flex-col items-center gap-3 mb-8">
          <Avatar pseudo={current?.pseudo ?? '?'} color={current?.color ?? '#fff'} size={80} photoUrl={current?.photoUrl} />
          <p className="text-3xl font-extrabold shimmer-text">{current?.pseudo}</p>
        </div>

        <p className="text-5xl font-extrabold mb-8">Action ou Vérité ?</p>

        {state.forcedChoice && (
          <p className="text-xl text-amber-300/90 bg-amber-500/10 rounded-full px-5 py-2 inline-block">
            🔥 {CHOICE_LABEL[state.forcedChoice]} imposé·e (streak !)
          </p>
        )}

        <div className="flex gap-8 justify-center mt-8">
          <div className={`rounded-2xl border p-8 flex flex-col items-center gap-3 ${
            state.forcedChoice === null || state.forcedChoice === 'truth' ? 'border-sky-400/30 bg-sky-500/10' : 'border-line bg-felt-sunken opacity-40'
          }`}>
            <span className="text-6xl">🗣️</span>
            <span className="text-2xl font-bold text-sky-200">Vérité</span>
          </div>
          <div className={`rounded-2xl border p-8 flex flex-col items-center gap-3 ${
            state.forcedChoice === null || state.forcedChoice === 'dare' ? 'border-fuchsia-400/30 bg-fuchsia-500/10' : 'border-line bg-felt-sunken opacity-40'
          }`}>
            <span className="text-6xl">🎯</span>
            <span className="text-2xl font-bold text-fuchsia-200">Action</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function RevealedScreen({ state, members }: { state: TruthOrDareClientState; members: Member[] }) {
  const current = members.find((m) => m.id === state.currentMemberId)
  const voteCount = Object.keys(state.votes).length
  const approveCount = Object.values(state.votes).filter(Boolean).length
  const totalVoters = members.length - 1

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state.currentCard?.id}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-4xl"
      >
        <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">
          Tour {state.history.length + 1} / {state.totalRounds}
        </p>

        <div className="flex flex-col items-center gap-2 mb-6">
          <Avatar pseudo={current?.pseudo ?? '?'} color={current?.color ?? '#fff'} size={64} photoUrl={current?.photoUrl} />
          <p className="text-2xl font-bold">{current?.pseudo}</p>
          {state.currentCard && (
            <span className={`inline-block text-lg font-bold uppercase tracking-wider rounded-full px-4 py-1.5 ${
              state.currentCard.type === 'truth' ? 'text-sky-300/80 bg-sky-500/10' : 'text-fuchsia-300/80 bg-fuchsia-500/10'
            }`}>
              {CHOICE_ICON[state.currentCard.type]} {CHOICE_LABEL[state.currentCard.type]}
            </span>
          )}
        </div>

        <p className="text-4xl font-extrabold leading-tight mb-8">{state.currentCard?.text}</p>

        {/* Vote progress bar */}
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm text-chalk-faint mb-2">
            <span>Vote du groupe</span>
            <span>{voteCount} / {totalVoters} · {approveCount} ✅</span>
          </div>
          <div className="h-3 rounded-full bg-felt-raised overflow-hidden">
            <motion.div
              className="h-full bg-emerald-400"
              animate={{ width: `${totalVoters > 0 ? (voteCount / totalVoters) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function ResultScreen({ state, members }: { state: TruthOrDareClientState; members: Member[] }) {
  const lastEntry = state.history[state.history.length - 1]
  const current = members.find((m) => m.id === state.currentMemberId)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`result-${state.history.length}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-4xl"
      >
        <p className="text-chalk-faint text-xl uppercase tracking-widest mb-6">
          Tour {state.history.length} / {state.totalRounds}
        </p>

        {lastEntry && (
          <>
            <div className="flex flex-col items-center gap-2 mb-6">
              <Avatar pseudo={current?.pseudo ?? '?'} color={current?.color ?? '#fff'} size={64} photoUrl={current?.photoUrl} />
              <p className="text-2xl font-bold">{current?.pseudo}</p>
              <span className="text-sm text-chalk-soft">
                {CHOICE_ICON[lastEntry.choice]} {CHOICE_LABEL[lastEntry.choice]}
              </span>
            </div>
            <p className="text-2xl font-semibold text-chalk-soft mb-6">{lastEntry.cardText}</p>
            <p className={`text-5xl font-extrabold ${lastEntry.approved ? 'text-emerald-300' : 'text-pink-300'}`}>
              {lastEntry.approved ? '✅ Validé' : '👎 Refusé'}
            </p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members }: { members: Member[] }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="text-center max-w-4xl">
      <p className="text-chalk-faint text-2xl uppercase tracking-widest mb-8">Classement final</p>
      {ranked.map((m, i) => (
        <div key={m.id} className="flex items-center justify-center gap-3 mb-3">
          <span className="text-2xl font-bold w-8">{i + 1}</span>
          <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
          <span className="text-xl font-bold">{m.pseudo}</span>
          <span className="text-emerald-300 font-mono">{m.xp} XP</span>
        </div>
      ))}
    </div>
  )
}