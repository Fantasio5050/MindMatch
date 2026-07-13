import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { useWheelSpin } from './useWheelSpin'
import type { WheelClientState } from './types'
import type { Member } from '../../../types'

// three.js ne se charge que quand la TV affiche réellement la Roue Infernale.
const WheelScene3D = lazy(() => import('./WheelScene3D'))

export function WheelScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null
  const state = group?.party.roundData as WheelClientState | null

  const playback = useWheelSpin(phase === 'spinning' ? (state?.spin ?? null) : null, state?.wheelAngle ?? 0)

  // Fanfare + confettis quand la roue s'arrête (une seule fois par spin).
  const celebratedSpin = useRef(0)
  useEffect(() => {
    if (!playback.done || !state?.spin || phase !== 'spinning') return
    if (celebratedSpin.current === state.spin.id) return
    celebratedSpin.current = state.spin.id
    const type = state.spin.outcome.segment.type
    play(type === 'drink' || type === 'culsec' || type === 'everyone' || type === 'neighbors' ? 'lose' : 'win')
    if (type === 'culsec' || type === 'immunity') setConfettiTrigger((n) => n + 1)
  }, [playback.done, state, phase, play])

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const participants = group.members.filter((m) => group.party.participantIds.includes(m.id))
  const memberName = (id: string) => group.members.find((m) => m.id === id)?.pseudo ?? '?'

  if (status === 'ended' && state) {
    return <FinalPodium members={participants} state={state} />
  }

  return (
    <div className="relative min-h-svh overflow-hidden">
      <Confetti trigger={confettiTrigger} />
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/40 text-2xl">Installation de la roue… 🎡</p>
          </div>
        }
      >
        {state && (
          <WheelScene3D
            segments={state.segments}
            spin={phase === 'spinning' ? state.spin : null}
            restAngle={state.wheelAngle}
          />
        )}
      </Suspense>

      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {phase === 'intro' && <IntroOverlay />}

        {phase === 'turn' && state && (
          <div className="flex justify-center pt-8">
            <motion.div
              key={state.currentSpinnerIndex}
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-3xl px-10 py-5 bg-black/45 text-center"
            >
              <h1 className="text-4xl font-extrabold shimmer-text mb-1">
                Au tour de {memberName(state.spinnerOrder[state.currentSpinnerIndex])} 🎡
              </h1>
              <p className="text-white/60 text-xl">Swipe sur ton téléphone pour lancer la roue !</p>
            </motion.div>
          </div>
        )}

        {phase === 'spinning' && state?.spin && playback.done && (
          <OutcomeBanner state={state} memberName={memberName} />
        )}

        {/* Compteur de gorgées + immunités, toujours visible en bas. */}
        {phase !== 'intro' && state && (
          <div className="mt-auto flex justify-center pb-6">
            <div className="glass-card rounded-2xl px-6 py-3 bg-black/45 flex flex-wrap gap-4 justify-center max-w-4xl">
              {participants.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Avatar pseudo={m.pseudo} color={m.color} size={30} photoUrl={m.photoUrl} />
                  <span className="text-base font-medium">{m.pseudo}</span>
                  {state.immunities[m.id] && <span title="Immunisé·e">🛡️</span>}
                  <span className="text-white/50 tabular-nums">{state.totalSips[m.id] ?? 0} 🍻</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function IntroOverlay() {
  const rules = [
    ['🎡', 'Chacun son tour, un swipe sur le téléphone lance la roue.'],
    ['🍻', 'Bois, distribue, fais trinquer tout le monde ou tes voisins…'],
    ['🎭', 'Gage relevé = +5 XP. Refusé = 3 gorgées.'],
    ['🛡️', "L'immunité annule ta prochaine gorgée imposée par la roue."],
    ['🥃', 'Et le segment CUL SEC rôde…'],
  ] as const
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl px-12 py-10 max-w-2xl bg-black/45">
        <h1 className="text-5xl font-extrabold shimmer-text text-center mb-6">🎡 Roue Infernale</h1>
        <div className="flex flex-col gap-3 text-xl text-white/85">
          {rules.map(([emoji, text], i) => (
            <motion.p key={i} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 * i }} className="flex gap-3">
              <span>{emoji}</span>
              <span>{text}</span>
            </motion.p>
          ))}
        </div>
        <p className="text-white/40 text-lg text-center mt-6">L'hôte lance la machine 📱</p>
      </motion.div>
    </div>
  )
}

function OutcomeBanner({ state, memberName }: { state: WheelClientState; memberName: (id: string) => string }) {
  const spin = state.spin
  if (!spin) return null
  const seg = spin.outcome.segment
  const outcome = spin.outcome
  const drinkers = Object.entries(outcome.sips).filter(([, n]) => n > 0)

  return (
    <AnimatePresence>
      <motion.div
        key={spin.id}
        initial={{ opacity: 0, scale: 0.8, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex justify-center pt-8"
      >
        <div className="glass-card rounded-3xl px-12 py-6 bg-black/55 text-center max-w-3xl">
          <p className="text-6xl mb-2">{seg.emoji}</p>
          <h1 className="text-5xl font-extrabold mb-3" style={{ color: seg.color === '#1b1426' ? '#f4f2f8' : seg.color }}>
            {seg.label}
          </h1>
          {seg.type === 'gage' && outcome.gageText && (
            <p className="text-white/85 text-2xl italic mb-2">« {outcome.gageText} »</p>
          )}
          {drinkers.length > 0 && (
            <p className="text-pink-300 text-2xl">
              🍻 {drinkers.map(([id, n]) => `${memberName(id)} boit ${n}`).join(' · ')}
            </p>
          )}
          {outcome.immunityUsedBy.length > 0 && (
            <p className="text-amber-300 text-2xl">🛡️ {outcome.immunityUsedBy.map(memberName).join(', ')} : immunité utilisée !</p>
          )}
          {seg.type === 'immunity' && <p className="text-amber-300 text-2xl">{memberName(spin.spinnerId)} est désormais sous bouclier !</p>}
          {seg.type === 'respin' && <p className="text-white/70 text-2xl">{memberName(spin.spinnerId)} rejoue !</p>}
          {seg.type === 'give' && outcome.giveRemaining > 0 && (
            <p className="text-emerald-300 text-2xl">{memberName(spin.spinnerId)} distribue {outcome.giveRemaining} gorgée{outcome.giveRemaining > 1 ? 's' : ''}… 📱</p>
          )}
          {seg.type === 'give' && outcome.giveRemaining === 0 && (
            <p className="text-emerald-300 text-2xl">
              ✅ {Object.entries(outcome.given).map(([id, n]) => `${n} → ${memberName(id)}`).join(' · ')}
            </p>
          )}
          {seg.type === 'gage' && outcome.gageDone === true && <p className="text-emerald-300 text-2xl">✅ Gage relevé !</p>}
          {seg.type === 'gage' && outcome.gageDone === false && (
            <p className="text-pink-300 text-2xl">Refusé — {memberName(spin.spinnerId)} boit 3 🍻</p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function FinalPodium({ members, state }: { members: Member[]; state: WheelClientState }) {
  const ranked = [...members].sort((a, b) => (state.totalSips[a.id] ?? 0) - (state.totalSips[b.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12 text-center">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">
        Roue Infernale — {state.spinsDone} lancer{state.spinsDone > 1 ? 's' : ''}
      </p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🎡 Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="flex items-center gap-4 glass-card rounded-2xl px-8 py-4 w-[480px]"
          >
            <span className="text-2xl font-bold w-8 text-white/50">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            {state.immunities[m.id] && <span title="Immunité non utilisée">🛡️</span>}
            <span className="text-lg text-white/60 tabular-nums">{state.totalSips[m.id] ?? 0} 🍻</span>
          </motion.div>
        ))}
      </div>
      <p className="text-white/30 text-lg mt-8">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
    </div>
  )
}
