import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import type { DilemmasClientState } from './types'

export function DilemmasScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null

  useEffect(() => {
    if (phase === 'reveal' && lastPhase.current !== 'reveal') play('reveal')
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
  const state = party.roundData as DilemmasClientState | null

  return (
    <div className="tv-frame">
      {status === 'ended' && (
        <div className="text-center">
          <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">Débat terminé</p>
          <h1 className="text-6xl font-extrabold shimmer-text">⚖️ Merci d'avoir débattu !</h1>
        </div>
      )}

      {status !== 'ended' && phase === 'voting' && state && (
        <VotingScreen state={state} totalPlayers={members.length} />
      )}

      {status !== 'ended' && phase === 'reveal' && state && <RevealScreen state={state} />}

      {status !== 'ended' && !phase && <p className="text-chalk-faint text-2xl">Préparation du dilemme…</p>}
    </div>
  )
}

function VotingScreen({ state, totalPlayers }: { state: DilemmasClientState; totalPlayers: number }) {
  const d = state.currentDilemma
  return (
    <motion.div
      key={d?.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center max-w-5xl w-full"
    >
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-8">
        Dilemme {state.history.length + 1} / {state.totalRounds}
      </p>

      <div className="flex items-stretch gap-8 mb-10">
        <div className="flex-1 glass-card rounded-3xl p-10">
          <span className="text-6xl mb-4 block">{d?.emojiA}</span>
          <p className="text-3xl font-bold leading-snug">{d?.textA}</p>
        </div>
        <div className="flex items-center text-chalk-faint text-3xl font-bold">OU</div>
        <div className="flex-1 glass-card rounded-3xl p-10">
          <span className="text-6xl mb-4 block">{d?.emojiB}</span>
          <p className="text-3xl font-bold leading-snug">{d?.textB}</p>
        </div>
      </div>

      <p className="text-chalk-faint text-xl">
        {state.votedCount}/{totalPlayers} ont voté · Votez sur votre téléphone 📱
      </p>
    </motion.div>
  )
}

function RevealScreen({ state }: { state: DilemmasClientState }) {
  const last = state.history[state.history.length - 1]
  const total = (last?.tallyA ?? 0) + (last?.tallyB ?? 0) || 1
  const pctA = Math.round(((last?.tallyA ?? 0) / total) * 100)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={last?.dilemma.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <div className="flex items-center justify-between text-2xl font-bold mb-3">
          <span>{last?.dilemma.emojiA} {last?.dilemma.textA}</span>
          <span>{last?.dilemma.textB} {last?.dilemma.emojiB}</span>
        </div>
        <div className="h-10 w-full rounded-full bg-felt-raised overflow-hidden flex mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-fuchsia-400 to-fuchsia-500 flex items-center justify-end pr-3"
            initial={{ width: 0 }}
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 0.7 }}
          >
            {pctA > 12 && <span className="text-lg font-bold">{pctA}%</span>}
          </motion.div>
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-sky-400 flex items-center pl-3"
            initial={{ width: 0 }}
            animate={{ width: `${100 - pctA}%` }}
            transition={{ duration: 0.7 }}
          >
            {100 - pctA > 12 && <span className="text-lg font-bold">{100 - pctA}%</span>}
          </motion.div>
        </div>
        <p className="text-center text-chalk-soft text-xl">
          {last?.tallyA} vote{last && last.tallyA !== 1 ? 's' : ''} vs {last?.tallyB} vote{last && last.tallyB !== 1 ? 's' : ''}
        </p>
      </motion.div>
    </AnimatePresence>
  )
}
