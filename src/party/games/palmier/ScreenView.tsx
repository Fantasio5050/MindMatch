import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { CardFace } from '../pyramid/CardFace'
import type { PalmierClientState } from './types'
import type { Member } from '../../../types'

export function PalmierScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const lastStatus = useRef<string | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const status = group?.party.status ?? null
  const phase = group?.party.phase ?? null

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
        <p className="text-white/40 text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const state = group.party.roundData as PalmierClientState | null

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-12 py-10">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' && <FinalPodium members={group.members} totals={state?.totalSipsReceived ?? {}} />}

      {status !== 'ended' && phase === 'intro' && <IntroScreen />}

      {status !== 'ended' && phase === 'drawing' && state && <DrawingScreen state={state} members={group.members} />}
    </div>
  )
}

function IntroScreen() {
  return (
    <div className="text-center max-w-3xl">
      <span className="text-7xl mb-4 block">🌴</span>
      <h1 className="text-5xl font-extrabold shimmer-text mb-8">Palmier</h1>
      <div className="flex flex-col gap-3 text-xl text-white/70 text-left">
        <p>🃏 52 cartes tirées une par une, à tour de rôle.</p>
        <p>❤️♦️ As, 2, 3 rouges = tu bois. ♠️♣️ noirs = tu distribues.</p>
        <p>✋ 4 = Four to the floor, 5 = Five to the fly — le/la dernier·ère boit.</p>
        <p>👈👉 6 = voisin·e de gauche boit, 7 = voisin·e de droite boit.</p>
        <p>🤝 8 = complice, 9 = rime, 10 = catégorie, Valet = nouvelle règle, Dame = question.</p>
        <p>👑 Roi = tu verses dans le verre central — le 4e Roi le boit cul sec !</p>
      </div>
      <p className="text-white/30 text-lg mt-8">L'hôte va lancer la première carte…</p>
    </div>
  )
}

function DrawingScreen({ state, members }: { state: PalmierClientState; members: Member[] }) {
  const drawer = members.find((m) => m.id === state.drawerMemberId)
  const lastLog = state.log[state.log.length - 1]
  const recentLog = [...state.log].slice(-5).reverse()

  return (
    <div className="flex items-center gap-16 w-full max-w-6xl">
      <div className="flex flex-col items-center gap-4">
        {state.currentCard && (
          <motion.div
            key={state.currentCard.id}
            initial={{ scale: 0.7, opacity: 0, rotateY: 90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ duration: 0.4 }}
          >
            <CardFace rank={state.currentCard.rank} suit={state.currentCard.suit} size={140} />
          </motion.div>
        )}
        <p className="text-white/40 text-lg uppercase tracking-widest">
          Carte {state.currentIndex + 1} / {state.totalCards}
        </p>
        {drawer && (
          <div className="flex items-center gap-2">
            <Avatar pseudo={drawer.pseudo} color={drawer.color} size={40} />
            <span className="text-xl font-semibold">{drawer.pseudo}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center">
        {state.ruleText && (
          <div className="glass-card rounded-2xl px-6 py-3 text-center text-lg text-fuchsia-300/90 mb-4">
            📜 Règle active : « {state.ruleText} »
          </div>
        )}

        <motion.p
          key={state.currentCard?.id ?? 'label'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-extrabold text-center leading-snug mb-6 max-w-xl"
        >
          {state.label}
        </motion.p>

        {!state.resolved && (
          <p className="text-white/40 text-xl mb-6">
            {state.effect === 'race' || state.effect === 'challenge'
              ? "En attente du jugement de l'hôte…"
              : `En attente de ${drawer?.pseudo}…`}
          </p>
        )}
        {state.resolved && lastLog && (
          <p className="text-emerald-300/90 text-2xl font-semibold mb-6">✅ {lastLog.text}</p>
        )}

        <div className="flex flex-col gap-1.5 w-full max-w-md">
          <AnimatePresence initial={false}>
            {recentLog.map((entry, i) => (
              <motion.p
                key={`${entry.card.id}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1 - i * 0.15, x: 0 }}
                className="text-center text-white/50 text-sm"
              >
                {entry.text}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>

        <SipTally members={members} totals={state.totalSipsReceived} />
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
          <Avatar pseudo={m.pseudo} color={m.color} size={28} />
          <span className="text-sm font-medium">{m.pseudo}</span>
          <span className="text-sm text-white/50 tabular-nums">{totals[m.id] ?? 0}</span>
        </div>
      ))}
    </div>
  )
}

function FinalPodium({ members, totals }: { members: Member[]; totals: Record<string, number> }) {
  const ranked = [...members].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0))
  return (
    <div className="text-center">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Palmier terminé</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🌴 Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="flex items-center gap-4 glass-card rounded-2xl px-8 py-4 w-[420px]"
          >
            <span className="text-2xl font-bold w-8 text-white/50">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-white/60 tabular-nums">{totals[m.id] ?? 0} gorgées</span>
          </motion.div>
        ))}
      </div>
      <p className="text-white/30 text-lg mt-8">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
    </div>
  )
}
