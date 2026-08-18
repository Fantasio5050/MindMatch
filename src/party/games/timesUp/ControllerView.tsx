import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { ROUND_LABELS, ROUND_DESCS } from './types'
import type { TimesUpClientState } from './types'
import type { Member } from '../../../types'

export function TimesUpController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const sendAction = usePartyStore((s) => s.sendAction)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const state = (group?.party.roundData as TimesUpClientState | null) ?? null

  useEffect(() => {
    const phase = group?.party.phase
    if (phase && phase !== lastPhase.current) {
      if (phase === 'round1' || phase === 'round2' || phase === 'round3') play('reveal')
      lastPhase.current = phase
    }
  }, [group?.party.phase, play])

  // Countdown timer
  useEffect(() => {
    if (!state?.isYourTurn || !state.currentCard) return
    setTimeLeft(state.timeLeft)
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id)
          sendAction('time-up', {})
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [state?.isYourTurn, state?.currentCard, sendAction])

  if (!group || !currentMember || !state) {
    return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-chalk-soft text-sm">Chargement…</p></div>
  }

  if (state.phase === 'ended') {
    return <FinalResults members={group.members} scores={state.scores} onExit={() => navigate('/lobby')} />
  }

  const { party } = group
  const isYourTurn = state.currentDescriber?.memberId === currentMember.id

  // Intro phase
  if (party.phase === 'intro' || (!state.currentDescriber && (state.phase as string) !== 'ended')) {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">Time's Up</p>
        <Card className="text-center mb-6">
          <p className="text-2xl font-bold mb-2">{ROUND_LABELS[state.round]}</p>
          <p className="text-sm text-chalk-soft">{ROUND_DESCS[state.round]}</p>
        </Card>
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-xs text-chalk-faint text-center">{state.totalCards || state.cardsRemaining} cartes à deviner</p>
        </div>
        {isHost ? (
          <Button fullWidth onClick={() => sendAction('start-turn', {})}>
            ▶ Lancer le tour
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte va lancer le tour…</p>
        )}
      </div>
    )
  }

  // Active turn
  if (state.currentDescriber) {
    const describer = group.members.find(m => m.id === state.currentDescriber!.memberId)
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
          {ROUND_LABELS[state.round]}
        </p>

        <div className="flex flex-col items-center gap-2 mb-4">
          <Avatar pseudo={describer?.pseudo ?? '?'} color={describer?.color ?? '#fff'} size={48} />
          <p className="font-semibold text-sm">{isYourTurn ? "C'est ton tour !" : `${describer?.pseudo} décrit…`}</p>
        </div>

        {isYourTurn && state.currentCard ? (
          <>
            {/* Timer */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`text-3xl font-mono font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-emerald-300'}`}>
                {timeLeft}s
              </span>
            </div>

            {/* Card to describe */}
            <Card className="text-center mb-6">
              <p className="text-xs text-chalk-faint mb-2">À faire deviner :</p>
              <p className="text-2xl font-bold">{state.currentCard.text}</p>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => sendAction('card-found', {})}>
                ✅ Trouvé !
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => sendAction('pass-card', {})}>
                ⏭ Passer
              </Button>
            </div>

            {/* Found this turn */}
            {state.passedCards.length > 0 && (
              <p className="text-xs text-chalk-faint text-center mt-3">
                {state.passedCards.length} carte{state.passedCards.length > 1 ? 's' : ''} passée{state.passedCards.length > 1 ? 's' : ''}
              </p>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <span className="text-5xl">{state.round === 3 ? '🤫' : '🤔'}</span>
            <p className="text-chalk-soft text-sm text-center">
              {state.round === 3 ? 'Mime en cours… Devine à voix haute !' : 'Description en cours… Devine à voix haute !'}
            </p>
            {state.lastFound && (
              <p className="text-xs text-emerald-300 bg-emerald-500/10 rounded-full px-3 py-1">
                ✅ {state.lastFound}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Between rounds
  if (state.phase === 'round2' || state.phase === 'round3') {
    if (!state.currentDescriber) {
      const lastResult = state.roundResults[state.roundResults.length - 1]
      return (
        <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
          <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">Round terminé</p>
          {lastResult && (
            <Card className="mb-6">
              <p className="text-sm text-chalk-soft mb-2">Round {lastResult.round} :</p>
              <p className="text-emerald-300 text-sm">✅ {lastResult.found.length} trouvées</p>
              <p className="text-pink-300 text-sm">❌ {lastResult.missed.length} ratées</p>
            </Card>
          )}
          <Card className="text-center mb-6">
            <p className="text-xl font-bold mb-2">{ROUND_LABELS[state.round]}</p>
            <p className="text-sm text-chalk-soft">{ROUND_DESCS[state.round]}</p>
          </Card>
          {isHost ? (
            <Button fullWidth onClick={() => hostAdvance()}>
              ▶ Continuer
            </Button>
          ) : (
            <p className="text-center text-chalk-faint text-sm">Préparation du prochain round…</p>
          )}
        </div>
      )
    }
  }

  return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-chalk-soft text-sm">Chargement…</p></div>
}

function FinalResults({ members, scores, onExit }: { members: Member[]; scores: Record<string, number>; onExit: () => void }) {
  const ranked = [...members].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <h2 className="text-2xl font-extrabold text-center mb-6">Partie terminée !</h2>
      <div className="flex flex-col gap-3 mb-6">
        {ranked.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3 rounded-card bg-felt-raised p-3">
            <span className="text-lg font-bold w-6 text-center">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-emerald-300 font-mono text-sm">{scores[m.id] ?? 0} cartes</span>
          </div>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>Retour au salon</Button>
    </div>
  )
}