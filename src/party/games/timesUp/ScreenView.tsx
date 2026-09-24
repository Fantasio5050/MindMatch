import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { Avatar } from '../../../components/Avatar'
import { useCountdown } from '../../useCountdown'
import { ROUND_LABELS, ROUND_DESCS } from './types'
import type { TimesUpClientState } from './types'
import type { Member } from '../../../types'

/**
 * La TV de Time's Up ne montre JAMAIS la carte à faire deviner : c'est l'écran que regardent ceux
 * qui devinent. Elle montre qui fait deviner, le chrono, et les cartes trouvées au fil du tour —
 * ce qui a déjà été deviné, donc plus rien à cacher.
 */
export function TimesUpScreen() {
  const group = usePartyStore((s) => s.group)
  const state = (group?.party.roundData as TimesUpClientState | null) ?? null
  const timeLeft = useCountdown(state?.timeLeft ?? 0, state?.turnSeq ?? -1, !!state?.turnActive)

  if (!group) {
    return <div className="min-h-svh flex items-center justify-center"><p className="text-chalk-faint text-xl">Connexion à la salle…</p></div>
  }
  const { members } = group
  if (!state) {
    return <div className="tv-frame"><p className="text-chalk-faint text-2xl">Les cartes se mélangent…</p></div>
  }
  if (state.phase === 'ended') {
    return <FinalPodium members={members} state={state} />
  }

  const describer = members.find((m) => m.id === state.currentDescriber?.memberId)
  const seconds = Math.ceil(timeLeft / 1000)
  const progress = state.totalCards > 0 ? state.foundCount / state.totalCards : 0

  if (state.betweenRounds) {
    const next = (state.round + 1) as 1 | 2 | 3
    return (
      <div className="tv-frame text-center gap-6">
        <p className="kicker text-tv-xs">Manche {state.round} bouclée</p>
        <p className="font-stage text-tv-2xl text-chalk">{ROUND_LABELS[next]}</p>
        <p className="text-tv-base text-chalk-soft max-w-3xl">{ROUND_DESCS[next]}</p>
      </div>
    )
  }

  return (
    <div className="tv-frame text-center gap-6">
      <p className="kicker text-tv-xs">{ROUND_LABELS[state.round]}</p>

      <div className="flex flex-col items-center gap-3">
        <Avatar pseudo={describer?.pseudo ?? '?'} color={describer?.color ?? '#888'} size="var(--tv-avatar-stage)" photoUrl={describer?.photoUrl} />
        <p className="font-stage text-tv-2xl text-chalk">
          {state.turnActive ? `${describer?.pseudo} ${state.round === 3 ? 'mime' : 'fait deviner'}` : `Au tour de ${describer?.pseudo}`}
        </p>
        {!state.turnActive && <p className="text-tv-base text-chalk-soft">{ROUND_DESCS[state.round]}</p>}
      </div>

      {state.turnActive && (
        <p className={`font-mono font-bold text-tv-3xl ${seconds <= 5 ? 'text-blood' : 'text-brass'}`}>{seconds}</p>
      )}

      <div className="flex flex-wrap justify-center gap-3 max-w-5xl min-h-[3rem]">
        <AnimatePresence>
          {state.foundThisTurn.map((t) => (
            <motion.span
              key={t}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-tv-sm text-jade bg-jade/10 border border-jade/30 rounded-chip px-4 py-1.5"
            >
              {t}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-3xl">
        <div className="h-3 rounded-chip bg-felt-raised overflow-hidden">
          <motion.div className="h-full bg-jade" animate={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-tv-xs text-chalk-soft mt-2">
          {state.foundCount} / {state.totalCards} cartes trouvées dans cette manche
        </p>
      </div>
    </div>
  )
}

function FinalPodium({ members, state }: { members: Member[]; state: TimesUpClientState }) {
  const ranked = members
    .filter((m) => state.turnOrder.includes(m.id))
    .sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
  return (
    <div className="tv-frame gap-8">
      <p className="kicker text-tv-xs">Trois manches jouées</p>
      <p className="font-stage text-tv-2xl text-chalk">Qui a le mieux fait deviner</p>
      <div className="flex flex-col gap-4">
        {ranked.map((m, i) => (
          <div key={m.id} className="flex items-center gap-4">
            <span className="text-tv-base font-bold w-10 text-center text-chalk-soft">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size="var(--tv-avatar-focus)" photoUrl={m.photoUrl} />
            <span className="text-tv-base font-bold text-chalk w-64">{m.pseudo}</span>
            <span className="text-tv-sm font-mono text-chalk-soft">{state.scores[m.id] ?? 0} cartes</span>
          </div>
        ))}
      </div>
    </div>
  )
}
