import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { CardFace } from './CardFace'
import type { PyramidClientState, HandCard } from './types'
import type { Member } from '../../../types'

function sipLabel(sips: number | 'culsec'): string {
  if (sips === 'culsec') return '🥃 Cul sec'
  return `${sips} gorgée${sips > 1 ? 's' : ''}`
}

export function PyramidController() {
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
    if (phase === 'revealed' && lastPhase.current !== 'revealed') play('reveal')
    lastPhase.current = phase
  }, [phase, play])

  if (!group || !currentMember) return null
  const state = group.party.roundData as PyramidClientState

  if (group.party.status === 'ended') {
    return <FinalResults members={group.members} totals={state.totalSipsReceived} onExit={() => navigate('/lobby')} />
  }

  const currentCard = state.pyramid[state.currentIndex]
  if (!currentCard) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-white/50 text-sm">Préparation de la pyramide…</p>
      </div>
    )
  }

  const myMatches = state.yourHand.filter((c) => c.rank === currentCard.rank)
  const iSubmitted = !!state.submissions[currentMember.id]

  return (
    <div className="min-h-svh flex flex-col px-6 pt-8 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">
        Carte {state.currentIndex + 1} / {state.pyramid.length}
      </p>

      <div className="flex flex-col items-center mb-6">
        <CardFace rank={currentCard.rank} size={80} />
        <p className="mt-3 text-lg font-bold">{sipLabel(currentCard.sips)}</p>
      </div>

      {group.party.phase === 'matching' && (
        <MatchingPanel
          myMatches={myMatches}
          iSubmitted={iSubmitted}
          members={group.members}
          selfId={currentMember.id}
          sips={currentCard.sips}
          onPlay={(targetMemberId) => {
            play('vote')
            sendAction('pyramidPlay', { play: true, targetMemberId })
          }}
          onPass={() => sendAction('pyramidPlay', { play: false })}
        />
      )}

      {group.party.phase === 'revealed' && (
        <RevealedPanel
          card={currentCard}
          members={group.members}
          isHost={isHost}
          isLast={state.currentIndex >= state.pyramid.length - 1}
          onNext={() => hostAdvance()}
        />
      )}

      <div className="mt-auto pt-6">
        <p className="text-xs text-white/40 mb-2 text-center">Ta main</p>
        <div className="flex justify-center gap-2">
          {state.yourHand.map((c: HandCard) => (
            <div key={c.id} className={c.rank === currentCard.rank ? 'ring-2 ring-fuchsia-400 rounded-lg' : ''}>
              <CardFace rank={c.rank} size={44} />
            </div>
          ))}
          {state.yourHand.length === 0 && <p className="text-white/30 text-xs">Main vide</p>}
        </div>
      </div>
    </div>
  )
}

function MatchingPanel({
  myMatches,
  iSubmitted,
  members,
  selfId,
  sips,
  onPlay,
  onPass,
}: {
  myMatches: HandCard[]
  iSubmitted: boolean
  members: Member[]
  selfId: string
  sips: number | 'culsec'
  onPlay: (targetMemberId: string) => void
  onPass: () => void
}) {
  const [picking, setPicking] = useState(false)

  if (iSubmitted) {
    return (
      <Card className="text-center mb-4">
        <p className="text-2xl mb-1">✅</p>
        <p className="text-sm text-white/60">En attente des autres joueurs…</p>
      </Card>
    )
  }

  if (myMatches.length === 0) {
    return (
      <Card className="text-center mb-4">
        <p className="text-2xl mb-1">👀</p>
        <p className="text-sm text-white/60">Pas de carte correspondante, tu regardes…</p>
      </Card>
    )
  }

  if (!picking) {
    return (
      <Card className="text-center mb-4">
        <p className="font-semibold mb-3">
          Tu as {myMatches.length > 1 ? `${myMatches.length} cartes` : 'une carte'} qui correspond{myMatches.length > 1 ? 'ent' : ''} !
        </p>
        <div className="flex flex-col gap-2">
          <Button fullWidth onClick={() => setPicking(true)}>
            Distribuer {sips === 'culsec' ? 'un cul sec' : `${(sips as number) * myMatches.length} gorgées`}
          </Button>
          <Button fullWidth variant="ghost" onClick={onPass}>
            Passer quand même
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mb-4">
      <p className="text-sm font-semibold mb-3 text-center">À qui ?</p>
      <div className="grid grid-cols-3 gap-2">
        {members
          .filter((m) => m.id !== selfId)
          .map((m) => (
            <button
              key={m.id}
              onClick={() => onPlay(m.id)}
              className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5"
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={36} />
              <span className="text-xs font-medium truncate w-full text-center">{m.pseudo}</span>
            </button>
          ))}
      </div>
    </Card>
  )
}

function RevealedPanel({
  card,
  members,
  isHost,
  isLast,
  onNext,
}: {
  card: PyramidClientState['pyramid'][number]
  members: Member[]
  isHost: boolean
  isLast: boolean
  onNext: () => void
}) {
  const memberName = (id: string) => members.find((m) => m.id === id)?.pseudo ?? '?'

  return (
    <Card className="mb-4">
      {card.plays.length === 0 ? (
        <p className="text-center text-white/50 text-sm py-2">Personne n'avait de match sur cette carte.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {card.plays.map((p, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className="text-sm"
            >
              <b>{memberName(p.memberId)}</b> donne{' '}
              {card.sips === 'culsec' ? 'un cul sec 🥃' : `${(card.sips as number) * p.matchCount} gorgées`} à{' '}
              <b>{memberName(p.targetMemberId)}</b>
            </motion.p>
          ))}
        </div>
      )}
      {isHost ? (
        <Button fullWidth onClick={onNext} className="mt-1">
          {isLast ? 'Voir les résultats' : 'Carte suivante →'}
        </Button>
      ) : (
        <p className="text-center text-white/40 text-xs">En attente de l'hôte…</p>
      )}
    </Card>
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
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Pyramide terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🍻 Classement</h1>
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
      <p className="text-center text-white/30 text-xs mb-4">💧 Pense à boire de l'eau entre deux verres !</p>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
