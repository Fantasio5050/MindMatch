import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { WheelSVG } from './WheelSVG'
import { useWheelSpin } from './useWheelSpin'
import type { WheelClientState, WheelSpinOutcome } from './types'
import type { Member } from '../../../types'
import { HostCue } from '../../primitives'

export function WheelController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()

  const phase = group?.party.phase ?? null
  const state = group?.party.roundData as WheelClientState | null
  const playback = useWheelSpin(phase === 'spinning' ? (state?.spin ?? null) : null, state?.wheelAngle ?? 0)

  if (!group || !currentMember || !state) return null
  const { party } = group
  const participants = group.members.filter((m) => party.participantIds.includes(m.id))
  const memberName = (id: string) => group.members.find((m) => m.id === id)?.pseudo ?? '?'
  const spinnerId = state.spinnerOrder[state.currentSpinnerIndex]
  const iAmSpinner = spinnerId === currentMember.id

  if (party.status === 'ended') {
    return <FinalResults members={participants} state={state} onExit={() => navigate('/lobby')} />
  }

  if (phase === 'intro') {
    return <IntroView isHost={isHost} onStart={() => hostAdvance()} />
  }

  if (phase === 'turn') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-8 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-1">Tour {group.party.round} 🎡</p>
        {iAmSpinner ? (
          <SwipePad
            state={state}
            onSpin={(force) => {
              play('start')
              sendAction('spin', { force })
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <WheelSVG segments={state.segments} angle={state.wheelAngle} size={230} />
            <p className="text-chalk-soft text-sm text-center">
              🎡 <b>{memberName(spinnerId)}</b> fait tourner la roue…
            </p>
          </div>
        )}
        {isHost && !iAmSpinner && (
          <button onClick={() => hostAdvance()} className="mt-4 text-xs text-chalk-faint underline mx-auto">
            Passer le tour de {memberName(spinnerId)} (absent·e ?)
          </button>
        )}
        {isHost && (
          <button onClick={() => sendAction('finish', {})} className="mt-2 text-xs text-chalk-faint underline mx-auto">
            Terminer la Roue (podium)
          </button>
        )}
      </div>
    )
  }

  if (phase === 'spinning' && state.spin) {
    const outcome = state.spin.outcome
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-8 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-3">
          {memberName(state.spin.spinnerId)} a lancé la roue 🎡
        </p>
        <div className="flex justify-center mb-4">
          <WheelSVG segments={state.segments} angle={state.wheelAngle} spin={state.spin} size={230} />
        </div>

        {!playback.done ? (
          <p className="text-center text-chalk-soft text-sm animate-pulse">📺 Suspense…</p>
        ) : (
          <OutcomePanel
            outcome={outcome}
            spinnerId={state.spin.spinnerId}
            selfId={currentMember.id}
            members={participants}
            memberName={memberName}
            onGiveSip={(targetMemberId) => {
              play('pop')
              sendAction('giveSip', { targetMemberId })
            }}
            onGageResult={(done) => {
              play(done ? 'win' : 'lose')
              sendAction('gageResult', { done })
            }}
          />
        )}

        <div className="mt-auto pt-4 flex flex-col gap-2">
          {isHost && playback.done && (
            <>
              <Button fullWidth onClick={() => hostAdvance()}>
                Joueur suivant →
              </Button>
              <Button fullWidth variant="secondary" onClick={() => sendAction('finish', {})}>
                Terminer la Roue (podium)
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Installation de la roue…</p>
    </div>
  )
}

function IntroView({ isHost, onStart }: { isHost: boolean; onStart: () => void }) {
  const rules = [
    ['🎡', 'Chacun son tour, swipe sur ton téléphone pour lancer la grande roue de la TV.'],
    ['🍻', 'Tu bois, tu distribues, tout le monde boit, tes voisins trinquent…'],
    ['🎭', 'Gage : relève-le, ou refuse et bois 3 gorgées.'],
    ['🛡️', 'Immunité : ta prochaine gorgée imposée par la roue est annulée.'],
    ['🔄', '« Rejoue ! » : la roue te redonne la main.'],
    ['🥃', 'Et quelque part, le segment CUL SEC attend son heure…'],
  ] as const

  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-6">
        <span className="text-5xl">🎡</span>
        <h1 className="text-2xl font-extrabold mt-2">Roue Infernale</h1>
        <p className="text-chalk-faint text-sm">La roue tourne en 3D sur la TV 📺</p>
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
          Faire tourner ! 🎡
        </Button>
      ) : (
        <HostCue action="lance la roue" />
      )}
      <p className="text-center text-chalk-faint text-xs mt-6">💧 Tu peux toujours remplacer l'alcool par de l'eau.</p>
    </div>
  )
}

const PULL_RANGE_PX = 300 // tirer sur ~30 cm d'écran = jauge pleine

function SwipePad({ state, onSpin }: { state: WheelClientState; onSpin: (force: number) => void }) {
  const startRef = useRef<{ y: number; t: number } | null>(null)
  const [power, setPower] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [sent, setSent] = useState(false)

  const onPointerDown = (e: React.PointerEvent) => {
    if (sent) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    startRef.current = { y: e.clientY, t: performance.now() }
    setDragging(true)
    setPower(0)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current
    if (!start || sent) return
    setPower(Math.min(1, Math.max(0, (start.y - e.clientY) / PULL_RANGE_PX)))
  }
  const onPointerEnd = (e: React.PointerEvent) => {
    const start = startRef.current
    startRef.current = null
    setDragging(false)
    if (!start || sent) return
    const dy = start.y - e.clientY
    if (dy < 25) {
      setPower(0) // geste trop court : on annule, sans pénalité
      return
    }
    // La distance donne la base (lisible, prévisible), la vitesse du geste ajoute un bonus.
    const velocity = dy / Math.max(1, performance.now() - start.t)
    const force = Math.min(1, Math.max(0.15, dy / PULL_RANGE_PX + Math.min(0.3, velocity / 3)))
    setPower(force)
    setSent(true)
    navigator.vibrate?.(60)
    onSpin(force)
  }

  const percent = Math.round(power * 100)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div style={{ transform: `scale(${1 + power * 0.06})`, transition: 'transform 80ms' }}>
        <WheelSVG segments={state.segments} angle={state.wheelAngle - power * 40} size={200} />
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="relative w-full max-w-xs h-52 rounded-3xl overflow-hidden glass-card border border-fuchsia-400/40 select-none touch-none"
      >
        {/* Jauge de puissance qui monte avec le doigt */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: `${power * 100}%`,
            background: 'linear-gradient(180deg, rgba(232,121,249,0.55) 0%, rgba(139,92,246,0.35) 100%)',
            transition: dragging ? 'none' : 'height 250ms ease',
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
          {sent ? (
            <>
              <span className="text-4xl">🎡</span>
              <p className="font-bold">Lancée à {percent}% !</p>
            </>
          ) : dragging ? (
            <>
              <span className="text-4xl font-extrabold shimmer-text tabular-nums">{percent}%</span>
              <p className="text-chalk-muted text-sm font-semibold">{power >= 0.95 ? '🔥 PLEINE PUISSANCE !' : 'Relâche pour lancer !'}</p>
            </>
          ) : (
            <>
              <motion.span animate={{ y: [10, -10, 10] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }} className="text-4xl">
                👆
              </motion.span>
              <p className="font-bold">Maintiens et tire vers le haut</p>
              <p className="text-chalk-faint text-xs">puis relâche pour lancer la roue</p>
            </>
          )}
        </div>
        {/* Graduations de la jauge */}
        {[25, 50, 75].map((g) => (
          <div key={g} className="absolute inset-x-4 border-t border-dashed border-line pointer-events-none" style={{ bottom: `${g}%` }} />
        ))}
      </div>
    </div>
  )
}

function OutcomePanel({
  outcome,
  spinnerId,
  selfId,
  members,
  memberName,
  onGiveSip,
  onGageResult,
}: {
  outcome: WheelSpinOutcome
  spinnerId: string
  selfId: string
  members: Member[]
  memberName: (id: string) => string
  onGiveSip: (targetMemberId: string) => void
  onGageResult: (done: boolean) => void
}) {
  const seg = outcome.segment
  const iAmSpinner = spinnerId === selfId
  const drinkers = Object.entries(outcome.sips).filter(([, n]) => n > 0)

  return (
    <Card className="border-fuchsia-400/30">
      <p className="text-center text-2xl mb-1">{seg.emoji}</p>
      <p className="text-center font-extrabold mb-2" style={{ color: seg.color === '#1b1426' ? '#f4f2f8' : seg.color }}>
        {seg.label}
      </p>

      {drinkers.length > 0 && (
        <p className="text-center text-pink-300 text-sm mb-2">
          🍻 {drinkers.map(([id, n]) => `${memberName(id)} boit ${n}`).join(' · ')}
        </p>
      )}
      {outcome.immunityUsedBy.length > 0 && (
        <p className="text-center text-amber-300 text-sm mb-2">
          🛡️ {outcome.immunityUsedBy.map((id) => `${memberName(id)} est immunisé·e !`).join(' · ')}
        </p>
      )}

      {seg.type === 'immunity' && (
        <p className="text-center text-amber-300 text-sm mb-2">
          {iAmSpinner ? 'Ta prochaine gorgée imposée par la roue est annulée !' : `${memberName(spinnerId)} gagne une immunité !`}
        </p>
      )}
      {seg.type === 'respin' && <p className="text-center text-chalk-soft text-sm mb-2">🔄 {memberName(spinnerId)} rejoue !</p>}

      {seg.type === 'gage' && outcome.gageText && (
        <>
          <p className="text-center text-chalk-muted text-sm italic mb-3">« {outcome.gageText} »</p>
          {outcome.gageDone === null ? (
            iAmSpinner ? (
              <div className="flex gap-2">
                <Button fullWidth onClick={() => onGageResult(true)} className="!py-2.5 text-sm">
                  Gage relevé ✅
                </Button>
                <Button fullWidth variant="secondary" onClick={() => onGageResult(false)} className="!py-2.5 text-sm">
                  Je refuse (+3 🍻)
                </Button>
              </div>
            ) : (
              <p className="text-center text-chalk-faint text-xs">{memberName(spinnerId)} décide…</p>
            )
          ) : outcome.gageDone ? (
            <p className="text-center text-emerald-300 text-sm">✅ Gage relevé ! (+5 XP)</p>
          ) : (
            <p className="text-center text-pink-300 text-sm">Refusé — {memberName(spinnerId)} boit 3 🍻</p>
          )}
        </>
      )}

      {seg.type === 'give' &&
        (iAmSpinner && outcome.giveRemaining > 0 ? (
          <>
            <p className="text-center text-chalk-soft text-sm mb-3">
              Touche un joueur pour lui donner 1 gorgée — reste <b className="text-fuchsia-300">{outcome.giveRemaining}</b>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {members
                .filter((m) => m.id !== selfId)
                .map((m) => (
                  <button key={m.id} onClick={() => onGiveSip(m.id)} className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5 relative">
                    <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
                    <span className="text-xs font-medium truncate w-full text-center">{m.pseudo}</span>
                    {(outcome.given[m.id] ?? 0) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-fuchsia-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {outcome.given[m.id]}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </>
        ) : outcome.giveRemaining > 0 ? (
          <p className="text-center text-chalk-faint text-xs">{memberName(spinnerId)} distribue ses gorgées…</p>
        ) : (
          <p className="text-center text-emerald-300 text-sm">
            ✅ Distribué : {Object.entries(outcome.given).map(([id, n]) => `${n} → ${memberName(id)}`).join(' · ')}
          </p>
        ))}
    </Card>
  )
}

function FinalResults({ members, state, onExit }: { members: Member[]; state: WheelClientState; onExit: () => void }) {
  const ranked = [...members].sort((a, b) => (state.totalSips[a.id] ?? 0) - (state.totalSips[b.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
        Roue Infernale — {state.spinsDone} lancer{state.spinsDone > 1 ? 's' : ''}
      </p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🎡 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
            <span className="flex-1 font-semibold truncate">{m.pseudo}</span>
            {state.immunities[m.id] && <span title="Immunité non utilisée">🛡️</span>}
            <span className="text-sm text-chalk-soft">{state.totalSips[m.id] ?? 0} 🍻</span>
          </Card>
        ))}
      </div>
      <p className="text-center text-chalk-faint text-xs mb-4">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
