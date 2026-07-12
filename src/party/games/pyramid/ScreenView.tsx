import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { CardFace } from './CardFace'
import type { PyramidClientState } from './types'
import type { Member } from '../../../types'

function sipLabel(sips: number | 'culsec'): string {
  if (sips === 'culsec') return 'CUL SEC 🥃'
  return `${sips} gorgée${sips > 1 ? 's' : ''}`
}

export function PyramidScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null

  useEffect(() => {
    if (phase === 'revealed' && lastPhase.current !== 'revealed') play('reveal')
    if (status === 'ended' && lastPhase.current !== 'ended-fx') {
      play('win')
      setConfettiTrigger((n) => n + 1)
    }
    lastPhase.current = status === 'ended' ? 'ended-fx' : phase
  }, [phase, status, play])

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const state = group.party.roundData as PyramidClientState | null
  const memberName = (id: string) => group.members.find((m) => m.id === id)?.pseudo ?? '?'

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-12 py-10">
      <Confetti trigger={confettiTrigger} />

      {status === 'ended' ? (
        <FinalPodium members={group.members} totals={state?.totalSipsReceived ?? {}} />
      ) : state ? (
        <div className="flex items-center gap-16 w-full max-w-6xl">
          <PyramidVisual state={state} />

          <div className="flex-1 flex flex-col items-center">
            <AnimatePresence mode="wait">
              {group.party.phase === 'matching' && (
                <motion.div key="matching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                  <p className="text-white/40 text-lg uppercase tracking-widest mb-2">Carte révélée</p>
                  <p className="text-3xl font-extrabold mb-4">{sipLabel(state.pyramid[state.currentIndex]?.sips)}</p>
                  <p className="text-white/40 text-lg">Regardez vos téléphones 📱</p>
                </motion.div>
              )}

              {group.party.phase === 'revealed' && (
                <motion.div
                  key="revealed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-md"
                >
                  <p className="text-white/40 text-lg uppercase tracking-widest mb-3 text-center">Résultat</p>
                  {state.pyramid[state.currentIndex]?.plays.length === 0 ? (
                    <p className="text-center text-white/50 text-xl">Aucun match sur cette carte.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {state.pyramid[state.currentIndex]?.plays.map((p, i) => (
                        <motion.p
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.12 * i }}
                          className="text-lg text-center"
                        >
                          <b>{memberName(p.memberId)}</b> ➜ <b>{memberName(p.targetMemberId)}</b>
                        </motion.p>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <SipTally members={group.members} totals={state.totalSipsReceived} />
          </div>
        </div>
      ) : (
        <p className="text-white/40 text-2xl">Préparation de la pyramide…</p>
      )}
    </div>
  )
}

function PyramidVisual({ state }: { state: PyramidClientState }) {
  const rows: Record<number, PyramidClientState['pyramid']> = {}
  for (const card of state.pyramid) {
    rows[card.row] = rows[card.row] ?? []
    rows[card.row].push(card)
  }
  const rowIndexes = Object.keys(rows).map(Number).sort((a, b) => b - a) // top row first visually

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
                <CardFace rank={card.rank} size={40} faceDown={!card.revealed} />
              </motion.div>
            )
          })}
        </div>
      ))}
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
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Pyramide terminée</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🍻 Classement final</h1>
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
