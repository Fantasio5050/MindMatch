import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../../../store/usePartyStore'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import type { QuiproquoClientState } from './types'
import type { Member } from '../../../types'

export function QuiproquoController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const sendAction = usePartyStore((s) => s.sendAction)
  const state = (group?.party.roundData as QuiproquoClientState | null) ?? null

  if (!group || !currentMember || !state) {
    return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-chalk-soft text-sm">Chargement…</p></div>
  }

  if (state.phase === 'ended') {
    return <FinalResults members={group.members} scores={state.scores} onExit={() => navigate('/lobby')} />
  }


  // Phase: reveal constraints
  if (state.phase === 'reveal-constraints') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">
          Round {state.round} / {state.totalRounds}
        </p>
        {state.yourConstraint ? (
          <Card className="text-center mb-6">
            <p className="text-xs text-chalk-faint mb-3">Ta contrainte secrète :</p>
            <p className="text-xl font-bold mb-3">{state.yourConstraint.text}</p>
            <p className="text-sm text-chalk-soft">{state.yourConstraint.description}</p>
          </Card>
        ) : (
          <Card className="text-center mb-6"><p className="text-chalk-soft">Attends…</p></Card>
        )}
        <Card className="mb-6">
          <p className="text-xs text-chalk-faint mb-2">Sujet de discussion :</p>
          <p className="text-lg font-bold">{state.topic}</p>
        </Card>
        {isHost ? (
          <Button fullWidth onClick={() => sendAction('start-discussion', {})}>
            💬 Lancer la discussion
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte va lancer la discussion…</p>
        )}
      </div>
    )
  }

  // Phase: discussion
  if (state.phase === 'discussion') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
          Round {state.round} · Discussion
        </p>
        <Card className="text-center mb-6">
          <p className="text-xs text-chalk-faint mb-2">Sujet :</p>
          <p className="text-lg font-bold mb-4">{state.topic}</p>
          <p className="text-sm text-chalk-soft">Respecte ta contrainte sans te faire démasquer !</p>
        </Card>
        {state.yourConstraint && (
          <Card className="mb-6 bg-violet-500/5 border-violet-400/20">
            <p className="text-xs text-violet-300/80 mb-1">Rappel — ta contrainte :</p>
            <p className="text-sm font-semibold">{state.yourConstraint.text}</p>
          </Card>
        )}
        {isHost ? (
          <Button fullWidth onClick={() => sendAction('end-discussion', {})}>
            🛑 Terminer la discussion
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">Parlez naturellement… L'hôte terminera la discussion.</p>
        )}
      </div>
    )
  }

  // Phase: guessing
  if (state.phase === 'guessing') {
    return <GuessingPhase state={state} members={group.members} currentMember={currentMember} sendAction={sendAction} />
  }

  // Phase: results
  if (state.phase === 'results') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">
          Round {state.round} · Résultats
        </p>
        <div className="flex flex-col gap-3 mb-6">
          {state.results.map(r => {
            const m = group.members.find(mm => mm.id === r.memberId)
            const constraint = state.allConstraints.find(c => c.id === r.constraintId)
            return (
              <Card key={r.memberId} className={r.guessedCorrectly ? '' : 'border-emerald-400/30'}>
                <div className="flex items-center gap-3 mb-2">
                  <Avatar pseudo={m?.pseudo ?? '?'} color={m?.color ?? '#fff'} size={36} />
                  <span className="font-semibold flex-1">{m?.pseudo}</span>
                  <span className={`text-xs font-bold ${r.guessedCorrectly ? 'text-pink-300' : 'text-emerald-300'}`}>
                    {r.guessedCorrectly ? `👎 Démasqué par ${r.guessedBy.length}` : '🛡️ Non démasqué'}
                  </span>
                </div>
                <p className="text-sm text-chalk-soft">{constraint?.text}</p>
              </Card>
            )
          })}
        </div>
        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>
            {state.round >= state.totalRounds ? 'Voir les résultats finaux' : 'Round suivant →'}
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">En attente de l'hôte…</p>
        )}
      </div>
    )
  }

  return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-chalk-soft text-sm">Chargement…</p></div>
}

function GuessingPhase({ state, members, currentMember, sendAction }: {
  state: QuiproquoClientState
  members: Member[]
  currentMember: Member
  sendAction: (type: string, payload: unknown) => void
}) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const myGuesses = state.allGuesses?.[currentMember.id] ?? {}

  const targets = members.filter(m => m.id !== currentMember.id)
  const allDone = targets.every(t => myGuesses[t.id])

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
        Round {state.round} · Devine les contraintes
      </p>
      <p className="text-sm text-chalk-soft text-center mb-4">Qui avait quelle contrainte ?</p>

      {/* Target selection */}
      {!selectedTarget && (
        <div className="flex flex-col gap-2 mb-4">
          {targets.map(m => {
            const guessed = myGuesses[m.id]
            return (
              <button
                key={m.id}
                onClick={() => setSelectedTarget(m.id)}
                className={`flex items-center gap-2 rounded-lg p-3 border transition-colors ${
                  guessed ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-line bg-felt-raised'
                }`}
              >
                <Avatar pseudo={m.pseudo} color={m.color} size={32} />
                <span className="text-sm flex-1">{m.pseudo}</span>
                {guessed && <span className="text-xs text-emerald-300">✓ Deviné</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Constraint selection for target */}
      {selectedTarget && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Avatar pseudo={members.find(m => m.id === selectedTarget)?.pseudo ?? '?'} color={members.find(m => m.id === selectedTarget)?.color ?? '#fff'} size={32} />
            <span className="font-semibold text-sm">Quelle contrainte avait {members.find(m => m.id === selectedTarget)?.pseudo} ?</span>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {state.allConstraints.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  sendAction('submit-guess', { targetId: selectedTarget, constraintId: c.id })
                  setSelectedTarget(null)
                }}
                className={`text-left rounded-lg p-3 border transition-colors text-sm ${
                  myGuesses[selectedTarget] === c.id ? 'border-violet-400/40 bg-violet-500/10' : 'border-line bg-felt-raised'
                }`}
              >
                {c.text}
              </button>
            ))}
          </div>
          <Button fullWidth variant="secondary" onClick={() => setSelectedTarget(null)}>Annuler</Button>
        </>
      )}

      {allDone && (
        <p className="text-center text-emerald-300 text-sm mt-4">✅ Tu as deviné tout le monde ! En attente des autres…</p>
      )}
    </div>
  )
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
            <span className="text-violet-300 font-mono text-sm">{scores[m.id] ?? 0} pts</span>
          </div>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>Retour au salon</Button>
    </div>
  )
}