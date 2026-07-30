import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Player } from '../../../components/Player'
import { Confetti } from '../../../components/Confetti'
import { Stage, Moment, Verdict, PlayerRail } from '../../primitives'
import {
  OUTCOME_TEXT,
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
      // Pas de son sur la phase `reveal` : c'est `Moment` qui le joue, à l'instant exact de la
      // bascule. Le déclencher ici le faisait tomber 600 ms avant l'image.
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
        <p className="text-tv-xs text-chalk-soft">Connexion à la salle…</p>
      </div>
    )
  }
  const state = group.party.roundData as IntrusClientState | null
  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-tv-xs text-chalk-soft">Préparation de la partie…</p>
      </div>
    )
  }

  const members = group.members
  const byId = (id: string) => members.find((m) => m.id === id)

  // `Stage` porte lui-même la pleine hauteur et les marges de scène : le conteneur ne fait plus
  // que superposer les confettis.
  return (
    <div className="relative">
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
        <Stage kicker="Manche">
          <p className="text-tv-base text-chalk-soft">Préparation…</p>
        </Stage>
      )}
    </div>
  )
}

/**
 * La distribution des mots.
 *
 * Les joueurs prêts n'ont plus une pastille verte avec « ✅ » et les autres un « … » : ils portent
 * l'état `acted` du `Player`, comme partout ailleurs. La TV montre donc l'avancée du groupe, pas
 * une liste de statuts — et personne n'est désigné comme le retardataire.
 */
function WordScreen({ state, members }: { state: IntrusClientState; members: Member[] }) {
  const total = state.alive.length
  const rules = [
    'Chacun découvre son mot en secret, sur son téléphone.',
    'À tour de rôle, décrivez votre mot à voix haute — un mot, une phrase courte.',
    `${state.undercoverCount} intrus a un mot différent… sans le savoir.`,
    ...(state.mrWhiteEnabled ? ["Et un Mr. White n'a aucun mot : il improvise."] : []),
    'Puis on vote pour éliminer un suspect.',
  ]

  return (
    <Stage
      kicker="Distribution"
      title="L'Intrus"
      rail={
        <div className="text-center">
          <PlayerRail members={members} actedIds={state.ready} className="mb-4" />
          <p className="text-tv-xs text-chalk-faint">
            Regardez votre téléphone — {state.ready.length}/{total} prêt{state.ready.length > 1 ? 's' : ''}
          </p>
        </div>
      }
    >
      <ol className="flex flex-col gap-4 items-start w-fit">
        {rules.map((text, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 * i }}
            className="text-tv-base text-chalk-muted flex gap-5 text-left"
          >
            <span className="font-stage text-brass-dim shrink-0 w-8">{i + 1}</span>
            <span>{text}</span>
          </motion.li>
        ))}
      </ol>
    </Stage>
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

  const speakerMembers = state.speakers.map((id) => byId(id)).filter((m): m is Member => !!m)
  const spoken = state.speakers.slice(0, state.speakerIndex)

  return (
    <Stage
      kicker={state.inDuel ? 'Duel — indice supplémentaire' : `Tour de parole ${state.speakerIndex + 1} / ${state.speakers.length}`}
      tone={state.inDuel ? 'blood' : 'neutral'}
      rail={
        <PlayerRail
          members={speakerMembers}
          order={state.speakers}
          speakingId={speakerId}
          actedIds={spoken}
        />
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={speakerId ?? 'none'}
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="flex flex-col items-center gap-5"
        >
          {speaker && <Avatar pseudo={speaker.pseudo} color={speaker.color} size={150} photoUrl={speaker.photoUrl} />}
          <p className="font-stage text-tv-2xl text-chalk">{speaker?.pseudo ?? '…'}</p>
          <p className="text-tv-base text-chalk-soft">décris ton mot à voix haute</p>
          {/* Le chrono passe au spark dans les 5 dernières secondes : la seule couleur qui a le
              droit de crier sert ici à faire monter la tension dans la pièce. */}
          <p className={`font-stage text-tv-3xl tabular-nums ${left <= 5 ? 'text-spark' : 'text-chalk-muted'}`}>{left}s</p>
        </motion.div>
      </AnimatePresence>
    </Stage>
  )
}

function VoteScreen({ state, byId }: { state: IntrusClientState; byId: (id: string) => Member | undefined }) {
  const tied = state.tiedIds ?? []
  const isDuel = tied.length > 0
  const shown = isDuel ? tied : state.alive
  const expected = isDuel ? state.alive.filter((id) => !tied.includes(id)).length : state.alive.length

  const shownMembers = shown.map((id) => byId(id)).filter((m): m is Member => !!m)

  return (
    <Stage
      kicker={isDuel ? 'Revote du duel' : 'Vote'}
      title="Qui est l'intrus ?"
      tone={isDuel ? 'blood' : 'spark'}
      rail={
        <p className="text-tv-xs text-chalk-faint text-center">
          {isDuel
            ? 'Les joueurs en duel ne votent pas — ils se défendent.'
            : 'Le vote reste secret jusqu’au dépouillement.'}
        </p>
      }
    >
      {/* Le compteur monte, les noms des votants ne sont jamais affichés :
          « l'action est publique, le choix reste privé ». */}
      <p className="text-tv-lg text-chalk-muted mb-10">
        {state.votedCount}/{expected} vote{state.votedCount > 1 ? 's' : ''} déposé
        {state.votedCount > 1 ? 's' : ''}
      </p>

      <div className="flex flex-wrap gap-x-10 gap-y-6 justify-center">
        {shownMembers.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Player member={m} size={isDuel ? 'stage' : 'focus'} />
          </motion.div>
        ))}
      </div>
    </Stage>
  )
}

function MrWhiteScreen({ state, byId }: { state: IntrusClientState; byId: (id: string) => Member | undefined }) {
  const last = state.lastElimination
  const m = last ? byId(last.memberId) : null
  return (
    <Stage
      kicker="Dernière carte"
      title="Mr. White démasqué"
      tone="brass"
      rail={
        <p className="text-tv-xs text-chalk-faint text-center">
          S'il trouve, il vole la partie à tout le monde.
        </p>
      }
    >
      {m && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8">
          <Player member={m} size="stage" />
        </motion.div>
      )}
      <p className="text-tv-lg text-chalk-muted">Une seule chance de deviner le mot des civils…</p>
    </Stage>
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
        tone={last.role === 'civil' ? 'lose' : 'win'}
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

  const cast = truth
    ? members
        .filter((m) => truth.roleByMember[m.id])
        .sort((a, b) => truth.roleByMember[a.id].localeCompare(truth.roleByMember[b.id]))
    : []

  return (
    <Stage
      kicker="Fin de partie"
      title={info?.title ?? 'Fin de partie'}
      tone="brass"
      rail={
        <div className="text-center">
          {/* Le casting complet reste à l'écran : c'est le moment où la pièce comprend qui
              mentait depuis le début, et où les commentaires partent. */}
          {cast.length > 0 && (
            <PlayerRail
              members={cast}
              hostId={null}
              captionFor={(m) => {
                const role = truth!.roleByMember[m.id]
                return `${ROLE_EMOJI[role]} ${ROLE_LABEL[role]}`
              }}
              className="mb-4"
            />
          )}
          <p className="text-tv-xs text-chalk-faint">L'hôte peut relancer une partie depuis son téléphone.</p>
        </div>
      }
    >
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-tv-lg text-chalk-muted mb-10"
      >
        {info?.sub}
      </motion.p>

      {truth && (
        <div className="flex gap-8 justify-center">
          <div className="rounded-card border border-line bg-felt px-12 py-6">
            <p className="kicker text-tv-xs mb-2">Mot des civils</p>
            <p className="font-stage text-tv-xl text-jade">{truth.civilWord}</p>
          </div>
          <div className="rounded-card border border-line bg-felt px-12 py-6">
            <p className="kicker text-tv-xs mb-2">Mot des intrus</p>
            <p className="font-stage text-tv-xl text-spark">{truth.undercoverWord}</p>
          </div>
        </div>
      )}
    </Stage>
  )
}
