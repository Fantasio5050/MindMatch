import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { CardFace } from '../pyramid/CardFace'
import { QUESTION_META, CHOICE_META, choiceLabel } from './types'
import type { AutorouteClientState, AutorouteChoice, AutorouteTrackCell } from './types'
import type { Member } from '../../../types'

export function AutorouteController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const phase = group?.party.phase ?? null

  const state = group?.party.roundData as AutorouteClientState | null
  const myLastResult = state?.history[state.history.length - 1]?.results[currentMember?.id ?? '']

  useEffect(() => {
    if (phase === 'reveal' && lastPhase.current !== 'reveal') {
      if (myLastResult) play(myLastResult.correct ? 'reveal' : 'lose')
      else play('reveal')
    }
    lastPhase.current = phase
    // myLastResult is derived from the same update that flips the phase — including it would not change behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, play])

  if (!group || !currentMember || !state) return null
  const { party } = group

  if (party.status === 'ended') {
    return (
      <FinalResults
        members={group.members.filter((m) => party.participantIds.includes(m.id))}
        state={state}
        onExit={() => navigate('/lobby')}
      />
    )
  }

  if (party.phase === 'intro') {
    return <IntroView trackLength={state.track.length} isHost={isHost} onStart={() => hostAdvance()} />
  }

  if (party.phase === 'predicting') {
    return (
      <PredictingView
        state={state}
        group={{ participantIds: party.participantIds, members: group.members }}
        selfId={currentMember.id}
        onPredict={(choice) => {
          play('vote')
          sendAction('predict', { choice })
        }}
      />
    )
  }

  if (party.phase === 'reveal') {
    return (
      <RevealView state={state} members={group.members} selfId={currentMember.id} isHost={isHost} onNext={() => hostAdvance()} />
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-white/50 text-sm">Préparation de la manche…</p>
    </div>
  )
}

function IntroView({ trackLength, isHost, onStart }: { trackLength: number; isHost: boolean; onStart: () => void }) {
  const rules = [
    ['🛣️', `L'autoroute fait ${trackLength} cases : des cartes à deviner et des péages.`],
    ['🔁', 'Le cycle des questions : Plus haut/plus bas → Rouge/noir → Inter/Exter, et ça recommence.'],
    ['↔️', 'Inter/Exter : la prochaine carte sera-t-elle ENTRE tes 2 dernières cartes, ou à l\'extérieur ? Égalité avec une borne = perdu !'],
    ['💰', 'Péage : passage obligatoire, 1 gorgée, on ne s\'y arrête pas.'],
    ['❌', 'Mauvaise réponse : 1 gorgée et tu recules d\'une case.'],
    ['🏁', 'Le premier au bout de l\'autoroute a gagné — les autres continuent de rouler !'],
  ] as const

  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-6">
        <span className="text-5xl">🛣️</span>
        <h1 className="text-2xl font-extrabold mt-2">Autoroute</h1>
      </div>
      <Card className="mb-6">
        <ul className="flex flex-col gap-3 text-sm text-white/80">
          {rules.map(([emoji, text], i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="flex gap-2"
            >
              <span className="shrink-0">{emoji}</span>
              <span>{text}</span>
            </motion.li>
          ))}
        </ul>
      </Card>
      {isHost ? (
        <Button fullWidth onClick={onStart}>
          Départ ! 🏎️
        </Button>
      ) : (
        <p className="text-center text-white/40 text-sm">En attente que l'hôte donne le départ…</p>
      )}
      <p className="text-center text-white/20 text-xs mt-6">💧 Tu peux toujours remplacer l'alcool par de l'eau.</p>
    </div>
  )
}

export function TrackStrip({
  track,
  positions,
  finished,
  members,
  selfId,
  cellSize = 18,
}: {
  track: AutorouteTrackCell[]
  positions: Record<string, number>
  finished: Record<string, boolean>
  members: Member[]
  selfId?: string
  cellSize?: number
}) {
  return (
    <div className="flex items-end justify-center gap-1 flex-wrap">
      {track.map((cell, i) => {
        const here = members.filter((m) => !finished[m.id] && (positions[m.id] ?? 0) === i)
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className="flex -space-x-1.5 h-4 items-end">
              {here.map((m) => (
                <span
                  key={m.id}
                  className={`rounded-full border ${m.id === selfId ? 'border-white' : 'border-black/40'}`}
                  style={{ width: 10, height: 10, background: m.color }}
                  title={m.pseudo}
                />
              ))}
            </div>
            <div
              className={`rounded flex items-center justify-center ${
                cell.type === 'toll' ? 'bg-amber-400/25 border border-amber-300/40' : 'bg-white/10 border border-white/10'
              }`}
              style={{ width: cellSize, height: cellSize * 1.3, fontSize: cellSize * 0.55 }}
            >
              {cell.type === 'toll' ? '💰' : QUESTION_ICON[cell.kind]}
            </div>
          </div>
        )
      })}
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex -space-x-1.5 h-4 items-end">
          {members
            .filter((m) => finished[m.id])
            .map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-black/40"
                style={{ width: 10, height: 10, background: m.color }}
                title={m.pseudo}
              />
            ))}
        </div>
        <div className="flex items-center justify-center" style={{ height: cellSize * 1.3, fontSize: cellSize * 0.8 }}>
          🏁
        </div>
      </div>
    </div>
  )
}

const QUESTION_ICON: Record<string, string> = {
  'higher-lower': '↕️',
  'red-black': '🔴',
  'inter-exter': '↔️',
}

function PredictingView({
  state,
  group,
  selfId,
  onPredict,
}: {
  state: AutorouteClientState
  group: { participantIds: string[]; members: Member[] }
  selfId: string
  onPredict: (choice: AutorouteChoice) => void
}) {
  const participants = group.members.filter((m) => group.participantIds.includes(m.id))
  const activeCount = group.participantIds.filter((id) => !state.finished[id]).length
  const hasVoted = !!state.yourVote
  const iAmFinished = !!state.finished[selfId]
  const position = state.positions[selfId] ?? 0
  const cell = state.track[position]
  const recent = state.recentCards[selfId] ?? []
  const kind = cell?.type === 'question' ? cell.kind : null

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-3">
        Case {Math.min(position + 1, state.track.length)} / {state.track.length}
      </p>

      <div className="mb-6">
        <TrackStrip
          track={state.track}
          positions={state.positions}
          finished={state.finished}
          members={participants}
          selfId={selfId}
          cellSize={14}
        />
      </div>

      {iAmFinished ? (
        <Card className="text-center">
          <p className="text-4xl mb-2">🏁</p>
          <p className="font-semibold mb-1">Tu as fini l'autoroute !</p>
          <p className="text-white/50 text-sm">Regarde les autres transpirer… ({state.votedCount}/{activeCount} ont parié)</p>
        </Card>
      ) : hasVoted ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold mb-1">Pari enregistré : {state.yourVote ? choiceLabel(state.yourVote) : ''}</p>
          <p className="text-white/50 text-sm">
            En attente des autres… ({state.votedCount}/{activeCount})
          </p>
        </Card>
      ) : kind ? (
        <>
          <div className="flex flex-col items-center mb-6">
            {kind === 'higher-lower' && recent.length > 0 && (
              <>
                <CardFace rank={recent[recent.length - 1].rank} suit={recent[recent.length - 1].suit} size={72} />
                <p className="text-white/50 text-sm mt-3">Ta carte de référence</p>
              </>
            )}
            {kind === 'red-black' && (
              <>
                <CardFace faceDown size={72} />
                <p className="text-white/50 text-sm mt-3">La prochaine carte sera…</p>
              </>
            )}
            {kind === 'inter-exter' && recent.length >= 2 && (
              <>
                <div className="flex gap-3">
                  <CardFace rank={recent[recent.length - 2].rank} suit={recent[recent.length - 2].suit} size={64} />
                  <CardFace rank={recent[recent.length - 1].rank} suit={recent[recent.length - 1].suit} size={64} />
                </div>
                <p className="text-white/50 text-sm mt-3">Entre ces deux cartes… ou pas ?</p>
              </>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-center mb-5">{QUESTION_META[kind].title}</h2>

          <div className="flex flex-col gap-4">
            {QUESTION_META[kind].options.map((choice, i) => (
              <motion.button
                key={choice}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPredict(choice)}
                className={`glass-card rounded-3xl p-6 text-center border ${i === 0 ? 'border-emerald-400/20' : 'border-sky-400/20'}`}
              >
                <span className="text-4xl mb-2 block">{CHOICE_META[choice].emoji}</span>
                <p className="text-lg font-bold">{CHOICE_META[choice].label}</p>
              </motion.button>
            ))}
          </div>
          {kind === 'inter-exter' && (
            <p className="text-center text-white/30 text-xs mt-4">Égalité avec une des deux cartes = perdu !</p>
          )}
          {kind === 'higher-lower' && <p className="text-center text-white/30 text-xs mt-4">Égalité = perdu !</p>}
        </>
      ) : null}

      <p className="text-center text-white/30 text-xs mt-6">❌ Raté : 1 gorgée et tu recules d'une case · 💰 Péage : 1 gorgée</p>
    </div>
  )
}

function RevealView({
  state,
  members,
  selfId,
  isHost,
  onNext,
}: {
  state: AutorouteClientState
  members: Member[]
  selfId: string
  isHost: boolean
  onNext: () => void
}) {
  const last = state.history[state.history.length - 1]
  const myResult = last?.results[selfId]
  // Participants are exactly the members with a position entry (latecomers have none).
  const participants = members.filter((m) => m.id in state.positions)
  const everyoneFinished = participants.every((m) => state.finished[m.id])

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-4">Résultat</p>

      {myResult ? (
        <Card className="text-center mb-4">
          <div className="flex justify-center mb-3">
            <CardFace rank={myResult.drawnCard.rank} suit={myResult.drawnCard.suit} size={64} />
          </div>
          <p className="text-xs text-white/40 mb-2">
            Ton pari : {choiceLabel(myResult.choice)}
          </p>
          {myResult.correct ? (
            <p className="text-emerald-300 text-sm font-semibold">
              ✅ Bien joué ! {myResult.finished ? "Tu franchis l'arrivée 🏁" : 'Tu avances d\'une case'}
              {myResult.tollSips > 0 && ` — péage : ${myResult.tollSips} gorgée${myResult.tollSips > 1 ? 's' : ''} 💰`}
            </p>
          ) : (
            <p className="text-pink-300 text-sm font-semibold">
              ❌ Raté ! 1 gorgée et tu recules d'une case
            </p>
          )}
        </Card>
      ) : (
        <Card className="text-center mb-4">
          <p className="text-white/40 text-sm">🏁 Déjà arrivé·e — tu regardes tranquillement.</p>
        </Card>
      )}

      <div className="mb-4">
        <TrackStrip
          track={state.track}
          positions={state.positions}
          finished={state.finished}
          members={participants}
          selfId={selfId}
          cellSize={14}
        />
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {members.map((m) => {
          const result = last?.results[m.id]
          if (!result) return null
          return (
            <div key={m.id} className="flex items-center gap-3">
              <Avatar pseudo={m.pseudo} color={m.color} size={30} photoUrl={m.photoUrl} />
              <span className="text-sm flex-1 truncate">{m.pseudo}</span>
              <CardFace rank={result.drawnCard.rank} suit={result.drawnCard.suit} size={26} />
              <span className={`text-sm font-bold ${result.correct ? 'text-emerald-300' : 'text-pink-300'}`}>
                {result.finished
                  ? '🏁'
                  : result.correct
                    ? result.tollSips > 0
                      ? `✅ +${result.tollSips}💰`
                      : '✅'
                    : '❌ +1 🍻'}
              </span>
            </div>
          )
        })}
      </div>

      {isHost ? (
        <Button fullWidth onClick={onNext}>
          {everyoneFinished ? 'Voir les résultats finaux' : 'Manche suivante →'}
        </Button>
      ) : (
        <p className="text-center text-white/40 text-sm">En attente de l'hôte pour continuer…</p>
      )}
    </div>
  )
}

function FinalResults({
  members,
  state,
  onExit,
}: {
  members: Member[]
  state: AutorouteClientState
  onExit: () => void
}) {
  const totals = state.totalSipsReceived
  const ranked = [...members].sort((a, b) => {
    const fa = state.finishOrder.indexOf(a.id)
    const fb = state.finishOrder.indexOf(b.id)
    if (fa !== -1 && fb !== -1) return fa - fb
    if (fa !== -1) return -1
    if (fb !== -1) return 1
    return (totals[a.id] ?? 0) - (totals[b.id] ?? 0)
  })

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Autoroute terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🛣️ Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-white/50">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-white/60">{totals[m.id] ?? 0} gorgée{(totals[m.id] ?? 0) !== 1 ? 's' : ''}</span>
          </Card>
        ))}
      </div>
      <p className="text-center text-white/30 text-xs mb-4">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
