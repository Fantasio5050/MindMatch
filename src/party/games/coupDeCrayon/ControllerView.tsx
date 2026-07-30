import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { GroupPulse } from '../../../components/GroupPulse'
import { DrawCanvas, type DrawCanvasHandle } from './DrawCanvas'
import type { CoupDeCrayonClientState } from './types'
import type { Member } from '../../../types'

export function CoupDeCrayonController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()
  const phase = group?.party.phase ?? null
  const lastPhase = useRef<string | null>(null)

  useEffect(() => {
    if (phase && phase !== lastPhase.current) {
      if (phase === 'drawing') play('tick')
      if (phase === 'voting') play('reveal')
      if (phase === 'results') play('win')
      lastPhase.current = phase
    }
  }, [phase, play])

  if (!group || !currentMember) return null
  const { party } = group
  const state = (party.roundData as CoupDeCrayonClientState | null) ?? null

  if (party.status === 'ended' && state) {
    return <FinalResults members={group.members.filter((m) => state.order.includes(m.id))} state={state} onExit={() => navigate('/lobby')} />
  }
  if (!state) {
    return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-chalk-soft text-sm">Taille des crayons…</p></div>
  }

  if (party.phase === 'intro') return <IntroView state={state} isHost={isHost} onStart={() => hostAdvance()} />
  if (party.phase === 'drawing') {
    return (
      <DrawingView
        state={state}
        isHost={isHost}
        onSubmit={(image) => {
          play('vote')
          sendAction('submitDrawing', { image })
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
        onVote={(best, funny) => {
          play('vote')
          sendAction('vote', { best, funny })
        }}
        onAdvance={() => hostAdvance()}
      />
    )
  }
  if (party.phase === 'results') {
    return <ResultsView state={state} members={group.members} selfId={currentMember.id} isHost={isHost} onNext={() => hostAdvance()} />
  }

  return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-chalk-soft text-sm">…</p></div>
}

function IntroView({ state, isHost, onStart }: { state: CoupDeCrayonClientState; isHost: boolean; onStart: () => void }) {
  const rules = [
    ['🎲', 'Un mot est tiré au sort — tout le monde dessine LE MÊME mot.'],
    ['⏱️', `${state.drawSeconds} secondes chrono, puis les dessins partent tout seuls.`],
    ['📺', 'La TV révèle les dessins un par un, anonymement.'],
    ['🏆', 'Chacun vote pour le dessin le MIEUX RÉUSSI…'],
    ['🤣', '…ET pour le plus DRÔLE. Jamais le sien. Deux façons de gagner !'],
  ] as const
  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-6">
        <span className="text-5xl">🖍️</span>
        <h1 className="text-2xl font-extrabold mt-2">Coup de Crayon</h1>
        <p className="text-chalk-faint text-sm">{state.totalRounds} manche{state.totalRounds > 1 ? 's' : ''}</p>
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
          À vos crayons ! 🖍️
        </Button>
      ) : (
        <p className="text-center text-chalk-faint text-sm">En attente que l'hôte distribue les crayons…</p>
      )}
    </div>
  )
}

function DrawingView({
  state,
  isHost,
  onSubmit,
  onAdvance,
}: {
  state: CoupDeCrayonClientState
  isHost: boolean
  onSubmit: (image: string) => void
  onAdvance: () => void
}) {
  const canvasRef = useRef<DrawCanvasHandle>(null)
  const submittedRef = useRef(false)
  const [secondsLeft, setSecondsLeft] = useState(state.drawSeconds)
  const submitted = state.yourSubmission !== null
  const total = state.order.length

  const submitNow = () => {
    if (submittedRef.current || submitted) return
    const image = canvasRef.current?.export()
    if (!image) return
    submittedRef.current = true
    onSubmit(image)
  }

  // Compte à rebours calé sur l'horodatage serveur ; à 0, le dessin part automatiquement.
  useEffect(() => {
    const startedAt = state.drawingStartedAt ?? Date.now()
    const tick = () => {
      const left = Math.max(0, Math.ceil(state.drawSeconds - (Date.now() - startedAt) / 1000))
      setSecondsLeft(left)
      if (left <= 0) submitNow()
    }
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
    // submitNow est stable au sein de la manche (refs) — pas besoin de le suivre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.drawingStartedAt, state.drawSeconds])

  return (
    <div className="min-h-svh flex flex-col px-5 pt-6 pb-6 safe-top">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-widest text-chalk-faint">
          Manche {state.roundsPlayed + 1}/{state.totalRounds}
        </p>
        <motion.span
          key={secondsLeft <= 10 ? secondsLeft : 'calm'}
          initial={secondsLeft <= 10 ? { scale: 1.4 } : false}
          animate={{ scale: 1 }}
          className={`text-lg font-extrabold tabular-nums ${secondsLeft <= 10 ? 'text-pink-300' : 'text-chalk-muted'}`}
        >
          ⏱️ {secondsLeft}s
        </motion.span>
      </div>

      <div className="rounded-2xl bg-[#141019] border border-line px-4 py-3 mb-3 text-center">
        <p className="text-[10px] uppercase tracking-widest text-chalk-faint">Dessine</p>
        <p className="text-lg font-extrabold leading-tight">{state.currentWord}</p>
      </div>

      {submitted ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold mb-2">Dessin rendu !</p>
          {state.yourSubmission && (
            <img src={state.yourSubmission} alt="Ton dessin" className="w-32 mx-auto rounded-xl border border-line-strong mb-2" />
          )}
          {/* Jeu créatif : mode collectif. On montre la progression du groupe et les visages qui
              s'allument, mais on ne nomme JAMAIS le dernier — dessiner prend du temps, et désigner
              un « retardataire » qui fait bien son travail transformerait le jeu en pression. */}
          <GroupPulse
            actedIds={state.submittedMemberIds ?? []}
            expectedIds={state.order}
            noun="créations reçues"
            verb="a rendu son dessin"
            mode="creative"
            className="mt-1"
          />
        </Card>
      ) : (
        <>
          <DrawCanvas ref={canvasRef} />
          <Button fullWidth onClick={submitNow} className="mt-3">
            ✅ J'ai fini !
          </Button>
        </>
      )}

      {isHost && (
        <Button fullWidth variant="ghost" onClick={onAdvance} className="!py-2 text-sm mt-3">
          Forcer la fin du dessin ({state.submittedCount}/{total})
        </Button>
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
  state: CoupDeCrayonClientState
  isHost: boolean
  onVote: (best: number, funny: number) => void
  onAdvance: () => void
}) {
  const [best, setBest] = useState<number | null>(null)
  const [funny, setFunny] = useState<number | null>(null)
  const voted = state.yourVote !== null && state.yourVote !== undefined
  const total = state.order.length

  return (
    <div className="min-h-svh flex flex-col px-5 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-1">Vote — « {state.results?.word ?? state.currentWord} »</p>
      <p className="text-center text-sm text-chalk-soft mb-4">
        Choisis le <b>🏆 mieux réussi</b> et le <b>🤣 plus drôle</b>
      </p>

      {voted ? (
        <Card className="text-center">
          <p className="text-3xl mb-2">🗳️</p>
          <p className="font-semibold mb-1">Vote enregistré !</p>
          <p className="text-chalk-faint text-sm">{state.votedCount}/{total} ont voté…</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {state.gallery.map((g, i) => {
              const isMine = state.yourEntryIndex === i
              return (
                <div key={i} className={`rounded-2xl overflow-hidden border ${isMine ? 'border-dashed border-line-strong opacity-60' : 'border-line-strong'} bg-white`}>
                  <img src={g.image} alt={`Dessin ${i + 1}`} className="w-full" />
                  <div className="flex">
                    {isMine ? (
                      <p className="w-full text-center text-[10px] text-[#1a1030]/60 py-1.5 font-semibold">Ton dessin 🔒</p>
                    ) : (
                      <>
                        <button
                          onClick={() => setBest(best === i ? null : i)}
                          className={`flex-1 py-2 text-lg ${best === i ? 'bg-amber-400' : 'bg-ink/5 active:bg-ink/15'}`}
                          aria-label={`Mieux réussi : dessin ${i + 1}`}
                        >
                          🏆
                        </button>
                        <button
                          onClick={() => setFunny(funny === i ? null : i)}
                          className={`flex-1 py-2 text-lg ${funny === i ? 'bg-fuchsia-400' : 'bg-ink/5 active:bg-ink/15'}`}
                          aria-label={`Plus drôle : dessin ${i + 1}`}
                        >
                          🤣
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <Button
            fullWidth
            disabled={best === null || funny === null}
            onClick={() => best !== null && funny !== null && onVote(best, funny)}
            className="mt-4"
          >
            {best === null || funny === null ? 'Choisis 🏆 et 🤣' : 'Valider mon vote 🗳️'}
          </Button>
        </>
      )}

      {isHost && (
        <Button fullWidth variant="ghost" onClick={onAdvance} className="!py-2 text-sm mt-3">
          Clore les votes ({state.votedCount}/{total})
        </Button>
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
  state: CoupDeCrayonClientState
  members: Member[]
  selfId: string
  isHost: boolean
  onNext: () => void
}) {
  const r = state.results
  if (!r) return null
  const memberName = (id: string) => members.find((m) => m.id === id)?.pseudo ?? '?'
  const last = state.roundsPlayed >= state.totalRounds

  const winnerBlock = (indices: number[], tally: number[], emoji: string, label: string, ring: string) =>
    indices.length > 0 && (
      <Card className={`mb-3 ${ring}`}>
        <p className="text-center text-sm font-bold mb-2">{emoji} {label}</p>
        <div className="flex justify-center gap-3 flex-wrap">
          {indices.map((i) => (
            <div key={i} className="text-center">
              <img src={r.entries[i].image} alt="" className="w-28 rounded-xl border border-line-strong bg-white" />
              <p className="text-xs font-semibold mt-1">
                {memberName(r.entries[i].authorId)}
                {r.entries[i].authorId === selfId ? ' (toi !) 🎉' : ''}
              </p>
              <p className="text-[10px] text-chalk-faint">{tally[i]} vote{tally[i] > 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </Card>
    )

  return (
    <div className="min-h-svh flex flex-col px-5 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-3">
        Résultats — « {r.word} »
      </p>

      {winnerBlock(r.bestWinners, r.bestVotes, '🏆', 'Le mieux réussi', 'border-amber-400/40')}
      {winnerBlock(r.funnyWinners, r.funnyVotes, '🤣', 'Le plus drôle', 'border-fuchsia-400/40')}
      {r.bestWinners.length === 0 && r.funnyWinners.length === 0 && (
        <Card className="mb-3 text-center"><p className="text-chalk-soft text-sm">Aucun vote cette manche… les artistes sont incompris.</p></Card>
      )}

      <div className="grid grid-cols-3 gap-2 mb-4">
        {r.entries.map((e, i) => (
          <div key={i} className="text-center">
            <img src={e.image} alt="" className="w-full rounded-lg border border-line bg-white" />
            <p className="text-[10px] text-chalk-soft mt-0.5 truncate">{memberName(e.authorId)}</p>
            <p className="text-[10px] text-chalk-faint">🏆{r.bestVotes[i]} · 🤣{r.funnyVotes[i]}</p>
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

function FinalResults({ members, state, onExit }: { members: Member[]; state: CoupDeCrayonClientState; onExit: () => void }) {
  const ranked = rankArtists(members, state)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Coup de Crayon terminé</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🖍️ Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={32} photoUrl={m.photoUrl} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-chalk-soft">
              🏆{state.artScore[m.id] ?? 0} · 🤣{state.funScore[m.id] ?? 0}
            </span>
          </Card>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}

/** Classement final : total couronnes (art + fun), départagé à l'art. Partagé avec la TV. */
export function rankArtists(members: Member[], state: CoupDeCrayonClientState): Member[] {
  const total = (id: string) => (state.artScore[id] ?? 0) + (state.funScore[id] ?? 0)
  return [...members].sort((a, b) => {
    if (total(b.id) !== total(a.id)) return total(b.id) - total(a.id)
    return (state.artScore[b.id] ?? 0) - (state.artScore[a.id] ?? 0)
  })
}
