import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import type { OneWordStoryClientState } from './types'
import type { Member } from '../../../types'
import { WaitState } from '../../primitives'

const TURN_TIME_MS = 15_000
const MAX_WORD_LENGTH = 30

export function OneWordStoryController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)

  if (!group || !currentMember) return null
  const { party } = group
  const state = party.roundData as OneWordStoryClientState | null

  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-chalk-soft text-sm">Chargement de l'histoire…</p>
      </div>
    )
  }

  useEffect(() => {
    if (party.phase === 'ended' && lastPhase.current !== 'ended') {
      play('win')
    }
    if (party.phase === 'writing' && lastPhase.current !== 'writing' && state.myTurn) {
      play('reveal')
    }
    lastPhase.current = party.phase
  }, [party.phase, state?.myTurn, play])

  if (party.status === 'ended') {
    return <FinalStory state={state} members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'intro') {
    return <IntroView isHost={isHost} onStart={() => hostAdvance()} />
  }

  if (party.phase === 'writing' && state) {
    return (
      <WritingView
        state={state}
        members={group.members}
        isHost={isHost}
        onSubmit={(word) => sendAction('submit-word', { word })}
        onSkip={() => sendAction('skip', {})}
      />
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Préparation de l'histoire…</p>
    </div>
  )
}

function IntroView({ isHost, onStart }: { isHost: boolean; onStart: () => void }) {
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top justify-center">
      <span className="text-6xl mb-4 block text-center">📖</span>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">Histoire à un mot</h1>
      <div className="flex flex-col gap-2.5 text-sm text-chalk-muted mb-8 max-w-xs mx-auto text-center">
        <p>Chacun son tour, ajoutez <b>un seul mot</b> pour construire une histoire collective.</p>
        <p>⏱️ 15 secondes par mot — si vous tardez, c'est au suivant !</p>
        <p>🎯 30 mots au total (paramétrable).</p>
        <p>✨ 1 XP par mot contribué.</p>
      </div>
      {isHost ? (
        <Button fullWidth onClick={onStart}>
          Commencer l'histoire 📖
        </Button>
      ) : (
        <p className="text-center text-chalk-faint text-sm">L'hôte va lancer la première manche…</p>
      )}
    </div>
  )
}

function WritingView({
  state,
  members,
  isHost,
  onSubmit,
  onSkip,
}: {
  state: OneWordStoryClientState
  members: Member[]
  isHost: boolean
  onSubmit: (word: string) => void
  onSkip: () => void
}) {
  const [word, setWord] = useState('')
  const [timeLeft, setTimeLeft] = useState(state.timeLeft)
  const timerRef = useRef<number | null>(null)

  // Timer local pour l'affichage
  useEffect(() => {
    setTimeLeft(state.timeLeft)
    if (timerRef.current) clearInterval(timerRef.current)

    if (state.phase === 'writing' && state.timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 100
          if (next <= 0) {
            if (timerRef.current) clearInterval(timerRef.current)
            // Timer expiré, on skip automatiquement
            onSkip()
            return 0
          }
          return next
        })
      }, 100)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state.timeLeft, state.phase, state.turnIndex, onSkip])

  const currentPlayer = state.currentTurn
  const isMyTurn = state.myTurn
  const progress = ((state.turnIndex + 1) / state.totalWords) * 100

  const handleSubmit = () => {
    const cleanWord = word.trim().split(/\s+/)[0].slice(0, MAX_WORD_LENGTH)
    if (cleanWord) {
      onSubmit(cleanWord)
      setWord('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (state.phase === 'ended') {
    return null // Sera géré par le parent
  }

  // Vue d'attente (pas son tour)
  if (!isMyTurn) {
    const currentAvatar = currentPlayer
      ? members.find((m) => m.id === currentPlayer.memberId)
      : null

    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-chalk-faint mb-2">
            <span>Mot {Math.min(state.turnIndex + 1, state.totalWords)} / {state.totalWords}</span>
            <span className="tabular-nums">{state.story.length} mots écrits</span>
          </div>
          <div className="h-2 w-full rounded-full bg-felt-raised overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Histoire actuelle (aperçu) */}
        <Card className="mb-6 flex-1 overflow-y-auto">
          <div className="text-center mb-4">
            <span className="text-3xl">📖</span>
            <h2 className="text-lg font-bold mt-2">L'histoire en cours</h2>
          </div>
          <div className="prose prose-invert max-w-none text-base leading-relaxed text-chalk-muted">
            {state.story.length === 0 ? (
              <p className="text-chalk-faint text-center py-8">L'histoire commence ici…</p>
            ) : (
              <p className="whitespace-pre-wrap break-words">
                {state.story.join(' ')}
                <span className="inline-block w-1 h-5 bg-fuchsia-400 animate-pulse ml-1 align-bottom" aria-hidden="true" />
              </p>
            )}
          </div>
        </Card>

        {/* Infos tour actuel */}
        <div className="text-center mb-4">
          <p className="text-xs uppercase tracking-widest text-chalk-faint mb-1">Tour de</p>
          {currentAvatar && (
            <div className="flex items-center justify-center gap-2">
              <Avatar pseudo={currentAvatar.pseudo} color={currentAvatar.color} size={40} />
              <span className="text-xl font-bold text-chalk">{currentAvatar.pseudo}</span>
            </div>
          )}
        </div>

        {/* Timer visuel */}
        <div className="mb-6">
          <div className="h-3 w-48 rounded-full bg-felt-raised overflow-hidden mx-auto">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400"
              animate={{ width: `${Math.max(0, (timeLeft / TURN_TIME_MS) * 100)}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
          <p className="text-xs text-chalk-faint text-center mt-1">
            {timeLeft > 0 ? `${Math.ceil(timeLeft / 1000)}s` : 'Temps écoulé !'}
          </p>
        </div>

        <WaitState
          title="En attente du mot…"
          actedIds={state.story.length > 0 ? [currentPlayer?.memberId].filter(Boolean) as string[] : []}
          noun="mots posés"
          verb="a joué"
        />

        {isHost && (
          <Button fullWidth variant="ghost" onClick={onSkip} className="mt-4">
            Passer ce tour (hôte)
          </Button>
        )}
      </div>
    )
  }

  // Vue pour le joueur dont c'est le tour
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-chalk-faint mb-2">
          <span>Votre tour — Mot {Math.min(state.turnIndex + 1, state.totalWords)} / {state.totalWords}</span>
          <span className="tabular-nums">{state.story.length} mots écrits</span>
        </div>
        <div className="h-2 w-full rounded-full bg-felt-raised overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Histoire actuelle (aperçu) */}
      <Card className="mb-6 flex-1 overflow-y-auto">
        <div className="text-center mb-4">
          <span className="text-3xl">📖</span>
          <h2 className="text-lg font-bold mt-2">L'histoire en cours</h2>
        </div>
        <div className="prose prose-invert max-w-none text-base leading-relaxed text-chalk-muted">
          {state.story.length === 0 ? (
            <p className="text-chalk-faint text-center py-8">L'histoire commence ici…</p>
          ) : (
            <p className="whitespace-pre-wrap break-words">
              {state.story.join(' ')}
              <span className="inline-block w-1 h-5 bg-fuchsia-400 animate-pulse ml-1 align-bottom" aria-hidden="true" />
            </p>
          )}
        </div>
      </Card>

      {/* Zone de saisie */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value.slice(0, MAX_WORD_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Votre mot…"
            maxLength={MAX_WORD_LENGTH}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-2xl bg-felt-raised border border-line px-4 py-4 text-[20px] text-chalk placeholder:text-chalk-faint text-center font-medium"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-chalk-faint">
            {word.length}/{MAX_WORD_LENGTH}
          </div>
        </div>

        {/* Timer circulaire */}
        <div className="relative w-24 h-24 mx-auto">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="44"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-felt-raised"
            />
            <motion.circle
              cx="48"
              cy="48"
              r="44"
              stroke="url(#timer-gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              className="text-fuchsia-400"
              animate={{ strokeDashoffset: 276.5 * (1 - timeLeft / TURN_TIME_MS) }}
              transition={{ duration: 0.1, ease: 'linear' }}
              style={{ strokeDasharray: 276.5, strokeDashoffset: 0 }}
            />
            <defs>
              <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f0abfc" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-chalk">
              {Math.ceil(Math.max(0, timeLeft) / 1000)}
            </span>
          </div>
        </div>

        <p className="text-center text-xs text-chalk-faint">
          Appuyez sur <kbd className="px-1.5 py-0.5 bg-felt-raised rounded text-chalk-muted">Entrée</kbd> pour valider
        </p>

        <Button fullWidth disabled={!word.trim()} onClick={handleSubmit}>
          Ajouter mon mot →
        </Button>
      </div>
    </div>
  )
}

function FinalStory({
  state,
  members,
  onExit,
}: {
  state: OneWordStoryClientState
  members: Member[]
  onExit: () => void
}) {
  // Calculer les contributeurs et leurs scores
  const contributorCounts: Record<string, number> = {}
  for (const turn of state.history) {
    contributorCounts[turn.memberId] = (contributorCounts[turn.memberId] || 0) + 1
  }

  const rankedContributors = Object.entries(contributorCounts)
    .map(([memberId, count]) => {
      const member = members.find((m) => m.id === memberId)
      return { memberId, count, pseudo: member?.pseudo ?? '?', color: member?.color ?? '#fff' }
    })
    .sort((a, b) => b.count - a.count)

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Histoire terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">📖 Histoire complète</h1>

      {/* Histoire complète */}
      <Card className="mb-6 max-w-2xl mx-auto">
        <div className="prose prose-invert max-w-none text-lg leading-relaxed text-chalk text-center">
          <p className="whitespace-pre-wrap break-words">{state.story.join(' ')}</p>
        </div>
      </Card>

      {/* Contributeurs */}
      {rankedContributors.length > 0 && (
        <Card className="mb-6">
          <p className="text-xs text-chalk-faint uppercase tracking-widest mb-3 text-center">Contributeurs</p>
          <div className="flex flex-col gap-2">
            {rankedContributors.map(({ pseudo, color, count }, i) => (
              <motion.div
                key={pseudo}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-3"
              >
                <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i + 1}</span>
                <Avatar pseudo={pseudo} color={color} size={32} />
                <span className="flex-1 font-semibold">{pseudo}</span>
                <span className="text-sm text-chalk-soft">{count} mot{count !== 1 ? 's' : ''}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}