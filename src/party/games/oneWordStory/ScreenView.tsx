import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import type { OneWordStoryClientState } from './types'
import type { Member } from '../../../types'

export function OneWordStoryScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)

  const [lastWordIndex, setLastWordIndex] = useState(-1)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null

  useEffect(() => {
    if (phase === 'ended' && lastPhase.current !== 'ended') {
      play('win')
    }
    if (phase === 'writing' && lastPhase.current !== 'writing') {
      play('reveal')
    }
    lastPhase.current = phase
  }, [phase, play])

  // Détecter l'ajout d'un nouveau mot pour l'animation
  useEffect(() => {
    if (group?.party.roundData) {
      const state = group.party.roundData as OneWordStoryClientState
      if (state.story.length > lastWordIndex && lastWordIndex >= 0) {
        // Nouveau mot ajouté - déclencher une animation
        play('vote') // ou un son spécifique
      }
      setLastWordIndex(state.story.length)
    }
  }, [group?.party.roundData, play])

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const { party, members } = group
  const state = party.roundData as OneWordStoryClientState | null

  return (
    <div className="tv-frame">
      {status === 'ended' && state && <FinalStory state={state} members={members} />}
      {status !== 'ended' && phase === 'intro' && <IntroScreen />}
      {status !== 'ended' && phase === 'writing' && state && (
        <WritingScreen state={state} members={members} />
      )}
      {status !== 'ended' && !phase && <p className="text-chalk-faint text-2xl">Préparation de l'histoire…</p>}
    </div>
  )
}

function IntroScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center max-w-4xl"
    >
      <span className="text-8xl mb-6 inline-block">📖</span>
      <h1 className="text-5xl font-extrabold leading-tight mb-6">Histoire à un mot</h1>
      <p className="text-chalk-muted text-xl mb-8 max-w-2xl mx-auto">
        Chaque joueur ajoute <span className="font-bold text-chalk">un seul mot</span> à tour de rôle
        pour construire une histoire collective.
      </p>
      <div className="flex flex-col gap-3 text-chalk-soft text-lg max-w-xl mx-auto">
        <p>⏱️ 15 secondes par mot</p>
        <p>🎯 30 mots au total</p>
        <p>✨ 1 XP par mot contribué</p>
      </div>
      <p className="text-chalk-faint text-lg mt-10">L'hôte lance la partie sur son téléphone 📱</p>
    </motion.div>
  )
}

function WritingScreen({ state, members }: { state: OneWordStoryClientState; members: Member[] }) {
  const currentPlayer = state.currentTurn
    ? members.find((m) => m.id === state.currentTurn!.memberId)
    : null

  const progress = ((state.turnIndex + 1) / state.totalWords) * 100

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center max-w-5xl"
    >
      {/* Header avec progression */}
      <div className="mb-8">
        <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">
          Mot {Math.min(state.turnIndex + 1, state.totalWords)} / {state.totalWords}
        </p>
        <div className="h-3 w-full max-w-2xl mx-auto rounded-full bg-felt-raised overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-400"
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="text-chalk-soft text-lg tabular-nums mt-2">
          {state.story.length} / {state.totalWords} mots
        </p>
      </div>

      {/* Joueur actuel */}
      <AnimatePresence mode="wait">
        {currentPlayer && (
          <motion.div
            key={currentPlayer.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <p className="text-chalk-faint text-lg uppercase tracking-widest mb-2">Tour de</p>
            <div className="flex items-center justify-center gap-4">
              <Avatar pseudo={currentPlayer.pseudo} color={currentPlayer.color} size={64} />
              <div className="text-left">
                <p className="text-3xl font-extrabold text-chalk">{currentPlayer.pseudo}</p>
                <p className="text-chalk-muted">écrit son mot…</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Histoire en direct - le cœur de l'expérience TV */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.story.length}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="max-w-4xl mx-auto"
        >
          <div className="glass-card rounded-3xl p-8 md:p-12 mb-8 min-h-[200px] flex items-center justify-center">
            <div className="prose prose-invert max-w-none text-center">
              {state.story.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-2xl text-chalk-faint font-display"
                >
                  L'histoire commence ici…
                  <span className="inline-block w-2 h-8 bg-fuchsia-400 animate-pulse ml-2 align-bottom" aria-hidden="true" />
                </motion.p>
              ) : (
                <motion.p
                  key={state.story.join('|')}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-2xl md:text-3xl lg:text-4xl leading-relaxed text-chalk font-display whitespace-pre-wrap break-words"
                >
                  {state.story.map((word, i) => (
                    <motion.span
                      key={`${i}-${word}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className="inline-block"
                    >
                      {word}
                      {i < state.story.length - 1 ? ' ' : ''}
                    </motion.span>
                  ))}
                  {state.phase === 'writing' && (
                    <motion.span
                      className="inline-block w-2 h-8 bg-fuchsia-400 animate-pulse ml-1 align-bottom"
                      aria-hidden="true"
                    />
                  )}
                </motion.p>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Timer visuel pour le tour actuel */}
      {state.phase === 'writing' && state.timeLeft > 0 && currentPlayer && (
        <TimerRing timeLeft={state.timeLeft} totalTime={15_000} />
      )}

      <p className="text-chalk-faint text-lg mt-8">Les joueurs écrivent sur leur téléphone 📱</p>
    </motion.div>
  )
}

function TimerRing({ timeLeft, totalTime }: { timeLeft: number; totalTime: number }) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, timeLeft / totalTime)
  const strokeDashoffset = circumference * (1 - progress)

  const colorClass =
    progress > 0.5 ? 'text-emerald-400' : progress > 0.2 ? 'text-amber-400' : 'text-rose-400'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3 mb-8"
    >
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx={80}
            cy={80}
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-felt-raised"
          />
          <motion.circle
            cx={80}
            cy={80}
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            className={colorClass}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-chalk">
            {Math.ceil(timeLeft / 1000)}
          </span>
        </div>
      </div>
      <p className="text-chalk-faint text-sm">Temps restant</p>
    </motion.div>
  )
}

function FinalStory({ state, members }: { state: OneWordStoryClientState; members: Member[] }) {
  // Calculer les stats des contributeurs
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
    <AnimatePresence mode="wait">
      <motion.div
        key="final"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="text-center max-w-4xl"
      >
        <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">Histoire terminée</p>
        <h1 className="text-5xl font-extrabold shimmer-text mb-10">📖 Histoire complète</h1>

        {/* Histoire complète en grand */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="glass-card rounded-3xl p-8 md:p-12 mb-12"
        >
          <div className="prose prose-invert max-w-none text-center">
            <p className="text-2xl md:text-3xl lg:text-4xl leading-relaxed text-chalk font-display whitespace-pre-wrap break-words">
              {state.story.join(' ')}
            </p>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="grid grid-cols-3 gap-4 max-w-xl mx-auto mb-10"
        >
          <StatCard label="Mots totaux" value={state.story.length} icon="📝" />
          <StatCard label="Joueurs" value={members.length} icon="👥" />
          <StatCard
            label="Top contributeur"
            value={rankedContributors[0]?.count ?? 0}
            icon="🏆"
            subtext={rankedContributors[0]?.pseudo}
          />
        </motion.div>

        {/* Liste des contributeurs */}
        {rankedContributors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="max-w-md mx-auto"
          >
            <p className="text-chalk-faint text-lg uppercase tracking-widest mb-4 text-center">Contributeurs</p>
            <div className="flex flex-col gap-3">
              {rankedContributors.map(({ pseudo, color, count }, i) => (
                <motion.div
                  key={pseudo}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + 0.1 * i, duration: 0.3 }}
                  className="glass-card rounded-2xl px-6 py-4 flex items-center gap-4"
                >
                  <span className="text-2xl font-bold w-10 text-center text-chalk-soft">{i + 1}</span>
                  <Avatar pseudo={pseudo} color={color} size={40} />
                  <span className="flex-1 font-semibold text-left">{pseudo}</span>
                  <span className="text-lg text-chalk-soft tabular-nums">{count} mot{count !== 1 ? 's' : ''}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function StatCard({
  label,
  value,
  icon,
  subtext,
}: {
  label: string
  value: number
  icon: string
  subtext?: string
}) {
  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-2">
      <span className="text-3xl">{icon}</span>
      <p className="text-3xl font-extrabold tabular-nums text-chalk">{value}</p>
      <p className="text-sm text-chalk-faint">{label}</p>
      {subtext && <p className="text-xs text-fuchsia-400 font-medium">{subtext}</p>}
    </div>
  )
}