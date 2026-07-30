import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { PodiumRow } from '../shared/PodiumRow'
import { Confetti } from '../../../components/Confetti'
import { PlayingCard } from '../shared/PlayingCard'
import { sipLabel } from './types'
import type { PyramidClientState, Accusation } from './types'
import type { Member } from '../../../types'

function accusationLabel(a: Accusation, memberName: (id: string) => string): string {
  const accuser = memberName(a.accuserId)
  const target = memberName(a.targetId)
  const sips = `${a.sips} gorgée${a.sips > 1 ? 's' : ''}`
  switch (a.status) {
    case 'pending':
      return `${accuser} distribue ${sips} à ${target}…`
    case 'accepted':
      return `${target} boit ${sips}`
    case 'awaiting-proof':
      return `${target} doute → ${accuser} doit prouver sa carte`
    case 'contested-wrong':
      return `${target} doutait à tort → boit ${a.sips * 2} gorgées`
    case 'contested-right':
      return `${accuser} bluffait → boit ${a.sips * 2} gorgées`
  }
}

export function PyramidScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const lastStatus = useRef<string | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null

  useEffect(() => {
    if (status === 'ended' && lastStatus.current !== 'ended') {
      play('win')
      setConfettiTrigger((n) => n + 1)
    }
    lastStatus.current = status
  }, [status, play])

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const state = group.party.roundData as PyramidClientState | null
  const memberName = (id: string) => group.members.find((m) => m.id === id)?.pseudo ?? '?'

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-12 py-10">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' && <FinalPodium members={group.members} totals={state?.totalSipsReceived ?? {}} />}

      {status !== 'ended' && phase === 'intro' && <IntroScreen />}

      {status !== 'ended' && phase === 'memorize' && <MemorizeScreen members={group.members} />}

      {status !== 'ended' && phase === 'matching' && state && (
        <MatchingScreen state={state} members={group.members} memberName={memberName} />
      )}

      {status !== 'ended' && phase === 'recitation' && state && (
        <RecitationScreen state={state} members={group.members} />
      )}
    </div>
  )
}

function IntroScreen() {
  return (
    <div className="text-center max-w-3xl">
      <span className="text-7xl mb-4 block">🍻</span>
      <h1 className="text-5xl font-extrabold shimmer-text mb-8">Pyramide</h1>
      <div className="flex flex-col gap-3 text-xl text-chalk-muted text-left">
        <p>🃏 Chacun reçoit 4 cartes secrètes, à mémoriser en 30 secondes.</p>
        <p>🔺 La pyramide se révèle du bas (1 gorgée) au sommet (cul sec).</p>
        <p>👉 Distribuez à qui vous voulez : "Tu bois !" — pas besoin d'avoir la carte.</p>
        <p>🤔 La cible boit, ou dit "tu bluffes !" si elle doute.</p>
        <p>🃏 En cas de doute, un seul essai pour montrer la bonne carte, de mémoire.</p>
        <p>🎭 Bonne carte = double pour qui doutait. Mauvaise carte (ou bluff) = double pour le/la distributeur·rice.</p>
        <p>🧠 À la fin, récitez vos cartes dans l'ordre (valeur ET signe) : 1 gorgée à distribuer par bonne réponse !</p>
      </div>
      <p className="text-chalk-faint text-lg mt-8">L'hôte va lancer la mémorisation…</p>
    </div>
  )
}

const MEMORIZE_SECONDS = 30

function MemorizeScreen({ members }: { members: Member[] }) {
  const [secondsLeft, setSecondsLeft] = useState(MEMORIZE_SECONDS)

  useEffect(() => {
    setSecondsLeft(MEMORIZE_SECONDS)
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-center max-w-3xl">
      <span className="text-7xl mb-4 block">🧠</span>
      <h1 className="text-4xl font-extrabold shimmer-text mb-6">Mémorisez vos cartes !</h1>
      <motion.div key={secondsLeft} initial={{ scale: 1.3, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className="text-8xl font-extrabold tabular-nums mb-10">
        {secondsLeft}s
      </motion.div>
      <div className="flex flex-wrap gap-3 justify-center">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 glass-card rounded-full pl-1.5 pr-4 py-1.5">
            <Avatar pseudo={m.pseudo} color={m.color} size={32} photoUrl={m.photoUrl} />
            <span className="text-lg font-medium">{m.pseudo}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchingScreen({
  state,
  members,
  memberName,
}: {
  state: PyramidClientState
  members: Member[]
  memberName: (id: string) => string
}) {
  const card = state.pyramid[state.currentIndex]
  const cardAccusations = state.accusations.filter((a) => a.cardIndex === state.currentIndex)

  return (
    <div className="flex items-center gap-16 w-full max-w-6xl">
      <PyramidVisual state={state} />

      <div className="flex-1 flex flex-col items-center">
        <p className="text-chalk-faint text-lg uppercase tracking-widest mb-3">
          Carte {state.currentIndex + 1} / {state.pyramid.length}
        </p>
        {card && (
          <>
            <PlayingCard key={state.currentIndex} rank={card.rank} suit={card.suit} size={72} flipReveal />
            <p className="text-2xl font-extrabold mt-3 mb-6">{sipLabel(card.sips)}</p>
          </>
        )}

        <div className="flex flex-col gap-2 w-full max-w-md min-h-[100px]">
          <AnimatePresence initial={false}>
            {cardAccusations.map((a) => (
              <motion.p
                key={a.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-center text-chalk-muted"
              >
                {accusationLabel(a, memberName)}
              </motion.p>
            ))}
          </AnimatePresence>
          {cardAccusations.length === 0 && <p className="text-center text-chalk-faint">Qui ose accuser… ? 👀</p>}
        </div>

        <SipTally members={members} totals={state.totalSipsReceived} />
      </div>
    </div>
  )
}

function PyramidVisual({ state }: { state: PyramidClientState }) {
  const rows: Record<number, PyramidClientState['pyramid']> = {}
  for (const card of state.pyramid) {
    rows[card.row] = rows[card.row] ?? []
    rows[card.row].push(card)
  }
  const rowIndexes = Object.keys(rows).map(Number).sort((a, b) => b - a)

  return (
    <div className="flex flex-col items-center gap-2">
      {rowIndexes.map((rowIdx) => (
        <div key={rowIdx} className="flex gap-2">
          {rows[rowIdx].map((card) => {
            const isCurrent = state.pyramid[state.currentIndex]?.id === card.id
            return (
              <motion.div
                key={card.id}
                animate={isCurrent ? { scale: [1, 1.08, 1] } : {}}
                transition={{ duration: 0.8, repeat: isCurrent ? Infinity : 0 }}
                className={isCurrent ? 'ring-4 ring-fuchsia-400 rounded-lg' : ''}
              >
                <PlayingCard rank={card.rank} suit={card.suit} size={36} faceDown={!card.revealed} />
              </motion.div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function RecitationScreen({ state, members }: { state: PyramidClientState; members: Member[] }) {
  const done = members.filter((m) => !!state.recitation[m.id]).length
  return (
    <div className="text-center max-w-2xl">
      <span className="text-6xl mb-4 block">🧠</span>
      <h1 className="text-4xl font-extrabold shimmer-text mb-4">Récitation finale</h1>
      <p className="text-chalk-soft text-xl mb-8">
        Chacun récite ses cartes de mémoire (valeur + signe, dans l'ordre) sur son téléphone…
      </p>
      <p className="text-chalk-muted text-2xl mb-8 tabular-nums">
        {done} / {members.length} ont terminé
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        {members.map((m) => {
          const entry = state.recitation[m.id]
          return (
            <div key={m.id} className="flex items-center gap-2 glass-card rounded-full pl-1.5 pr-3 py-1.5">
              <Avatar pseudo={m.pseudo} color={m.color} size={28} photoUrl={m.photoUrl} />
              <span className="text-sm font-medium">{m.pseudo}</span>
              <span className="text-sm">
                {entry ? `✅ ${entry.score}/${entry.actualHand.length * 2}` : '⏳'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SipTally({ members, totals }: { members: Member[]; totals: Record<string, number> }) {
  const ranked = [...members].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0))
  return (
    <div className="mt-10 flex flex-wrap gap-3 justify-center">
      {ranked.map((m) => (
        <div key={m.id} className="flex items-center gap-2 glass-card rounded-full pl-1.5 pr-3 py-1.5">
          <Avatar pseudo={m.pseudo} color={m.color} size={28} photoUrl={m.photoUrl} />
          <span className="text-sm font-medium">{m.pseudo}</span>
          <span className="text-sm text-chalk-soft tabular-nums">{totals[m.id] ?? 0}</span>
        </div>
      ))}
    </div>
  )
}

function FinalPodium({ members, totals }: { members: Member[]; totals: Record<string, number> }) {
  const ranked = [...members].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0))
  return (
    <div className="text-center">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">Pyramide terminée</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🍻 Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <PodiumRow key={m.id} rank={i} total={ranked.length} width={420} loserEmoji="🍺">
            <span className="text-2xl font-bold w-8 text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-chalk-soft tabular-nums">{totals[m.id] ?? 0} gorgées</span>
          </PodiumRow>
        ))}
      </div>
      <p className="text-chalk-faint text-lg mt-8">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
    </div>
  )
}
