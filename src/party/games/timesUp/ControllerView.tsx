import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { useCountdown } from '../../useCountdown'
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
  const state = (group?.party.roundData as TimesUpClientState | null) ?? null

  // Son de nouvelle manche.
  const lastRound = useRef<number | null>(null)
  useEffect(() => {
    if (!state || state.betweenRounds) return
    if (lastRound.current !== state.round) play('reveal')
    lastRound.current = state.round
  }, [state?.round, state?.betweenRounds, state, play])

  // Fin de chrono : envoyée par celui qui décrit (ou l'hôte si son téléphone est en veille),
  // avec le numéro du tour — le serveur ignore les doublons et les retards.
  const turnSeq = state?.turnSeq ?? -1
  const timeUp = useCallback(() => sendAction('time-up', { turn: turnSeq }), [sendAction, turnSeq])
  const timeLeft = useCountdown(
    state?.timeLeft ?? 0,
    turnSeq,
    !!state?.turnActive,
    state?.isYourTurn || isHost ? timeUp : undefined,
  )

  if (!group || !currentMember || !state) {
    return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-chalk-soft text-sm">Les cartes se mélangent…</p></div>
  }

  if (state.phase === 'ended') {
    return <FinalResults members={group.members} state={state} onExit={() => navigate('/lobby')} />
  }

  const describer = group.members.find((m) => m.id === state.currentDescriber?.memberId)
  const seconds = Math.ceil(timeLeft / 1000)

  // Entre deux manches : bilan, règle de la suivante, l'hôte relance.
  if (state.betweenRounds) {
    const last = state.roundResults[state.roundResults.length - 1]
    const next = (state.round + 1) as 1 | 2 | 3
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="kicker text-2xs text-center mb-4">Manche {last?.round} terminée</p>
        <Card className="mb-4 text-center">
          <p className="text-sm text-chalk-soft">Les {last?.found.length} cartes ont été trouvées.</p>
          <p className="text-xs text-chalk-faint mt-1">Les mêmes cartes reviennent, dans le désordre.</p>
        </Card>
        <Card className="text-center mb-6">
          <p className="text-xl font-bold mb-2">{ROUND_LABELS[next]}</p>
          <p className="text-sm text-chalk-soft">{ROUND_DESCS[next]}</p>
        </Card>
        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>
            Lancer la manche {next}
          </Button>
        ) : (
          <p className="text-center text-chalk-soft text-sm">L'hôte lance la manche {next}</p>
        )}
      </div>
    )
  }

  // Tour pas encore lancé : le joueur désigné prend le téléphone et démarre quand il est prêt.
  if (!state.turnActive) {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="kicker text-2xs text-center mb-2">{ROUND_LABELS[state.round]}</p>
        <Card className="text-center mb-6">
          <p className="text-sm text-chalk-soft">{ROUND_DESCS[state.round]}</p>
          <p className="text-xs text-chalk-faint mt-2">
            {state.cardsRemaining} carte{state.cardsRemaining > 1 ? 's' : ''} encore à trouver sur {state.totalCards}
          </p>
        </Card>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Avatar pseudo={describer?.pseudo ?? '?'} color={describer?.color ?? '#888'} size={64} photoUrl={describer?.photoUrl} />
          <p className="font-display text-xl text-chalk text-center">
            {state.isYourTurn ? 'À toi de faire deviner' : `Au tour de ${describer?.pseudo}`}
          </p>
          {!state.isYourTurn && <p className="text-sm text-chalk-soft">Prépare-toi à deviner à voix haute.</p>}
        </div>
        {state.isYourTurn ? (
          <Button fullWidth onClick={() => sendAction('start-turn', {})}>
            Je suis prêt·e — 30 secondes
          </Button>
        ) : isHost ? (
          <Button fullWidth variant="ghost" onClick={() => sendAction('start-turn', {})}>
            Lancer le tour de {describer?.pseudo}
          </Button>
        ) : null}
      </div>
    )
  }

  // Tour en cours — celui qui décrit : la carte et les deux gestes.
  if (state.isYourTurn && state.currentCard) {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="kicker text-2xs text-center mb-2">{ROUND_LABELS[state.round]}</p>
        <p className={`text-center font-mono text-4xl font-bold mb-4 ${seconds <= 5 ? 'text-blood' : 'text-chalk'}`}>{seconds}s</p>
        <Card className="text-center mb-6 py-10">
          <p className="kicker text-2xs mb-3">À faire deviner</p>
          <p className="font-display text-3xl text-chalk">{state.currentCard.text}</p>
        </Card>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => sendAction('card-found', {})}>
            Trouvé
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            disabled={state.cardsRemaining <= 1}
            onClick={() => sendAction('pass-card', {})}
          >
            Passer
          </Button>
        </div>
        <p className="text-xs text-chalk-faint text-center mt-3">
          {state.foundThisTurn.length} trouvée{state.foundThisTurn.length > 1 ? 's' : ''} ce tour
          {state.passedThisTurn > 0 ? ` · ${state.passedThisTurn} passée${state.passedThisTurn > 1 ? 's' : ''} (elles reviendront)` : ''}
        </p>
      </div>
    )
  }

  // Tour en cours — les autres devinent à voix haute.
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="kicker text-2xs text-center mb-2">{ROUND_LABELS[state.round]}</p>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <Avatar pseudo={describer?.pseudo ?? '?'} color={describer?.color ?? '#888'} size={56} photoUrl={describer?.photoUrl} />
        <p className="font-display text-xl text-chalk">
          {describer?.pseudo} {state.round === 3 ? 'mime' : 'fait deviner'} — devine à voix haute
        </p>
        <p className={`font-mono text-3xl font-bold ${seconds <= 5 ? 'text-blood' : 'text-chalk-soft'}`}>{seconds}s</p>
        {state.foundThisTurn.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {state.foundThisTurn.map((t) => (
              <span key={t} className="text-xs text-jade bg-jade/10 rounded-chip px-3 py-1">{t}</span>
            ))}
          </div>
        )}
      </div>
      {isHost && (
        <Button fullWidth variant="ghost" onClick={timeUp}>
          Arrêter ce tour
        </Button>
      )}
    </div>
  )
}

function FinalResults({ members, state, onExit }: { members: Member[]; state: TimesUpClientState; onExit: () => void }) {
  const players = members.filter((m) => state.turnOrder.includes(m.id))
  const ranked = [...players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="kicker text-2xs text-center mb-2">Trois manches jouées</p>
      <h2 className="font-display text-2xl text-center text-chalk mb-6">Qui a le mieux fait deviner</h2>
      <div className="flex flex-col gap-3 mb-6">
        {ranked.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3 rounded-card bg-felt-raised p-3">
            <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="font-mono text-sm text-chalk-soft">{state.scores[m.id] ?? 0} cartes</span>
          </div>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>Retour au salon</Button>
    </div>
  )
}
