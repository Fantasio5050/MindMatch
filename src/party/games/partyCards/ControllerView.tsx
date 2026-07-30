import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { CARD_TYPE_LABEL } from './types'
import type { PartyCardsClientState } from './types'
import type { Member } from '../../../types'

export function PartyCardsController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()
  const lastCardId = useRef<string | null>(null)
  const state = (group?.party.roundData as PartyCardsClientState | null) ?? null

  useEffect(() => {
    if (state?.currentCard && state.currentCard.id !== lastCardId.current) {
      play('reveal')
      lastCardId.current = state.currentCard.id
    }
  }, [state?.currentCard, play])

  if (!group || !currentMember) return null
  const { party } = group

  if (party.status === 'ended') {
    return <FinalResults members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'card' && state) {
    const assigned = group.members.find((m) => m.id === state.assignedMemberId)
    const isYou = state.assignedMemberId === currentMember.id
    const isLastRound = state.history.length + 1 >= state.totalRounds

    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-6">
          Carte {state.history.length + 1} / {state.totalRounds}
        </p>
        <Card className="text-center mb-6">
          <div className="flex flex-col items-center gap-2 mb-4">
            <Avatar pseudo={assigned?.pseudo ?? '?'} color={assigned?.color ?? '#fff'} size={56} />
            <p className="font-semibold text-sm">{isYou ? "C'est ton tour !" : `Au tour de ${assigned?.pseudo}`}</p>
          </div>
          {state.currentCard && (
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-fuchsia-300/80 bg-fuchsia-500/10 rounded-full px-3 py-1 mb-4">
              {CARD_TYPE_LABEL[state.currentCard.type]}
            </span>
          )}
          <p className="text-lg font-bold leading-snug">{state.currentCard?.text}</p>
        </Card>

        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>
            {isLastRound ? 'Voir les résultats finaux' : 'Carte suivante →'}
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte passera à la carte suivante quand vous êtes prêt·e·s.</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Préparation de la carte…</p>
    </div>
  )
}

function FinalResults({ members, onExit }: { members: Member[]; onExit: () => void }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Soirée terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🃏 Merci d'avoir joué !</h1>
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
