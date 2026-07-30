import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { GroupPulse } from '../../../components/GroupPulse'
import type { WhoIsMostLikelyClientState } from './types'
import { HostCue } from '../../primitives'

export function WhoIsMostLikelyController() {
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
  const state = party.roundData as WhoIsMostLikelyClientState

  if (party.status === 'ended') {
    return <FinalResults members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'voting') {
    return (
      <VotingView
        state={state}
        members={group.members}
        onVote={(targetMemberId) => {
          play('vote')
          sendAction('vote', { targetMemberId })
        }}
      />
    )
  }

  if (party.phase === 'reveal') {
    return (
      <RevealView
        state={state}
        members={group.members}
        round={party.round}
        isHost={isHost}
        onNext={() => hostAdvance()}
      />
    )
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
  onVote,
}: {
  state: WhoIsMostLikelyClientState
  members: { id: string; pseudo: string; color: string }[]
  onVote: (targetMemberId: string) => void
}) {
  const hasVoted = !!state.yourVote
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
        Manche {state.history.length + 1} / {state.totalRounds}
      </p>
      <div className="text-center mb-8">
        <span className="text-4xl mb-3 inline-block">{state.currentQuestion?.emoji}</span>
        <h1 className="text-2xl font-extrabold leading-snug">Qui est {state.currentQuestion?.text}</h1>
      </div>

      {hasVoted ? (
        // Jeu rapide : GroupPulse peut nommer le dernier (« On attend Marie 👀 »), c'est de la
        // complicité. Il remplace l'ancien « En attente des autres… », qui était un état mort.
        <Card className="text-center">
          <p className="font-semibold mb-3 text-chalk">Vote enregistré</p>
          <GroupPulse actedIds={state.votedMemberIds ?? []} noun="votes" verb="a voté" mode="rapid" />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {members.map((m, i) => (
            <motion.button
              key={m.id}
              onClick={() => onVote(m.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              whileTap={{ scale: 0.95 }}
              className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2"
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={48} />
              <span className="text-sm font-semibold">{m.pseudo}</span>
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
  round,
  isHost,
  onNext,
}: {
  state: WhoIsMostLikelyClientState
  members: { id: string; pseudo: string; color: string }[]
  round: number
  isHost: boolean
  onNext: () => void
}) {
  const last = state.history[state.history.length - 1]
  const winner = last?.winnerId ? members.find((m) => m.id === last.winnerId) : null
  const isLastRound = round >= state.totalRounds

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">Résultat</p>

      <Card className="text-center mb-4">
        {winner ? (
          <>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="mb-2">
              <Avatar pseudo={winner.pseudo} color={winner.color} size={64} />
            </motion.div>
            <p className="font-extrabold text-lg">{winner.pseudo}</p>
            <p className="text-chalk-soft text-sm mt-1">a été élu·e {last?.question.text}</p>
          </>
        ) : (
          <p className="text-chalk-soft text-sm py-4">Égalité parfaite — personne ne l'emporte cette fois !</p>
        )}
      </Card>

      <div className="flex flex-col gap-2 mb-4">
        {members
          .map((m) => ({ member: m, votes: last?.tally[m.id] ?? 0 }))
          .sort((a, b) => b.votes - a.votes)
          .map(({ member, votes }) => (
            <div key={member.id} className="flex items-center gap-3">
              <Avatar pseudo={member.pseudo} color={member.color} size={30} />
              <span className="text-sm flex-1">{member.pseudo}</span>
              <span className="text-sm font-bold text-chalk-muted">{votes} vote{votes !== 1 ? 's' : ''}</span>
            </div>
          ))}
      </div>

      {isHost ? (
        <Button fullWidth onClick={onNext}>
          {isLastRound ? 'Voir les résultats finaux' : 'Manche suivante →'}
        </Button>
      ) : (
        <HostCue action="enchaîne la manche" />
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
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
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
