import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { Stage, Moment, Verdict, PlayerRail } from '../../primitives'
import {
  OUTCOME_TEXT,
  ROLE_COLOR,
  ROLE_EMOJI,
  ROLE_LABEL,
  type IntrusClientState,
  type IntrusTruth,
} from './types'
import type { Member } from '../../../types'

export function IntrusScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const [confetti, setConfetti] = useState(0)
  const lastPhase = useRef<string | null>(null)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null

  useEffect(() => {
    if (phase && phase !== lastPhase.current) {
      if (phase === 'reveal') play('reveal')
      if (phase === 'ended') {
        play('win')
        setConfetti((n) => n + 1)
      }
      lastPhase.current = phase
    }
  }, [phase, play])

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-xl">Connexion à la salle…</p>
      </div>
    )
  }
  const state = group.party.roundData as IntrusClientState | null
  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-xl">Préparation de la partie…</p>
      </div>
    )
  }

  const members = group.members
  const byId = (id: string) => members.find((m) => m.id === id)

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-12 py-10">
      <Confetti trigger={confetti} />
      {status === 'ended' ? (
        <EndScreen state={state} members={members} />
      ) : phase === 'reveal-word' ? (
        <WordScreen state={state} members={members} />
      ) : phase === 'clues' || phase === 'duel-clues' ? (
        <CluesScreen state={state} byId={byId} />
      ) : phase === 'vote' || phase === 'duel-vote' ? (
        <VoteScreen state={state} byId={byId} />
      ) : phase === 'mrwhite' ? (
        <MrWhiteScreen state={state} byId={byId} />
      ) : phase === 'reveal' ? (
        <RevealScreen state={state} byId={byId} />
      ) : (
        <p className="text-white/40 text-xl">Manche en préparation…</p>
      )}
    </div>
  )
}

function WordScreen({ state, members }: { state: IntrusClientState; members: Member[] }) {
  const total = state.alive.length
  const rules = [
    ['🤫', 'Chacun découvre son mot en secret sur son téléphone.'],
    ['🗣️', 'À tour de rôle, décrivez votre mot à voix haute — un mot, une phrase courte.'],
    ['🕵️', `${state.undercoverCount} intrus a un mot différent… sans le savoir.`],
    ...(state.mrWhiteEnabled ? [['🃏', "Et un Mr. White n'a aucun mot : il improvise."]] : []),
    ['🗳️', 'Puis on vote pour éliminer un suspect.'],
  ] as const

  return (
    <div className="text-center max-w-4xl">
      <span className="text-7xl mb-3 inline-block">🕵️</span>
      <h1 className="text-6xl font-extrabold shimmer-text mb-3">L'Intrus</h1>
      <p className="text-2xl text-white/60 mb-8">
        Regardez votre téléphone — {state.ready.length}/{total} prêt{state.ready.length > 1 ? 's' : ''}
      </p>
      <div className="flex flex-col gap-3 items-start mx-auto w-fit mb-6">
        {rules.map(([emoji, text], i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 * i }}
            className="text-2xl text-white/85 flex gap-3 text-left"
          >
            <span>{emoji}</span>
            <span>{text}</span>
          </motion.p>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {members.map((m) => {
          const ready = state.ready.includes(m.id)
          return (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-full pl-1.5 pr-4 py-1.5 border transition-colors ${
                ready ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-black/30 border-white/10'
              }`}
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={30} photoUrl={m.photoUrl} />
              <span className="text-lg">{m.pseudo}</span>
              <span className="text-sm">{ready ? '✅' : '…'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CluesScreen({ state, byId }: { state: IntrusClientState; byId: (id: string) => Member | undefined }) {
  const speakerId = state.speakers[state.speakerIndex] ?? null
  const speaker = speakerId ? byId(speakerId) : null
  const [left, setLeft] = useState(state.turnSeconds)

  useEffect(() => {
    const startedAt = state.turnStartedAt
    if (!startedAt) {
      setLeft(state.turnSeconds)
      return
    }
    const tick = () => setLeft(Math.max(0, Math.ceil(state.turnSeconds - (Date.now() - startedAt) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [state.turnStartedAt, state.turnSeconds])

  return (
    <div className="text-center w-full max-w-5xl">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-6">
        {state.inDuel ? '⚔️ Duel — indice supplémentaire' : `Tour de parole ${state.speakerIndex + 1} / ${state.speakers.length}`}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={speakerId ?? 'none'}
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="flex flex-col items-center gap-4"
        >
          {speaker && <Avatar pseudo={speaker.pseudo} color={speaker.color} size={150} photoUrl={speaker.photoUrl} />}
          <p className="text-5xl font-extrabold">{speaker?.pseudo ?? '…'}</p>
          <p className="text-2xl text-white/55">🗣️ décris ton mot à voix haute</p>
          <p className={`text-7xl font-extrabold tabular-nums ${left <= 5 ? 'text-pink-300' : 'text-white/80'}`}>{left}s</p>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 justify-center mt-8">
        {state.speakers.map((id, i) => {
          const m = byId(id)
          const done = i < state.speakerIndex
          const active = i === state.speakerIndex
          return (
            <span
              key={id}
              className={`rounded-full px-3 py-1 text-base font-semibold border ${
                active
                  ? 'bg-fuchsia-500/25 border-fuchsia-400/50'
                  : done
                    ? 'bg-white/5 border-white/10 text-white/30 line-through'
                    : 'bg-white/5 border-white/10 text-white/55'
              }`}
            >
              {m?.pseudo ?? '?'}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function VoteScreen({ state, byId }: { state: IntrusClientState; byId: (id: string) => Member | undefined }) {
  const tied = state.tiedIds ?? []
  const isDuel = tied.length > 0
  const shown = isDuel ? tied : state.alive
  const expected = isDuel ? state.alive.filter((id) => !tied.includes(id)).length : state.alive.length

  return (
    <div className="text-center w-full max-w-5xl">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-3">{isDuel ? '⚔️ Revote du duel' : 'Vote'}</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-3">Qui est l'intrus ?</h1>
      <p className="text-2xl text-white/60 mb-10">
        📱 {state.votedCount}/{expected} vote{state.votedCount > 1 ? 's' : ''}
      </p>

      <div className="flex flex-wrap gap-8 justify-center">
        {shown.map((id) => {
          const m = byId(id)
          if (!m) return null
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={isDuel ? 130 : 88} photoUrl={m.photoUrl} />
              <span className={`font-bold ${isDuel ? 'text-3xl' : 'text-xl'}`}>{m.pseudo}</span>
            </motion.div>
          )
        })}
      </div>

      {isDuel && <p className="text-white/40 text-lg mt-8">Les joueurs en duel ne votent pas — ils se défendent.</p>}
    </div>
  )
}

function MrWhiteScreen({ state, byId }: { state: IntrusClientState; byId: (id: string) => Member | undefined }) {
  const last = state.lastElimination
  const m = last ? byId(last.memberId) : null
  return (
    <div className="text-center max-w-3xl">
      <motion.span initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} className="text-8xl inline-block mb-4">
        🃏
      </motion.span>
      <h1 className="text-6xl font-extrabold text-amber-200 mb-4">Mr. White démasqué !</h1>
      {m && (
        <div className="flex items-center justify-center gap-4 mb-6">
          <Avatar pseudo={m.pseudo} color={m.color} size={90} photoUrl={m.photoUrl} />
          <span className="text-4xl font-bold">{m.pseudo}</span>
        </div>
      )}
      <p className="text-3xl text-white/70">Une seule chance de deviner le mot des civils…</p>
      <p className="text-xl text-white/35 mt-4">S'il trouve, il vole la partie à tout le monde 😱</p>
    </div>
  )
}

/**
 * L'élimination — le moment le plus fort du jeu, et la démonstration des primitives.
 *
 * Avant : le rôle apparaissait d'un coup, avec deux `delay` en dur ; le verdict avait le même
 * poids qu'un écran d'attente. Maintenant la scène tient en trois temps — on voit d'abord QUI
 * tombe (la pièce hurle un nom), un silence, PUIS ce qu'il était. C'est cet écart qui fait le
 * moment, et il est désormais identique dans les 17 jeux.
 */
function RevealScreen({ state, byId }: { state: IntrusClientState; byId: (id: string) => Member | undefined }) {
  const last = state.lastElimination
  const m = last ? byId(last.memberId) : null
  const guess = state.mrWhiteGuess

  if (!m || !last) {
    return (
      <Stage kicker="Élimination">
        <p className="text-tv-lg text-chalk-muted">Personne n'a été éliminé.</p>
      </Stage>
    )
  }

  return (
    <Stage
      kicker="Élimination"
      tone={last.role === 'civil' ? 'blood' : 'brass'}
      rail={
        <PlayerRail
          members={state.order.map((id) => byId(id)).filter((x): x is Member => !!x)}
          eliminatedIds={state.eliminated.map((e) => e.memberId)}
          captionFor={(mem) => {
            const e = state.eliminated.find((x) => x.memberId === mem.id)
            return e ? `${ROLE_EMOJI[e.role]} ${ROLE_LABEL[e.role]}` : undefined
          }}
        />
      }
    >
      <Moment
        revealKey={last.memberId}
        // Temps 1 : on voit QUI tombe, mais pas encore ce qu'il était. Tout le suspense est là.
        suspense={
          <div className="flex flex-col items-center gap-4">
            <Avatar pseudo={m.pseudo} color={m.color} size={140} photoUrl={m.photoUrl} />
            <p className="font-stage text-tv-2xl text-chalk">{m.pseudo}</p>
            <p className="text-tv-base text-chalk-faint">était…</p>
          </div>
        }
      >
        {/* Temps 2 et 3 : la bascule, puis le verdict qui RESTE. */}
        <Verdict
          tone={last.role === 'civil' ? 'lose' : 'win'}
          icon={<Avatar pseudo={m.pseudo} color={m.color} size={140} photoUrl={m.photoUrl} />}
          title={`${m.pseudo} — ${ROLE_LABEL[last.role]}`}
          subtitle={
            <>
              {last.role === 'civil' ? 'Un civil de perdu…' : 'Un intrus de moins !'}
              {guess && (
                <>
                  {' · '}Mr. White avait proposé « <b className="text-chalk">{guess.guess}</b> » —{' '}
                  {guess.correct ? 'juste 😱' : 'raté 😅'}
                </>
              )}
            </>
          }
        />
      </Moment>
    </Stage>
  )
}

function EndScreen({ state, members }: { state: IntrusClientState; members: Member[] }) {
  const truth: IntrusTruth | null = state.revealedTruth ?? null
  const info = state.outcome ? OUTCOME_TEXT[state.outcome] : null

  return (
    <div className="text-center w-full max-w-6xl">
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
        <span className="text-8xl block mb-2">{info?.emoji ?? '🏁'}</span>
        <h1 className="text-6xl font-extrabold shimmer-text mb-2">{info?.title ?? 'Fin de partie'}</h1>
        <p className="text-2xl text-white/55 mb-8">{info?.sub}</p>
      </motion.div>

      {truth && (
        <>
          <div className="flex gap-6 justify-center mb-10">
            <div className="rounded-3xl bg-emerald-500/12 border border-emerald-400/25 px-10 py-5">
              <p className="text-sm uppercase tracking-widest text-emerald-200/70 mb-1">Mot des civils</p>
              <p className="text-4xl font-extrabold">{truth.civilWord}</p>
            </div>
            <div className="rounded-3xl bg-pink-500/12 border border-pink-400/25 px-10 py-5">
              <p className="text-sm uppercase tracking-widest text-pink-200/70 mb-1">Mot des intrus</p>
              <p className="text-4xl font-extrabold">{truth.undercoverWord}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            {members
              .filter((m) => truth.roleByMember[m.id])
              .sort((a, b) => truth.roleByMember[a.id].localeCompare(truth.roleByMember[b.id]))
              .map((m, i) => {
                const role = truth.roleByMember[m.id]
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i }}
                    className="flex items-center gap-3 rounded-2xl bg-black/30 border border-white/12 pl-2 pr-5 py-2"
                  >
                    <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
                    <div className="text-left">
                      <p className="text-xl font-bold">{m.pseudo}</p>
                      <p className={`text-base font-semibold ${ROLE_COLOR[role]}`}>
                        {ROLE_EMOJI[role]} {ROLE_LABEL[role]}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
          </div>
        </>
      )}
      <p className="text-white/30 text-xl mt-10">L'hôte peut relancer une partie depuis son téléphone 📱</p>
    </div>
  )
}
