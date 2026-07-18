import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import type { WhoWroteItClientState } from './types'
import type { Member } from '../../../types'

const MAX_TEXT_LENGTH = 140

export function WhoWroteItController() {
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
  const state = party.roundData as WhoWroteItClientState

  if (party.status === 'ended') {
    return <FinalResults members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'writing') {
    return (
      <WritingView
        state={state}
        totalPlayers={group.members.length}
        onSubmit={(text) => sendAction('submit', { text })}
      />
    )
  }

  if (party.phase === 'guessing') {
    return (
      <GuessingView
        state={state}
        members={group.members}
        currentMemberId={currentMember.id}
        onGuess={(entryIndex, guessedMemberId) => {
          play('vote')
          sendAction('guess', { entryIndex, guessedMemberId })
        }}
      />
    )
  }

  if (party.phase === 'reveal') {
    return <RevealView state={state} members={group.members} isHost={isHost} onNext={() => hostAdvance()} />
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-white/50 text-sm">Préparation de la manche…</p>
    </div>
  )
}

function WritingView({
  state,
  totalPlayers,
  onSubmit,
}: {
  state: WhoWroteItClientState
  totalPlayers: number
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState('')
  const hasSubmitted = !!state.yourSubmission

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">
        Manche {state.history.length + 1} / {state.totalRounds}
      </p>
      <div className="text-center mb-6">
        <span className="text-4xl mb-3 inline-block">✍️</span>
        <h1 className="text-2xl font-extrabold leading-snug">{state.currentPrompt?.text}</h1>
      </div>

      {hasSubmitted ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold mb-1">Réponse envoyée</p>
          <p className="text-white/50 text-sm">
            En attente des autres… ({state.submittedCount}/{totalPlayers})
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
            placeholder="Écris ta réponse ici…"
            rows={4}
            className="w-full rounded-2xl bg-white/6 border border-white/10 px-4 py-3 text-[15px] text-white/90 placeholder:text-white/30 resize-none"
          />
          <p className="text-right text-xs text-white/30">{text.length}/{MAX_TEXT_LENGTH}</p>
          <Button fullWidth disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
            Envoyer
          </Button>
        </div>
      )}
    </div>
  )
}

function GuessingView({
  state,
  members,
  currentMemberId,
  onGuess,
}: {
  state: WhoWroteItClientState
  members: Member[]
  currentMemberId: string
  onGuess: (entryIndex: number, guessedMemberId: string) => void
}) {
  // On saute la phrase écrite par le joueur : on ne devine (et ne vote) que les autres.
  const ownIndex = state.yourEntryIndex ?? null
  const guessableIndexes = state.entries.map((_, i) => i).filter((i) => i !== ownIndex)

  const [pos, setPos] = useState(0)
  const clampedPos = Math.min(pos, Math.max(0, guessableIndexes.length - 1))
  const index = guessableIndexes[clampedPos]
  const entry = index !== undefined ? state.entries[index] : undefined

  const yourGuesses = state.guesses[currentMemberId] ?? {}
  const guessedAuthorId = index !== undefined ? yourGuesses[index] : undefined
  const guessedAuthor = guessedAuthorId ? members.find((m) => m.id === guessedAuthorId) : null
  const isLast = clampedPos >= guessableIndexes.length - 1
  const allGuessed = guessableIndexes.every((i) => yourGuesses[i] !== undefined)

  // Chaque auteur est unique : on retire des choix ceux déjà attribués à une AUTRE phrase, et
  // soi-même (on ne peut pas être l'auteur d'une phrase qu'on ne devine pas).
  const usedElsewhere = new Set(
    Object.entries(yourGuesses)
      .filter(([idxStr]) => Number(idxStr) !== index)
      .map(([, id]) => id),
  )
  const options = members.filter((m) => m.id !== currentMemberId && !usedElsewhere.has(m.id))

  if (!entry) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-white/50 text-sm">Préparation des textes…</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">
        Texte {clampedPos + 1} / {guessableIndexes.length}
      </p>
      <p className="text-white/50 text-sm text-center mb-4">{state.currentPrompt?.text}</p>

      <Card className="mb-6 text-center">
        <p className="text-lg font-bold leading-snug">« {entry.text} »</p>
      </Card>

      {guessedAuthorId ? (
        <>
          <div className="flex items-center justify-center gap-2 mb-6">
            <Avatar pseudo={guessedAuthor?.pseudo ?? '?'} color={guessedAuthor?.color ?? '#fff'} size={32} />
            <p className="text-white/70 text-sm">
              Tu penses que c'est <b>{guessedAuthor?.pseudo}</b>
            </p>
          </div>
          {isLast ? (
            allGuessed ? (
              <p className="text-center text-white/40 text-sm">En attente des autres joueurs…</p>
            ) : (
              <p className="text-center text-white/40 text-sm">Tu as deviné tous les textes !</p>
            )
          ) : (
            <Button fullWidth onClick={() => setPos((p) => p + 1)}>
              Texte suivant →
            </Button>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {options.map((m, i) => (
            <motion.button
              key={m.id}
              onClick={() => onGuess(index, m.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              whileTap={{ scale: 0.95 }}
              className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2"
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={44} />
              <span className="text-sm font-semibold">{m.pseudo}</span>
            </motion.button>
          ))}
        </div>
      )}

      {guessableIndexes.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-8">
          {guessableIndexes.map((entryIdx, dotPos) => (
            <button
              key={entryIdx}
              onClick={() => setPos(dotPos)}
              className={`w-2 h-2 rounded-full ${dotPos === clampedPos ? 'bg-fuchsia-400' : yourGuesses[entryIdx] ? 'bg-white/40' : 'bg-white/15'}`}
            />
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
  state: WhoWroteItClientState
  members: Member[]
  isHost: boolean
  onNext: () => void
}) {
  const last = state.history[state.history.length - 1]
  const isLastRound = state.history.length >= state.totalRounds
  const detectives = [...members]
    .map((m) => ({ member: m, correct: last?.correctByMember[m.id] ?? 0 }))
    .sort((a, b) => b.correct - a.correct)
    .filter((d) => d.correct > 0)

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-4">Les vrais auteurs</p>

      <div className="flex flex-col gap-3 mb-6">
        {last?.entries.map((entry, i) => {
          const author = members.find((m) => m.id === entry.authorId)
          return (
            <Card key={i} className="flex items-start gap-3 py-3">
              <Avatar pseudo={author?.pseudo ?? '?'} color={author?.color ?? '#fff'} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-1">{author?.pseudo}</p>
                <p className="text-sm text-white/70 leading-snug">« {entry.text} »</p>
              </div>
            </Card>
          )
        })}
      </div>

      {detectives.length > 0 && (
        <Card className="mb-4">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-2 text-center">Meilleurs détectives</p>
          <div className="flex flex-col gap-2">
            {detectives.map(({ member, correct }) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar pseudo={member.pseudo} color={member.color} size={28} />
                <span className="text-sm flex-1">{member.pseudo}</span>
                <span className="text-sm font-bold text-white/70">{correct} juste{correct !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

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

function FinalResults({ members, onExit }: { members: Member[]; onExit: () => void }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Partie terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🏆 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-white/50">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-white/60">{m.xp} XP</span>
          </Card>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
