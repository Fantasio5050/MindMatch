import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import type { GuessMyAnswerClientState } from './types'
import type { Member } from '../../../types'

export function GuessMyAnswerController() {
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
  const state = party.roundData as GuessMyAnswerClientState

  if (party.status === 'ended') {
    return <FinalResults members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'voting') {
    return (
      <VotingView
        state={state}
        members={group.members}
        currentMemberId={currentMember.id}
        onVote={(optionId) => {
          play('vote')
          sendAction('vote', { optionId })
        }}
      />
    )
  }

  if (party.phase === 'reveal') {
    return <RevealView state={state} members={group.members} isHost={isHost} onNext={() => hostAdvance()} />
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Préparation de la manche…</p>
    </div>
  )
}

function VotingView({
  state,
  members,
  currentMemberId,
  onVote,
}: {
  state: GuessMyAnswerClientState
  members: Member[]
  currentMemberId: string
  onVote: (optionId: string) => void
}) {
  const target = members.find((m) => m.id === state.targetMemberId)
  const isTarget = state.targetMemberId === currentMemberId
  const hasVoted = !!state.yourVote
  const expectedVoters = Math.max(members.length - 1, 1)

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
        Manche {state.history.length + 1} / {state.totalRounds}
      </p>
      <div className="text-center mb-6">
        <span className="text-4xl mb-3 inline-block">🕵️</span>
        <h1 className="text-2xl font-extrabold leading-snug mb-2">
          Que répondrait <span className="text-fuchsia-300">{target?.pseudo}</span> ?
        </h1>
        <p className="text-chalk-soft text-sm">{state.currentQuestion?.prompt}</p>
      </div>

      {isTarget ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">🤫</p>
          <p className="font-semibold mb-1">C'est ta réponse qu'on essaie de deviner !</p>
          <p className="text-chalk-soft text-sm">Attends la révélation…</p>
        </Card>
      ) : hasVoted ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold mb-1">Vote enregistré</p>
          <p className="text-chalk-soft text-sm">
            En attente des autres… ({state.votedCount}/{expectedVoters})
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {state.currentQuestion?.options.map((option, i) => (
            <motion.button
              key={option.id}
              onClick={() => onVote(option.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-3 rounded-2xl border border-line bg-felt-raised px-4 py-4 text-left active:bg-felt-raised"
            >
              <span className="text-xl shrink-0">{option.emoji}</span>
              <span className="text-[15px] text-chalk-muted leading-snug">{option.label}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

function RevealView({
  state,
  members,
  isHost,
  onNext,
}: {
  state: GuessMyAnswerClientState
  members: Member[]
  isHost: boolean
  onNext: () => void
}) {
  const last = state.history[state.history.length - 1]
  const target = last ? members.find((m) => m.id === last.targetMemberId) : null
  const correctOption = last?.question.options.find((o) => o.id === last.correctOptionId)
  const isLastRound = state.history.length >= state.totalRounds
  const correctGuessers = members.filter((m) => last?.correctGuesserIds.includes(m.id))

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">La vraie réponse</p>

      <Card className="text-center mb-4">
        <div className="flex flex-col items-center gap-2 mb-3">
          <Avatar pseudo={target?.pseudo ?? '?'} color={target?.color ?? '#fff'} size={56} />
          <p className="font-semibold text-sm">{target?.pseudo}</p>
        </div>
        <p className="text-3xl mb-1">{correctOption?.emoji}</p>
        <p className="font-extrabold text-lg leading-snug">{correctOption?.label}</p>
      </Card>

      <Card className="mb-4">
        <p className="text-xs text-chalk-faint uppercase tracking-widest mb-2 text-center">Ont deviné juste</p>
        {correctGuessers.length > 0 ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {correctGuessers.map((m) => (
              <div key={m.id} className="flex items-center gap-2 glass-card rounded-full pl-1 pr-3 py-1">
                <Avatar pseudo={m.pseudo} color={m.color} size={24} />
                <span className="text-xs font-medium">{m.pseudo}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-chalk-faint text-sm">Personne n'a trouvé cette fois !</p>
        )}
      </Card>

      {isHost ? (
        <Button fullWidth onClick={onNext}>
          {isLastRound ? 'Voir les résultats finaux' : 'Manche suivante →'}
        </Button>
      ) : (
        <p className="text-center text-chalk-faint text-sm">En attente de l'hôte pour continuer…</p>
      )}
    </div>
  )
}

function FinalResults({ members, onExit }: { members: Member[]; onExit: () => void }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Partie terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🏆 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-chalk-soft">{m.xp} XP</span>
          </Card>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
