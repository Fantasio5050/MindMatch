import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { fillBlank, type BlancClientState } from './types'
import type { Member } from '../../../types'
import { HostCue } from '../../primitives'

export function BlancController() {
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
    if (phase && phase !== lastPhase.current) {
      if (phase === 'voting') play('tick')
      if (phase === 'results') play('reveal')
      lastPhase.current = phase
    }
  }, [phase, play])

  if (!group || !currentMember) return null
  const { party } = group
  const state = party.roundData as BlancClientState | null

  if (party.status === 'ended') {
    return <EndCard onExit={() => navigate('/lobby')} />
  }
  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-chalk-soft text-sm">Préparation du Grand Blanc…</p>
      </div>
    )
  }

  if (party.phase === 'intro') {
    return <IntroView isHost={isHost} onStart={() => hostAdvance()} />
  }

  if (party.phase === 'answering') {
    return (
      <AnsweringView
        state={state}
        isHost={isHost}
        onPlay={(cardId) => {
          play('vote')
          sendAction('play', { cardId })
        }}
        onAdvance={() => hostAdvance()}
      />
    )
  }

  if (party.phase === 'voting') {
    return (
      <VotingView
        state={state}
        isHost={isHost}
        onVote={(entryIndex) => {
          play('vote')
          sendAction('vote', { entryIndex })
        }}
        onAdvance={() => hostAdvance()}
      />
    )
  }

  if (party.phase === 'results') {
    return <ResultsView state={state} members={group.members} selfId={currentMember.id} isHost={isHost} onNext={() => hostAdvance()} />
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">…</p>
    </div>
  )
}

function PromptBar({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[#141019] border border-line px-5 py-4 mb-5">
      <p className="text-[15px] leading-snug font-semibold text-chalk-muted">{text}</p>
    </div>
  )
}

function IntroView({ isHost, onStart }: { isHost: boolean; onStart: () => void }) {
  const rules = [
    ['🖊️', 'Une carte noire apparaît : une phrase avec un trou à combler.'],
    ['🃏', 'Choisis dans ta main la carte blanche la plus drôle pour remplir le trou.'],
    ['🗳️', 'Toutes les réponses sont mélangées : votez pour la plus drôle (jamais la vôtre).'],
    ['🏆', "L'auteur·rice de la carte qui récolte le plus de votes marque un point."],
    ['🔞', 'Humour volontairement trash — à réserver aux esprits pas trop sensibles.'],
  ] as const
  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-6">
        <span className="text-5xl">🖊️</span>
        <h1 className="text-2xl font-extrabold mt-2">Le Grand Blanc</h1>
      </div>
      <Card className="mb-6">
        <ul className="flex flex-col gap-3 text-sm text-chalk-muted">
          {rules.map(([emoji, text], i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="flex gap-2">
              <span className="shrink-0">{emoji}</span>
              <span>{text}</span>
            </motion.li>
          ))}
        </ul>
      </Card>
      {isHost ? (
        <Button fullWidth onClick={onStart}>
          Distribuer les cartes 🃏
        </Button>
      ) : (
        <HostCue action="lance la partie" />
      )}
    </div>
  )
}

function AnsweringView({
  state,
  isHost,
  onPlay,
  onAdvance,
}: {
  state: BlancClientState
  isHost: boolean
  onPlay: (cardId: string) => void
  onAdvance: () => void
}) {
  const submitted = state.yourSubmission !== null
  const total = state.order.length

  return (
    <div className="min-h-svh flex flex-col px-6 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
        Manche {state.roundsPlayed + 1} / {state.totalRounds}
      </p>
      {state.currentPrompt && <PromptBar text={state.currentPrompt.text} />}

      {submitted ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold mb-1">Carte posée !</p>
          <p className="text-chalk-soft text-sm mb-3">« {state.yourSubmission} »</p>
          <p className="text-chalk-faint text-sm">
            {state.submittedCount}/{total} ont joué — on attend les autres…
          </p>
        </Card>
      ) : (
        <>
          <p className="text-sm font-semibold text-center mb-3">Choisis ta carte 👇</p>
          <div className="flex flex-col gap-2.5">
            {state.yourHand.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPlay(c.id)}
                className="rounded-2xl bg-white text-[#1a1030] px-4 py-3 text-left text-[15px] font-semibold shadow active:bg-white/90"
              >
                {c.text}
              </motion.button>
            ))}
          </div>
        </>
      )}

      {isHost && (
        <div className="mt-auto pt-4">
          <Button fullWidth variant="secondary" onClick={onAdvance}>
            Passer au vote → ({state.submittedCount}/{total})
          </Button>
        </div>
      )}
    </div>
  )
}

function VotingView({
  state,
  isHost,
  onVote,
  onAdvance,
}: {
  state: BlancClientState
  isHost: boolean
  onVote: (entryIndex: number) => void
  onAdvance: () => void
}) {
  const total = state.order.length
  const voted = state.yourVote !== null && state.yourVote !== undefined

  return (
    <div className="min-h-svh flex flex-col px-6 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Vote pour la plus drôle</p>
      {state.currentPrompt && <PromptBar text={state.currentPrompt.text} />}

      <div className="flex flex-col gap-2.5">
        {state.plays.map((p, i) => {
          const isMine = state.yourEntryIndex === i
          const isMyVote = state.yourVote === i
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              whileTap={{ scale: isMine ? 1 : 0.97 }}
              disabled={isMine}
              onClick={() => !isMine && onVote(i)}
              className={`rounded-2xl px-4 py-3 text-left text-[15px] font-semibold shadow transition-colors ${
                isMine
                  ? 'bg-felt-raised text-chalk-faint border border-dashed border-line-strong'
                  : isMyVote
                    ? 'bg-fuchsia-500 text-white ring-2 ring-fuchsia-300'
                    : 'bg-white text-[#1a1030] active:bg-white/90'
              }`}
            >
              {p.text}
              {isMine && <span className="block text-[11px] font-normal mt-0.5">(ta carte — tu ne peux pas voter pour toi)</span>}
            </motion.button>
          )
        })}
      </div>

      <p className="text-center text-chalk-faint text-sm mt-4">
        {voted ? '✅ Vote enregistré' : 'Touche la carte la plus drôle'} — {state.votedCount}/{total}
      </p>

      {isHost && (
        <div className="mt-auto pt-4">
          <Button fullWidth variant="secondary" onClick={onAdvance}>
            Révéler les résultats →
          </Button>
        </div>
      )}
    </div>
  )
}

function ResultsView({
  state,
  members,
  selfId,
  isHost,
  onNext,
}: {
  state: BlancClientState
  members: Member[]
  selfId: string
  isHost: boolean
  onNext: () => void
}) {
  const r = state.results
  if (!r) return null
  const memberName = (id: string) => members.find((m) => m.id === id)?.pseudo ?? '?'
  const winnerIdx = r.winnerEntryIndices[0]
  const winner = winnerIdx !== undefined ? r.entries[winnerIdx] : null
  const iWon = winner?.authorId === selfId
  const last = state.roundsPlayed >= state.totalRounds

  return (
    <div className="min-h-svh flex flex-col px-6 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-3">Résultat de la manche</p>

      {winner ? (
        <Card className="mb-4 border-emerald-400/30 text-center">
          <p className="text-3xl mb-1">🏆</p>
          <p className="rounded-xl bg-white text-[#1a1030] px-4 py-3 text-[15px] font-bold mb-2">
            {fillBlank(r.promptText, winner.text)}
          </p>
          <p className="text-emerald-300 text-sm font-semibold">
            {iWon ? "C'est TA carte ! 🎉" : `Carte de ${memberName(winner.authorId)}`} · {r.votesByEntry[winnerIdx]} vote
            {r.votesByEntry[winnerIdx] > 1 ? 's' : ''}
          </p>
        </Card>
      ) : (
        <Card className="mb-4 text-center">
          <p className="text-chalk-soft text-sm">Aucune carte n'a récolté de vote cette manche.</p>
        </Card>
      )}

      <div className="flex flex-col gap-1.5 mb-4">
        {r.entries.map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-6 text-center text-chalk-faint tabular-nums">{r.votesByEntry[i]}</span>
            <span className="flex-1 truncate text-chalk-muted">{e.text}</span>
            <span className="text-chalk-faint text-xs">{memberName(e.authorId)}</span>
          </div>
        ))}
      </div>

      {isHost ? (
        <div className="mt-auto pt-2">
          <Button fullWidth onClick={onNext}>
            {last ? 'Voir le classement final →' : 'Manche suivante →'}
          </Button>
        </div>
      ) : (
        <p className="mt-auto pt-2 text-center text-chalk-faint text-sm">L'hôte enchaîne…</p>
      )}
    </div>
  )
}

function EndCard({ onExit }: { onExit: () => void }) {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center safe-top">
      <span className="text-6xl mb-3">🖊️</span>
      <h1 className="text-2xl font-extrabold mb-2">Partie terminée !</h1>
      <p className="text-chalk-soft text-sm mb-8">Le classement est sur la TV 📺</p>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
