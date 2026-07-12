import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import type { DilemmasClientState } from './types'

export function DilemmasController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const phase = group?.party.phase ?? null

  useEffect(() => {
    if (phase === 'reveal' && lastPhase.current !== 'reveal') play('reveal')
    lastPhase.current = phase
  }, [phase, play])

  if (!group || !currentMember) return null
  const { party } = group
  const state = party.roundData as DilemmasClientState

  if (party.status === 'ended') {
    return <FinalResults members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'voting') {
    return (
      <VotingView state={state} onVote={(side) => { play('vote'); sendAction('vote', { side }) }} />
    )
  }

  if (party.phase === 'reveal') {
    return <RevealView state={state} isHost={isHost} onNext={() => hostAdvance()} />
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-white/50 text-sm">Préparation du dilemme…</p>
    </div>
  )
}

function VotingView({ state, onVote }: { state: DilemmasClientState; onVote: (side: 'A' | 'B') => void }) {
  const hasVoted = !!state.yourVote
  const d = state.currentDilemma

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-6">
        Dilemme {state.history.length + 1} / {state.totalRounds}
      </p>

      {hasVoted ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold mb-1">Vote enregistré</p>
          <p className="text-white/50 text-sm">
            En attente des autres… ({state.votedCount})
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onVote('A')}
            className="glass-card rounded-3xl p-6 text-center border border-fuchsia-400/20"
          >
            <span className="text-4xl mb-3 block">{d?.emojiA}</span>
            <p className="text-lg font-bold leading-snug">{d?.textA}</p>
          </motion.button>

          <p className="text-center text-white/30 text-sm font-bold">OU</p>

          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onVote('B')}
            className="glass-card rounded-3xl p-6 text-center border border-sky-400/20"
          >
            <span className="text-4xl mb-3 block">{d?.emojiB}</span>
            <p className="text-lg font-bold leading-snug">{d?.textB}</p>
          </motion.button>
        </div>
      )}
    </div>
  )
}

function RevealView({
  state,
  isHost,
  onNext,
}: {
  state: DilemmasClientState
  isHost: boolean
  onNext: () => void
}) {
  const last = state.history[state.history.length - 1]
  const total = (last?.tallyA ?? 0) + (last?.tallyB ?? 0) || 1
  const pctA = Math.round(((last?.tallyA ?? 0) / total) * 100)
  const isLastRound = state.history.length >= state.totalRounds

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-4">Résultat du groupe</p>

      <Card className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span>{last?.dilemma.emojiA} {last?.tallyA ?? 0}</span>
          <span>{last?.tallyB ?? 0} {last?.dilemma.emojiB}</span>
        </div>
        <div className="h-4 w-full rounded-full bg-white/10 overflow-hidden flex">
          <motion.div
            className="h-full bg-gradient-to-r from-fuchsia-400 to-fuchsia-500"
            initial={{ width: 0 }}
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-sky-400"
            initial={{ width: 0 }}
            animate={{ width: `${100 - pctA}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <p className="text-center text-white/50 text-xs mt-3">
          {pctA >= 50 ? `Le groupe penche pour ${last?.dilemma.textA}` : `Le groupe penche pour ${last?.dilemma.textB}`}
        </p>
      </Card>

      {isHost ? (
        <Button fullWidth onClick={onNext}>
          {isLastRound ? 'Voir les résultats finaux' : 'Dilemme suivant →'}
        </Button>
      ) : (
        <p className="text-center text-white/40 text-sm">En attente de l'hôte pour continuer…</p>
      )}
    </div>
  )
}

function FinalResults({
  members,
  onExit,
}: {
  members: { id: string; pseudo: string; color: string; xp: number }[]
  onExit: () => void
}) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Débat terminé</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">⚖️ Merci d'avoir débattu !</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-white/50">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-white/60">{m.xp} XP</span>
          </Card>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
