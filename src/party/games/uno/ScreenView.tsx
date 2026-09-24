import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import type { UnoClientState, UnoCard } from './types'
import {
  COLOR_CLASSES,
  VALUE_LABELS,
} from './types'
import type { Member } from '../../../types'

export function UnoScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const lastSeq = useRef<number>(0)

  const state = (group?.party.roundData as unknown as UnoClientState | null) ?? null

  useEffect(() => {
    const evt = state?.lastEvent
    if (!evt || evt.seq === lastSeq.current) return
    lastSeq.current = evt.seq
    if (evt.type === 'play') play('vote')
    if (evt.type === 'win') play('win')
    if (evt.type === 'uno' || evt.type === 'penalty') play('reveal')
  }, [state?.lastEvent, play])

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const { party, members } = group

  if (party.status === 'ended' || state?.phase === 'ended') {
    const winner = state?.winner
    const winnerMember = winner ? members.find((m) => m.id === winner) : null
    return <FinalScreen winnerMember={winnerMember ?? null} ranking={state?.ranking ?? []} members={members} />
  }

  if (!state || party.phase === 'intro') {
    return (
      <div className="tv-frame">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-4xl"
        >
          <span className="text-8xl mb-6 inline-block">🃏</span>
          <h1 className="text-5xl font-extrabold leading-tight mb-6">UNO</h1>
          <p className="text-chalk-muted text-xl mb-8 max-w-2xl mx-auto">
            Même couleur ou même valeur que la défausse. Avant ta dernière carte, annonce{' '}
            <span className="font-bold text-chalk">UNO</span> — sinon les autres te font piocher. Premier à vider sa
            main <span className="font-bold text-chalk">gagne</span>.
          </p>
          <p className="text-chalk-faint text-lg mt-10">L'hôte lance la partie sur son téléphone 📱</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="tv-frame">
      <PlayingScreen state={state} members={members} />
    </div>
  )
}

// ─── Écran de jeu principal ──────────────────────────────

function PlayingScreen({ state, members }: { state: UnoClientState; members: Member[] }) {
  const topCard = state.topCard
  const currentPlayer = state.currentPlayer
    ? members.find((m) => m.id === state.currentPlayer!.memberId)
    : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full flex flex-col items-center justify-center max-w-6xl mx-auto"
    >
      {/* ─── Header: sens + couleur active ─── */}
      <div className="flex items-center justify-center gap-8 mb-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-chalk-faint uppercase tracking-widest">Sens</span>
          <motion.div
            animate={{ rotate: state.direction === 1 ? 0 : 180 }}
            transition={{ duration: 0.4 }}
            className="text-3xl"
          >
            ↻
          </motion.div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-chalk-faint uppercase tracking-widest">Couleur</span>
          <motion.div
            key={state.currentColor}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`w-12 h-12 rounded-full ${COLOR_CLASSES[state.currentColor]} shadow-lg`}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-chalk-faint uppercase tracking-widest">Pioche</span>
          <div className="w-14 h-20 rounded-xl bg-felt-raised border-2 border-line flex items-center justify-center">
            <span className="text-lg font-bold text-chalk-soft">{state.deckCount}</span>
          </div>
        </div>
      </div>

      {/* ─── Joueur actuel ─── */}
      <AnimatePresence mode="wait">
        {currentPlayer && (
          <motion.div
            key={currentPlayer.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <p className="text-chalk-faint text-lg uppercase tracking-widest mb-2 text-center">Tour de</p>
            <div className="flex items-center justify-center gap-4">
              <Avatar pseudo={currentPlayer.pseudo} color={currentPlayer.color} size={56} photoUrl={currentPlayer.photoUrl} />
              <p className="text-3xl font-extrabold shimmer-text">{currentPlayer.pseudo}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Carte sur la défausse (centre) ─── */}
      <AnimatePresence mode="wait">
        {topCard && (
          <motion.div
            key={topCard.id}
            initial={{ opacity: 0, scale: 0.5, rotateY: 180 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mb-8"
          >
            <BigCard card={topCard} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Joueurs autour avec compte de cartes ─── */}
      <div className="flex flex-wrap items-center justify-center gap-4 max-w-4xl">
        {Object.entries(state.handCounts).map(([pid, count]) => {
          const member = members.find((m) => m.id === pid)
          if (!member) return null
          const isCurrent = state.currentPlayer?.memberId === pid
          const hasUno = state.unoSafeIds.includes(pid) && count <= 2
          return (
            <motion.div
              key={pid}
              animate={isCurrent ? { scale: 1.1 } : { scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all ${
                isCurrent
                  ? 'border-fuchsia-400/50 bg-fuchsia-500/10'
                  : 'border-line bg-felt-raised'
              }`}
            >
              <Avatar pseudo={member.pseudo} color={member.color} size={40} photoUrl={member.photoUrl} />
              <span className="text-sm font-semibold text-chalk">{member.pseudo}</span>
              <AnimatePresence mode="wait">
                {hasUno ? (
                  <motion.span
                    key="uno"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-sm font-extrabold text-amber-300"
                  >
                    UNO !
                  </motion.span>
                ) : (
                  <motion.span
                    key={`count-${count}`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-sm font-bold text-chalk-soft"
                  >
                    {count} 🂠
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* ─── Dernier événement ─── */}
      <AnimatePresence>
        {state.lastEvent && state.lastEvent.type === 'uno' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="mt-6"
          >
            <span className="text-4xl font-extrabold text-amber-300 animate-pulse">
              🗨️ UNO !
            </span>
          </motion.div>
        )}
        {state.lastEvent && state.lastEvent.type === 'penalty' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6"
          >
            <span className="text-2xl font-bold text-blood">
              Contre-UNO ! {members.find((m) => m.id === state.lastEvent?.memberId)?.pseudo} pioche 2 cartes
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Grande carte pour la TV ──────────────────────────────

function BigCard({ card }: { card: UnoCard }) {
  const bgClass = COLOR_CLASSES[card.color] ?? COLOR_CLASSES.wild
  const displayValue = typeof card.value === 'number' ? String(card.value) : (VALUE_LABELS[card.value] ?? '?')
  const isWild = card.color === 'wild'

  return (
    <div className={`relative w-32 h-48 rounded-2xl border-4 border-white/40 flex flex-col items-center justify-center ${bgClass} shadow-2xl`}>
      <span className="absolute top-2 left-2 text-lg font-bold text-white/80">
        {displayValue}
      </span>
      <span className="text-6xl font-extrabold text-white drop-shadow-lg leading-none">
        {displayValue}
      </span>
      <span className="absolute bottom-2 right-2 text-lg font-bold text-white/80 rotate-180">
        {displayValue}
      </span>
      {isWild && (
        <div className="absolute inset-2 rounded-xl border-2 border-white/30 flex items-center justify-center">
          <div className="grid grid-cols-2 gap-0.5 w-12 h-12">
            <div className="rounded-tl bg-red-500" />
            <div className="rounded-tr bg-yellow-500" />
            <div className="rounded-bl bg-green-500" />
            <div className="rounded-br bg-blue-500" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Écran final ──────────────────────────────────────────

function FinalScreen({
  winnerMember,
  ranking,
  members,
}: {
  winnerMember: Member | null
  ranking: { memberId: string; cardsLeft: number }[]
  members: Member[]
}) {
  return (
    <div className="tv-frame text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-10"
      >
        <p className="kicker text-tv-xs mb-4">Main vidée</p>
        {winnerMember && (
          <div className="flex flex-col items-center gap-3 mb-6">
            <Avatar pseudo={winnerMember.pseudo} color={winnerMember.color} size="var(--tv-avatar-stage)" photoUrl={winnerMember.photoUrl} />
            <p className="font-stage text-tv-2xl text-brass">{winnerMember.pseudo}</p>
          </div>
        )}
      </motion.div>

      <div className="flex flex-col gap-3 items-center">
        {ranking.map((r, i) => {
          const m = members.find((x) => x.id === r.memberId)
          if (!m) return null
          return (
            <div key={m.id} className="flex items-center gap-4">
              <span className="text-tv-sm font-bold w-8 text-chalk-soft">{i + 1}</span>
              <Avatar pseudo={m.pseudo} color={m.color} size="var(--tv-avatar-focus)" photoUrl={m.photoUrl} />
              <span className="text-tv-base font-bold text-chalk w-64 text-left">{m.pseudo}</span>
              <span className="text-tv-sm text-chalk-soft">
                {r.cardsLeft === 0 ? 'vainqueur' : `${r.cardsLeft} carte${r.cardsLeft > 1 ? 's' : ''}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
