import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { CardFace } from '../pyramid/CardFace'
import { rankLabel } from '../pyramid/types'
import { ROAD_LENGTH } from './types'
import type { AutorouteClientState } from './types'
import type { Member } from '../../../types'

export function AutorouteController() {
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
  const state = party.roundData as AutorouteClientState

  if (party.status === 'ended') {
    return <FinalResults members={group.members} totals={state?.totalSipsReceived ?? {}} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'predicting') {
    return (
      <PredictingView
        state={state}
        totalPlayers={group.members.length}
        myProgress={state.progress[currentMember.id] ?? 0}
        onPredict={(direction) => {
          play('vote')
          sendAction('predict', { direction })
        }}
      />
    )
  }

  if (party.phase === 'reveal') {
    return (
      <RevealView state={state} members={group.members} currentMemberId={currentMember.id} isHost={isHost} onNext={() => hostAdvance()} />
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-white/50 text-sm">Préparation de la manche…</p>
    </div>
  )
}

function PredictingView({
  state,
  totalPlayers,
  myProgress,
  onPredict,
}: {
  state: AutorouteClientState
  totalPlayers: number
  myProgress: number
  onPredict: (direction: 'higher' | 'lower') => void
}) {
  const hasVoted = !!state.yourVote

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">
        Manche {state.history.length + 1} / {state.totalRounds}
      </p>
      <div className="flex flex-col items-center mb-6">
        {state.referenceCard && <CardFace rank={state.referenceCard.rank} suit={state.referenceCard.suit} size={72} />}
        <p className="text-white/50 text-sm mt-3">La prochaine carte sera…</p>
      </div>

      <div className="flex justify-center gap-1.5 mb-8">
        {Array.from({ length: ROAD_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-8 h-3 rounded-full ${i < myProgress ? 'bg-gradient-to-r from-fuchsia-400 to-purple-400' : 'bg-white/10'}`}
          />
        ))}
      </div>

      {hasVoted ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold mb-1">Pari enregistré</p>
          <p className="text-white/50 text-sm">
            En attente des autres… ({state.votedCount}/{totalPlayers})
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPredict('higher')}
            className="glass-card rounded-3xl p-6 text-center border border-emerald-400/20"
          >
            <span className="text-4xl mb-2 block">⬆️</span>
            <p className="text-lg font-bold">Plus haute</p>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPredict('lower')}
            className="glass-card rounded-3xl p-6 text-center border border-sky-400/20"
          >
            <span className="text-4xl mb-2 block">⬇️</span>
            <p className="text-lg font-bold">Plus basse</p>
          </motion.button>
        </div>
      )}
      <p className="text-center text-white/30 text-xs mt-6">
        Rate un pari et tu bois autant de gorgées que ta progression sur la route !
      </p>
    </div>
  )
}

function RevealView({
  state,
  members,
  currentMemberId,
  isHost,
  onNext,
}: {
  state: AutorouteClientState
  members: Member[]
  currentMemberId: string
  isHost: boolean
  onNext: () => void
}) {
  const last = state.history[state.history.length - 1]
  const isLastRound = state.history.length >= state.totalRounds
  const myResult = last?.results[currentMemberId]

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-4">Résultat</p>

      <Card className="text-center mb-4">
        <div className="flex items-center justify-center gap-4 mb-3">
          {last && <CardFace rank={last.referenceCard.rank} suit={last.referenceCard.suit} size={56} />}
          <span className="text-2xl text-white/30">→</span>
          {last && <CardFace rank={last.drawnCard.rank} suit={last.drawnCard.suit} size={56} />}
        </div>
        {last?.tie ? (
          <p className="text-white/60 text-sm">
            Égalité ({rankLabel(last.referenceCard.rank)} = {rankLabel(last.drawnCard.rank)}) — manche annulée, personne ne boit
          </p>
        ) : myResult ? (
          myResult.correct ? (
            <p className="text-emerald-300 text-sm font-semibold">
              ✅ Bien joué ! {myResult.lapCompleted ? "Tu termines l'Autoroute 🏁" : `Tu avances (${myResult.newProgress}/${ROAD_LENGTH})`}
            </p>
          ) : (
            <p className="text-pink-300 text-sm font-semibold">
              ❌ Raté ! Tu bois {myResult.sipsOwed} gorgée{myResult.sipsOwed > 1 ? 's' : ''}
            </p>
          )
        ) : (
          <p className="text-white/40 text-sm">Tu n'as pas parié cette manche</p>
        )}
      </Card>

      <div className="flex flex-col gap-2 mb-4">
        {members.map((m) => {
          const result = last?.results[m.id]
          return (
            <div key={m.id} className="flex items-center gap-3">
              <Avatar pseudo={m.pseudo} color={m.color} size={30} />
              <span className="text-sm flex-1">{m.pseudo}</span>
              {result && (
                <span className={`text-sm font-bold ${result.correct ? 'text-emerald-300' : 'text-pink-300'}`}>
                  {result.correct ? (result.lapCompleted ? '🏁' : '✅') : `+${result.sipsOwed} 🍻`}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {isHost ? (
        <Button fullWidth onClick={onNext}>
          {isLastRound ? 'Voir les résultats finaux' : 'Manche suivante →'}
        </Button>
      ) : (
        <p className="text-center text-white/40 text-sm">En attente de l'hôte pour continuer…</p>
      )}
    </div>
  )
}

function FinalResults({
  members,
  totals,
  onExit,
}: {
  members: Member[]
  totals: Record<string, number>
  onExit: () => void
}) {
  const ranked = [...members].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Autoroute terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🛣️ Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-white/50">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-white/60">{totals[m.id] ?? 0} gorgées</span>
          </Card>
        ))}
      </div>
      <p className="text-center text-white/30 text-xs mb-4">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
