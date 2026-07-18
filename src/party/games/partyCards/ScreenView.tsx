import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { Avatar } from '../../../components/Avatar'
import { PodiumRow } from '../shared/PodiumRow'
import { CARD_TYPE_LABEL } from './types'
import type { PartyCardsClientState } from './types'
import type { Member } from '../../../types'

export function PartyCardsScreen() {
  const group = usePartyStore((s) => s.group)

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const { party, members } = group
  const state = party.roundData as PartyCardsClientState | null

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12">
      {party.status === 'ended' && <FinalPodium members={members} />}

      {party.status !== 'ended' && party.phase === 'card' && state && (
        <CardScreen state={state} members={members} />
      )}

      {party.status !== 'ended' && !party.phase && <p className="text-white/40 text-2xl">Préparation de la carte…</p>}
    </div>
  )
}

function CardScreen({ state, members }: { state: PartyCardsClientState; members: Member[] }) {
  const assigned = members.find((m) => m.id === state.assignedMemberId)
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state.currentCard?.id}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-4xl"
      >
        <p className="text-white/40 text-xl uppercase tracking-widest mb-6">
          Carte {state.history.length + 1} / {state.totalRounds}
        </p>

        <div className="flex flex-col items-center gap-3 mb-8">
          <Avatar pseudo={assigned?.pseudo ?? '?'} color={assigned?.color ?? '#fff'} size={80} />
          <p className="text-3xl font-extrabold shimmer-text">{assigned?.pseudo}</p>
        </div>

        {state.currentCard && (
          <span className="inline-block text-lg font-bold uppercase tracking-wider text-fuchsia-300/80 bg-fuchsia-500/10 rounded-full px-5 py-2 mb-6">
            {CARD_TYPE_LABEL[state.currentCard.type]}
          </span>
        )}
        <p className="text-4xl font-extrabold leading-tight">{state.currentCard?.text}</p>
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members }: { members: Member[] }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="text-center">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Soirée terminée</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🃏 Merci d'avoir joué !</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <PodiumRow key={m.id} rank={i} total={ranked.length} width={420}>
            <span className="text-2xl font-bold w-8 text-white/50">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-white/60 tabular-nums">{m.xp} XP</span>
          </PodiumRow>
        ))}
      </div>
    </div>
  )
}
