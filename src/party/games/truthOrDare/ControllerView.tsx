import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { CHOICE_LABEL, CHOICE_ICON } from './types'
import type { TruthOrDareClientState } from './types'
import type { Member } from '../../../types'
import type { TruthOrDareType } from '../../../data/truthOrDare'

export function TruthOrDareController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const sendAction = usePartyStore((s) => s.sendAction)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const state = (group?.party.roundData as TruthOrDareClientState | null) ?? null

  useEffect(() => {
    const phase = group?.party.phase
    if (phase && phase !== lastPhase.current) {
      if (phase === 'revealed') play('reveal')
      if (phase === 'result') play('vote')
      lastPhase.current = phase
    }
  }, [group?.party.phase, play])

  if (!group || !currentMember) return null
  const { party } = group

  if (party.status === 'ended') {
    return <FinalResults members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-chalk-soft text-sm">Préparation…</p>
      </div>
    )
  }

  const currentPlayer = group.members.find((m) => m.id === state.currentMemberId)
  const isYou = state.currentMemberId === currentMember.id
  const roundNum = state.history.length + 1
  const isLastRound = roundNum >= state.totalRounds

  // Phase: choosing (player picks truth or dare)
  if (party.phase === 'choosing') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-6">
          Tour {roundNum} / {state.totalRounds}
        </p>
        {isYou ? (
          <ChoosingView state={state} onChoose={(choice) => sendAction('choose', { choice })} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Avatar pseudo={currentPlayer?.pseudo ?? '?'} color={currentPlayer?.color ?? '#fff'} size={56} />
            <p className="text-center text-chalk-soft text-sm">
              {currentPlayer?.pseudo} choisit entre Action ou Vérité…
            </p>
            {state.forcedChoice && (
              <p className="text-xs text-amber-300/80 bg-amber-500/10 rounded-full px-3 py-1">
                🔥 Streak actif — {CHOICE_LABEL[state.forcedChoice]} imposé·e
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Phase: revealed (card is shown, player does the dare/truth, group votes)
  if (party.phase === 'revealed' && state.currentCard) {
    const myVote = state.votes[currentMember.id] ?? null
    const voteCount = Object.keys(state.votes).length
    const approveCount = Object.values(state.votes).filter(Boolean).length

    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">
          Tour {roundNum} / {state.totalRounds}
        </p>

        <div className="flex flex-col items-center gap-2 mb-4">
          <Avatar pseudo={currentPlayer?.pseudo ?? '?'} color={currentPlayer?.color ?? '#fff'} size={48} />
          <p className="font-semibold text-sm">{isYou ? "À toi de jouer !" : `${currentPlayer?.pseudo}`}</p>
          <span className={`inline-block text-xs font-bold uppercase tracking-wider rounded-full px-3 py-1 ${
            state.currentCard.type === 'truth' ? 'text-sky-300/80 bg-sky-500/10' : 'text-fuchsia-300/80 bg-fuchsia-500/10'
          }`}>
            {CHOICE_ICON[state.currentCard.type]} {CHOICE_LABEL[state.currentCard.type]}
          </span>
        </div>

        <Card className="text-center mb-4">
          <p className="text-lg font-bold leading-snug">{state.currentCard.text}</p>
        </Card>

        {isYou ? (
          // Player actions: complete or refuse
          <div className="flex flex-col gap-3">
            <Button fullWidth onClick={() => sendAction('complete', {})}>
              ✅ J'ai fait / répondu
            </Button>
            <Button fullWidth variant="secondary" onClick={() => sendAction('refuse', {})}>
              🙈 Je refuse (gage)
            </Button>
          </div>
        ) : (
          // Group votes: did they do it / answer honestly?
          <div className="flex flex-col gap-3">
            <p className="text-center text-chalk-faint text-xs">
              Vote du groupe · {voteCount} vote{voteCount > 1 ? 's' : ''} · {approveCount} ✅
            </p>
            {myVote === null ? (
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => sendAction('vote', { approved: true })}>
                  👍 Validé
                </Button>
                <Button className="flex-1" variant="secondary" onClick={() => sendAction('vote', { approved: false })}>
                  👎 Menteur·se
                </Button>
              </div>
            ) : (
              <p className="text-center text-chalk-soft text-sm">
                Tu as voté {myVote ? '✅' : '👎'} — en attente de {currentPlayer?.pseudo}…
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Phase: result (round complete, show what happened)
  if (party.phase === 'result') {
    const lastEntry = state.history[state.history.length - 1]
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-6">
          Tour {roundNum} / {state.totalRounds}
        </p>
        {lastEntry && (
          <Card className="text-center mb-6">
            <p className="text-sm text-chalk-soft mb-2">
              {currentPlayer?.pseudo} a choisi {CHOICE_ICON[lastEntry.choice]} {CHOICE_LABEL[lastEntry.choice]}
            </p>
            <p className="text-base font-semibold mb-3">{lastEntry.cardText}</p>
            <p className={`text-lg font-bold ${lastEntry.approved ? 'text-emerald-300' : 'text-pink-300'}`}>
              {lastEntry.approved ? '✅ Validé par le groupe' : '👎 Refusé / Rejeté'}
            </p>
          </Card>
        )}
        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>
            {isLastRound ? 'Voir les résultats finaux' : 'Tour suivant →'}
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte lance le tour suivant…</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Chargement…</p>
    </div>
  )
}

function ChoosingView({
  state,
  onChoose,
}: {
  state: TruthOrDareClientState
  onChoose: (choice: TruthOrDareType) => void
}) {
  const canChooseTruth = state.forcedChoice === null || state.forcedChoice === 'truth'
  const canChooseDare = state.forcedChoice === null || state.forcedChoice === 'dare'

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <p className="text-2xl font-bold text-center">Action ou Vérité ?</p>

      {state.forcedChoice && (
        <p className="text-xs text-amber-300/80 bg-amber-500/10 rounded-full px-3 py-1">
          🔥 Tu as enchaîné {state.forcedChoice === 'truth' ? '3 Vérités' : '3 Actions'} — {CHOICE_LABEL[state.forcedChoice]} imposé·e !
        </p>
      )}

      <div className="flex gap-4 w-full max-w-sm">
        <button
          disabled={!canChooseTruth}
          onClick={() => onChoose('truth')}
          className={`flex-1 rounded-2xl border p-6 flex flex-col items-center gap-2 transition-all ${
            canChooseTruth
              ? 'border-sky-400/30 bg-sky-500/10 active:scale-95'
              : 'border-line bg-felt-sunken opacity-40'
          }`}
        >
          <span className="text-4xl">🗣️</span>
          <span className="font-bold text-sky-200">Vérité</span>
        </button>
        <button
          disabled={!canChooseDare}
          onClick={() => onChoose('dare')}
          className={`flex-1 rounded-2xl border p-6 flex flex-col items-center gap-2 transition-all ${
            canChooseDare
              ? 'border-fuchsia-400/30 bg-fuchsia-500/10 active:scale-95'
              : 'border-line bg-felt-sunken opacity-40'
          }`}
        >
          <span className="text-4xl">🎯</span>
          <span className="font-bold text-fuchsia-200">Action</span>
        </button>
      </div>
    </div>
  )
}

function FinalResults({ members, onExit }: { members: Member[]; onExit: () => void }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <h2 className="text-2xl font-extrabold text-center mb-6">Partie terminée !</h2>
      <div className="flex flex-col gap-3 mb-6">
        {ranked.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3 rounded-card bg-felt-raised p-3">
            <span className="text-lg font-bold w-6 text-center">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-emerald-300 font-mono text-sm">{m.xp} XP</span>
          </div>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>Retour au salon</Button>
    </div>
  )
}