import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useAppStore } from '../../../store/useAppStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import {
  OUTCOME_TEXT,
  ROLE_COLOR,
  ROLE_EMOJI,
  ROLE_LABEL,
  type IntrusClientState,
  type IntrusTruth,
} from './types'
import type { Member } from '../../../types'
import { HostCue, WaitState } from '../../primitives'

export function IntrusController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const myId = useAppStore((s) => s.identity?.memberId) ?? null
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const phase = group?.party.phase ?? null

  useEffect(() => {
    if (phase && phase !== lastPhase.current) {
      if (phase === 'reveal' || phase === 'ended') play('reveal')
      else if (phase === 'vote' || phase === 'duel-vote') play('tick')
      lastPhase.current = phase
    }
  }, [phase, play])

  if (!group || !myId) return null
  const state = group.party.roundData as IntrusClientState | null
  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-chalk-soft text-sm">Préparation de la partie…</p>
      </div>
    )
  }

  const members = group.members
  const byId = (id: string) => members.find((m) => m.id === id)
  const amAlive = state.alive.includes(myId)

  if (group.party.status === 'ended') {
    return <EndView state={state} members={members} myId={myId} onExit={() => navigate('/lobby')} />
  }

  // Mr. White vient d'être démasqué : il n'est plus « en vie » mais il DOIT pouvoir saisir sa
  // devinette, sinon la partie attend une réponse que personne ne peut donner. Ce cas passe donc
  // avant la redirection des éliminés.
  const owesMrWhiteGuess = phase === 'mrwhite' && state.lastElimination?.memberId === myId && !state.mrWhiteGuess

  // Éliminé : plus de vote, mais accès à toute la vérité (et consigne de silence). L'hôte, lui,
  // GARDE ses commandes de maître du jeu même éliminé — sinon la partie se bloquerait, puisque
  // c'est lui qui fait avancer les manches.
  if (!amAlive && !owesMrWhiteGuess) {
    return (
      <EliminatedView
        state={state}
        members={members}
        myId={myId}
        isHost={isHost}
        phase={phase}
        onAdvance={() => {
          play('pop')
          hostAdvance()
        }}
        onSkipSpeaker={() => {
          play('pop')
          sendAction('spoke', {})
        }}
      />
    )
  }

  if (phase === 'reveal-word') {
    return (
      <WordReveal
        state={state}
        aliveCount={state.alive.length}
        ready={state.ready.includes(myId)}
        onReady={() => {
          play('pop')
          sendAction('ready', {})
        }}
      />
    )
  }

  if (phase === 'clues' || phase === 'duel-clues') {
    return (
      <CluesView
        state={state}
        myId={myId}
        byId={byId}
        isHost={isHost}
        onSpoke={() => {
          play('pop')
          sendAction('spoke', {})
        }}
      />
    )
  }

  if (phase === 'vote' || phase === 'duel-vote') {
    const isDuel = phase === 'duel-vote'
    const tied = state.tiedIds ?? []
    const canVote = isDuel ? !tied.includes(myId) : true
    const targets = (isDuel ? tied : state.alive).filter((id) => id !== myId)
    return (
      <VoteView
        state={state}
        isDuel={isDuel}
        canVote={canVote}
        targets={targets.map((id) => byId(id)).filter((m): m is Member => !!m)}
        onVote={(targetId) => {
          play('vote')
          sendAction('vote', { targetId })
        }}
      />
    )
  }

  if (phase === 'mrwhite') {
    const pending = state.lastElimination
    const isMe = pending?.memberId === myId
    return <MrWhiteView isMe={isMe} state={state} byId={byId} onGuess={(guess) => sendAction('guess', { guess })} />
  }

  if (phase === 'reveal') {
    return <RevealView state={state} byId={byId} isHost={isHost} onNext={() => hostAdvance()} />
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Manche en préparation…</p>
    </div>
  )
}

/** Chrono purement indicatif : il devient rouge à la fin mais ne coupe jamais la parole. */
function useTurnCountdown(startedAt: number | null, seconds: number): number {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (!startedAt) {
      setLeft(seconds)
      return
    }
    const tick = () => setLeft(Math.max(0, Math.ceil(seconds - (Date.now() - startedAt) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [startedAt, seconds])
  return left
}

/** Écran « appuie pour révéler » : évite qu'un voisin lise le mot par-dessus l'épaule. */
function WordReveal({
  state,
  aliveCount,
  ready,
  onReady,
}: {
  state: IntrusClientState
  aliveCount: number
  ready: boolean
  onReady: () => void
}) {
  const [shown, setShown] = useState(false)
  const isMrWhite = state.yourWord === null

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-1">L'Intrus</p>
      <h1 className="text-2xl font-extrabold text-center mb-1">Ton mot secret</h1>
      <p className="text-xs text-chalk-soft text-center mb-6">
        Ne le montre à personne. Tu ne sais pas si tu es civil ou intrus — à toi de le découvrir.
      </p>

      {!shown ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShown(true)}
          className="flex-1 rounded-3xl border border-line bg-felt-raised flex flex-col items-center justify-center gap-3 min-h-52"
        >
          <span className="text-5xl">🤫</span>
          <span className="text-base font-bold">Appuie pour révéler</span>
          <span className="text-xs text-chalk-faint">Cache ton écran des autres</span>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex-1 rounded-3xl border flex flex-col items-center justify-center gap-3 min-h-52 px-5 text-center ${
            isMrWhite ? 'border-amber-400/40 bg-amber-500/10' : 'border-fuchsia-400/30 bg-fuchsia-500/10'
          }`}
        >
          {isMrWhite ? (
            <>
              <span className="text-5xl">🃏</span>
              <p className="text-2xl font-extrabold text-amber-200">Tu es Mr. White</p>
              <p className="text-sm text-chalk-soft">
                Tu n'as aucun mot. Écoute les autres et improvise pour te fondre dans la masse.
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-widest text-chalk-faint">Ton mot</p>
              <p className="text-4xl font-extrabold leading-tight">{state.yourWord}</p>
              <p className="text-xs text-chalk-soft">
                Décris-le sans jamais le prononcer. Si les autres semblent parler d'autre chose… c'est toi l'intrus.
              </p>
            </>
          )}
        </motion.div>
      )}

      <div className="mt-6">
        {ready ? (
          <Card className="text-center">
            <p className="text-2xl mb-1">✅</p>
            <p className="text-sm text-chalk-soft">
              Prêt·e — en attente des autres ({state.ready.length}/{aliveCount})
            </p>
          </Card>
        ) : (
          <Button fullWidth disabled={!shown} onClick={onReady}>
            {shown ? "C'est noté, je suis prêt·e" : 'Révèle ton mot d\'abord'}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Petit rappel du mot, masqué par défaut (on est en soirée, les écrans se croisent). */
function WordPeek({ word }: { word: string | null | undefined }) {
  const [open, setOpen] = useState(false)
  if (word === undefined) return null
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-full rounded-2xl bg-felt-raised border border-line px-4 py-3 text-left active:bg-felt-raised"
    >
      <span className="text-[10px] uppercase tracking-widest text-chalk-faint block">Ton mot</span>
      {open ? (
        <span className="text-lg font-bold">{word === null ? '🃏 Aucun — tu es Mr. White' : word}</span>
      ) : (
        <span className="text-sm text-chalk-soft">•••••• (appuie pour afficher)</span>
      )}
    </button>
  )
}

function CluesView({
  state,
  myId,
  byId,
  isHost,
  onSpoke,
}: {
  state: IntrusClientState
  myId: string
  byId: (id: string) => Member | undefined
  isHost: boolean
  onSpoke: () => void
}) {
  const speakerId = state.speakers[state.speakerIndex] ?? null
  const speaker = speakerId ? byId(speakerId) : null
  const isMyTurn = speakerId === myId
  const left = useTurnCountdown(state.turnStartedAt, state.turnSeconds)

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-1">
        {state.inDuel ? '⚔️ Duel — indice supplémentaire' : 'Tour de parole'}
      </p>
      <p className="text-center text-chalk-soft text-xs mb-5">
        {state.speakerIndex + 1} / {state.speakers.length} · à voix haute
      </p>

      {isMyTurn ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-3xl border border-fuchsia-400/40 bg-fuchsia-500/12 p-6 text-center mb-4"
        >
          <span className="text-4xl block mb-2">🗣️</span>
          <p className="text-2xl font-extrabold mb-1">C'est à toi !</p>
          <p className="text-sm text-chalk-soft">Donne un mot ou une courte phrase qui décrit ton mot — sans le dire.</p>
          <p className={`text-4xl font-extrabold tabular-nums mt-3 ${left <= 5 ? 'text-pink-300' : 'text-chalk-muted'}`}>
            {left}s
          </p>
          <p className="text-[11px] text-chalk-faint mt-1">Le chrono est indicatif, prends le temps qu'il faut.</p>
        </motion.div>
      ) : (
        <Card className="text-center mb-4">
          <p className="text-xs uppercase tracking-widest text-chalk-faint mb-2">Au tour de</p>
          <div className="flex items-center justify-center gap-3">
            {speaker && <Avatar pseudo={speaker.pseudo} color={speaker.color} size={44} photoUrl={speaker.photoUrl} />}
            <span className="text-xl font-bold">{speaker?.pseudo ?? '…'}</span>
          </div>
          <p className={`text-2xl font-extrabold tabular-nums mt-2 ${left <= 5 ? 'text-pink-300' : 'text-chalk-soft'}`}>
            {left}s
          </p>
        </Card>
      )}

      <div className="mb-4">
        <WordPeek word={state.yourWord} />
      </div>

      {/* Ordre de passage */}
      <div className="flex flex-wrap gap-1.5 mb-auto">
        {state.speakers.map((id, i) => {
          const m = byId(id)
          const done = i < state.speakerIndex
          const active = i === state.speakerIndex
          return (
            <span
              key={id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                active
                  ? 'bg-fuchsia-500/25 border-fuchsia-400/50 text-white'
                  : done
                    ? 'bg-felt-raised border-line text-chalk-faint line-through'
                    : 'bg-felt-raised border-line text-chalk-soft'
              }`}
            >
              {m?.pseudo ?? '?'}
            </span>
          )
        })}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {isMyTurn ? (
          <Button fullWidth onClick={onSpoke}>
            J'ai parlé →
          </Button>
        ) : isHost ? (
          <Button variant="secondary" fullWidth onClick={onSpoke} className="!py-2.5 text-sm">
            Passer au suivant (hôte)
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">Écoute bien… et prépare ton indice.</p>
        )}
      </div>
    </div>
  )
}

function VoteView({
  state,
  isDuel,
  canVote,
  targets,
  onVote,
}: {
  state: IntrusClientState
  isDuel: boolean
  canVote: boolean
  targets: Member[]
  onVote: (targetId: string) => void
}) {
  const voted = !!state.yourVote

  if (!canVote) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-3">
        <span className="text-5xl">⚔️</span>
        <p className="text-xl font-extrabold">Tu es en duel</p>
        <p className="text-sm text-chalk-soft">Les autres votent pour décider qui saute. Défends-toi à l'oral !</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-1">
        {isDuel ? '⚔️ Revote du duel' : 'Vote'}
      </p>
      <h1 className="text-2xl font-extrabold text-center mb-6">Qui est l'intrus ?</h1>

      {voted ? (
        <WaitState title="Vote enregistré" actedIds={state.votedMemberIds} noun="ont voté" verb="a voté" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {targets.map((m, i) => (
            <motion.button
              key={m.id}
              onClick={() => onVote(m.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              whileTap={{ scale: 0.95 }}
              className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2"
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={52} photoUrl={m.photoUrl} />
              <span className="text-sm font-semibold">{m.pseudo}</span>
            </motion.button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <WordPeek word={state.yourWord} />
      </div>
    </div>
  )
}

function MrWhiteView({
  isMe,
  state,
  byId,
  onGuess,
}: {
  isMe: boolean
  state: IntrusClientState
  byId: (id: string) => Member | undefined
  onGuess: (guess: string) => void
}) {
  const [value, setValue] = useState('')
  const pending = state.lastElimination
  const who = pending ? byId(pending.memberId) : null
  const already = !!state.mrWhiteGuess

  if (!isMe) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center gap-3">
        <span className="text-5xl">🃏</span>
        <p className="text-xl font-extrabold">Mr. White démasqué !</p>
        <p className="text-sm text-chalk-soft">
          {who?.pseudo ?? 'Il'} a une seule chance de deviner votre mot. S'il trouve, il vole la partie…
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-amber-200/70 text-center mb-1">Tu es démasqué</p>
      <h1 className="text-2xl font-extrabold text-center mb-2">🃏 Ta dernière chance</h1>
      <p className="text-sm text-chalk-soft text-center mb-6">
        Devine le mot des civils. Si tu tombes juste, tu voles la victoire à tout le monde.
      </p>

      {already ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">⏳</p>
          <p className="text-sm text-chalk-soft">Réponse envoyée — verdict dans un instant…</p>
        </Card>
      ) : (
        <>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && value.trim() && onGuess(value.trim())}
            placeholder="Le mot des civils…"
            maxLength={60}
            className="rounded-2xl bg-felt-raised border border-line px-4 py-3.5 text-base text-white placeholder:text-chalk-faint outline-none focus:border-amber-400/60 mb-3"
          />
          <Button fullWidth disabled={!value.trim()} onClick={() => onGuess(value.trim())}>
            Tenter le tout pour le tout
          </Button>
        </>
      )}
    </div>
  )
}

function RevealView({
  state,
  byId,
  isHost,
  onNext,
}: {
  state: IntrusClientState
  byId: (id: string) => Member | undefined
  isHost: boolean
  onNext: () => void
}) {
  const last = state.lastElimination
  const m = last ? byId(last.memberId) : null
  const guess = state.mrWhiteGuess

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">Élimination</p>

      <Card className="text-center mb-4">
        {m && last ? (
          <>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="mb-2 inline-block">
              <Avatar pseudo={m.pseudo} color={m.color} size={64} photoUrl={m.photoUrl} />
            </motion.div>
            <p className="font-extrabold text-lg">{m.pseudo}</p>
            <p className={`text-2xl font-extrabold mt-1 ${ROLE_COLOR[last.role]}`}>
              {ROLE_EMOJI[last.role]} {ROLE_LABEL[last.role]}
            </p>
            {last.role === 'civil' && <p className="text-chalk-soft text-sm mt-1">Aïe… un civil de perdu.</p>}
            {last.role === 'undercover' && <p className="text-chalk-soft text-sm mt-1">Bien joué, un intrus de moins !</p>}
          </>
        ) : (
          <p className="text-chalk-soft text-sm py-4">Personne n'a été éliminé cette fois.</p>
        )}
        {guess && (
          <p className="text-sm mt-3 text-chalk-soft">
            Mr. White a proposé « <b className="text-chalk-muted">{guess.guess}</b> » — {guess.correct ? 'juste 😱' : 'raté 😅'}
          </p>
        )}
      </Card>

      <p className="text-center text-chalk-soft text-sm mb-auto">
        {state.alive.length} joueur{state.alive.length > 1 ? 's' : ''} encore en jeu
      </p>

      {isHost ? (
        <Button fullWidth onClick={onNext}>
          Manche suivante →
        </Button>
      ) : (
        <HostCue action="a la main" />
      )}
    </div>
  )
}

function TruthList({ truth, members }: { truth: IntrusTruth; members: Member[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {members
        .filter((m) => truth.roleByMember[m.id])
        .sort((a, b) => truth.roleByMember[a.id].localeCompare(truth.roleByMember[b.id]))
        .map((m) => {
          const role = truth.roleByMember[m.id]
          return (
            <div key={m.id} className="flex items-center gap-2.5 rounded-xl bg-felt-raised border border-line px-3 py-2">
              <Avatar pseudo={m.pseudo} color={m.color} size={26} photoUrl={m.photoUrl} />
              <span className="text-sm flex-1 truncate">{m.pseudo}</span>
              <span className={`text-xs font-bold ${ROLE_COLOR[role]}`}>
                {ROLE_EMOJI[role]} {ROLE_LABEL[role]}
              </span>
            </div>
          )
        })}
    </div>
  )
}

function WordsPair({ truth }: { truth: IntrusTruth }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      <div className="rounded-2xl bg-emerald-500/12 border border-emerald-400/25 px-3 py-2.5 text-center">
        <p className="text-[10px] uppercase tracking-widest text-emerald-200/70">Mot des civils</p>
        <p className="text-base font-extrabold">{truth.civilWord}</p>
      </div>
      <div className="rounded-2xl bg-pink-500/12 border border-pink-400/25 px-3 py-2.5 text-center">
        <p className="text-[10px] uppercase tracking-widest text-pink-200/70">Mot des intrus</p>
        <p className="text-base font-extrabold">{truth.undercoverWord}</p>
      </div>
    </div>
  )
}

/** Vue des joueurs éliminés : ils savent tout, et doivent se taire. L'hôte y conserve ses boutons
 * d'avancement (il reste maître du jeu même mort). */
function EliminatedView({
  state,
  members,
  myId,
  isHost,
  phase,
  onAdvance,
  onSkipSpeaker,
}: {
  state: IntrusClientState
  members: Member[]
  myId: string
  isHost: boolean
  phase: string | null
  onAdvance: () => void
  onSkipSpeaker: () => void
}) {
  const truth = state.yourTruth
  const myRole = truth?.roleByMember[myId]

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-1">Tu es éliminé·e</p>
      <h1 className="text-2xl font-extrabold text-center mb-2">🤫 Chut !</h1>
      <p className="text-sm text-chalk-soft text-center mb-5">
        Tu connais maintenant toute la vérité. Ne dis rien, savoure — et regarde les autres se déchirer.
      </p>

      {myRole && (
        <Card className="text-center mb-4">
          <p className="text-xs uppercase tracking-widest text-chalk-faint mb-1">Tu étais</p>
          <p className={`text-2xl font-extrabold ${ROLE_COLOR[myRole]}`}>
            {ROLE_EMOJI[myRole]} {ROLE_LABEL[myRole]}
          </p>
        </Card>
      )}

      {truth ? (
        <>
          <WordsPair truth={truth} />
          <TruthList truth={truth} members={members} />
        </>
      ) : (
        <p className="text-center text-chalk-faint text-sm">Vérité indisponible.</p>
      )}

      <p className="text-center text-chalk-faint text-xs mt-6">
        {state.alive.length} joueur{state.alive.length > 1 ? 's' : ''} encore en jeu
      </p>

      {isHost && (
        <div className="mt-4">
          {phase === 'reveal' && (
            <Button fullWidth onClick={onAdvance}>
              Manche suivante →
            </Button>
          )}
          {(phase === 'clues' || phase === 'duel-clues') && (
            <Button variant="secondary" fullWidth onClick={onSkipSpeaker} className="!py-2.5 text-sm">
              Passer au suivant (hôte)
            </Button>
          )}
          <p className="text-center text-chalk-faint text-[11px] mt-2">Tu restes maître du jeu, même éliminé·e.</p>
        </div>
      )}
    </div>
  )
}

function EndView({
  state,
  members,
  myId,
  onExit,
}: {
  state: IntrusClientState
  members: Member[]
  myId: string
  onExit: () => void
}) {
  const truth = state.revealedTruth ?? state.yourTruth ?? null
  const outcome = state.outcome
  const info = outcome ? OUTCOME_TEXT[outcome] : null
  const myRole = truth?.roleByMember[myId]
  const iWon =
    !!myRole &&
    ((outcome === 'civils' && myRole === 'civil') ||
      (outcome === 'infiltres' && myRole !== 'civil') ||
      (outcome === 'mrwhite' && myRole === 'mrwhite'))

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Partie terminée</p>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-4">
        <span className="text-5xl block mb-1">{info?.emoji ?? '🏁'}</span>
        <h1 className="text-2xl font-extrabold shimmer-text">{info?.title ?? 'Fin de partie'}</h1>
        <p className="text-sm text-chalk-soft mt-1">{info?.sub}</p>
        {myRole && (
          <p className={`text-sm mt-3 font-bold ${iWon ? 'text-emerald-300' : 'text-chalk-soft'}`}>
            {iWon ? '🎉 Tu gagnes' : '😬 Tu perds'} — tu étais {ROLE_EMOJI[myRole]} {ROLE_LABEL[myRole]}
          </p>
        )}
      </motion.div>

      {truth && (
        <>
          <WordsPair truth={truth} />
          <TruthList truth={truth} members={members} />
        </>
      )}

      <div className="mt-6">
        <Button fullWidth onClick={onExit}>
          Retour au salon
        </Button>
      </div>
    </div>
  )
}
