import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { PC_FINISH_INDEX } from '../../../data/petitsChevaux'
import type { PetitsChevauxClientState } from './types'
import type { Member } from '../../../types'

export function PetitsChevauxController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()

  const state = (group?.party.roundData as PetitsChevauxClientState | null) ?? null
  const rollKey = state?.lastRoll ? `${state.lastRoll.playerId}-${state.turnsPlayed}` : null
  const seen = useRef<string | null>(null)
  const selfId = currentMember?.id ?? null

  useEffect(() => {
    if (!state?.lastRoll || rollKey === seen.current) return
    seen.current = rollKey
    if (selfId && state.lastRoll.captured.includes(selfId)) play('lose')
    else if (state.lastRoll.playerId === selfId) play('pop')
  }, [rollKey, state, selfId, play])

  if (!group || !currentMember) return null
  const { party } = group

  if (party.status === 'ended' && state) {
    return <FinalResults members={group.members.filter((m) => state.order.includes(m.id))} state={state} onExit={() => navigate('/lobby')} />
  }
  if (!state) {
    return <div className="min-h-svh flex items-center justify-center px-6"><p className="text-white/50 text-sm">Préparation du plateau…</p></div>
  }

  if (party.phase === 'intro') {
    return <IntroView isHost={isHost} onStart={() => hostAdvance()} />
  }

  const currentId = state.order[state.currentIndex]
  const isMyTurn = currentId === currentMember.id
  const iFinished = state.finishOrder.includes(currentMember.id)
  const currentPseudo = group.members.find((m) => m.id === currentId)?.pseudo ?? '?'
  const myPos = state.positions[currentMember.id] ?? 0

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-8 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Tour {state.turnsPlayed + 1}</p>

      {state.lastRoll && (
        <motion.div
          key={`${state.lastRoll.playerId}-${state.turnsPlayed}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl px-4 py-3 mb-4 text-center"
        >
          <p className="text-sm">
            🎲 <b>{group.members.find((m) => m.id === state.lastRoll!.playerId)?.pseudo ?? '?'}</b> a fait un{' '}
            <b className="text-fuchsia-300">{state.lastRoll.die}</b>
          </p>
          {state.lastRoll.text && <p className="text-xs text-white/60 mt-1">{state.lastRoll.text}</p>}
          {state.lastRoll.captured.length > 0 && (
            <p className="text-xs text-pink-300 mt-1">
              💥 {state.lastRoll.captured.map((id) => group.members.find((m) => m.id === id)?.pseudo ?? '?').join(', ')} renvoyé·e au départ !
            </p>
          )}
        </motion.div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        {iFinished ? (
          <Card className="text-center">
            <p className="text-5xl mb-2">🏆</p>
            <p className="font-bold">Tu es arrivé·e !</p>
            <p className="text-white/50 text-sm">Regarde les autres galérer 😏</p>
          </Card>
        ) : isMyTurn ? (
          <>
            <p className="text-white/50 text-sm mb-2">
              Case {myPos} / {PC_FINISH_INDEX} — à toi de jouer !
            </p>
            <motion.button
              whileTap={{ scale: 0.92 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              onClick={() => {
                play('tick')
                sendAction('roll', {})
              }}
              className="w-40 h-40 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white text-6xl font-extrabold shadow-2xl flex items-center justify-center"
            >
              🎲
            </motion.button>
            <p className="text-white/40 text-sm mt-4">Lance le dé</p>
          </>
        ) : (
          <Card className="text-center">
            <p className="text-white/50 text-sm mb-2">En attente…</p>
            <p className="font-semibold">C'est au tour de {currentPseudo} 🎲</p>
            <p className="text-white/40 text-sm mt-2">Ta position : case {myPos} / {PC_FINISH_INDEX}</p>
          </Card>
        )}
      </div>

      {isHost && !isMyTurn && (
        <Button fullWidth variant="ghost" onClick={() => hostAdvance()} className="!py-2 text-sm mt-4">
          Passer le tour de {currentPseudo} (absent·e)
        </Button>
      )}
      <p className="text-center text-white/20 text-xs mt-4">📺 Suis la course sur la TV</p>
    </div>
  )
}

function IntroView({ isHost, onStart }: { isHost: boolean; onStart: () => void }) {
  const rules = [
    ['🐴', 'Chacun son cheval sur le plateau. À ton tour, lance le dé et avance ton pion.'],
    ['🎯', 'Tu dois tomber pile sur l\'arrivée : si tu dépasses, tu rebondis en arrière !'],
    ['💥', 'Atterris pile sur un adversaire et il repart au départ… en buvant 2 gorgées.'],
    ['🍺', 'Les cases déclenchent des events : bois, distribue, avance, recule, gage, cul sec.'],
    ['🏆', 'Le/la premier·ère à l\'arrivée gagne. Les autres… boivent.'],
  ] as const
  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-6">
        <span className="text-5xl">🐴</span>
        <h1 className="text-2xl font-extrabold mt-2">Petits Chevaux</h1>
        <p className="text-white/40 text-sm">Le plateau est sur la TV 📺</p>
      </div>
      <Card className="mb-6">
        <ul className="flex flex-col gap-3 text-sm text-white/80">
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
          Lancer la course ! 🐴
        </Button>
      ) : (
        <p className="text-center text-white/40 text-sm">En attente que l'hôte lance la course…</p>
      )}
      <p className="text-center text-white/20 text-xs mt-6">💧 Tu peux toujours remplacer l'alcool par de l'eau.</p>
    </div>
  )
}

function FinalResults({ members, state, onExit }: { members: Member[]; state: PetitsChevauxClientState; onExit: () => void }) {
  const ranked = rankPlayers(members, state)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Course terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🐴 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-white/50">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-white/60">{state.totalSips[m.id] ?? 0} 🍻</span>
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

/** Classement : d'abord l'ordre d'arrivée, puis les autres par position décroissante (proximité de
 * l'arrivée), départage aux gorgées bues (moins = mieux). Partagé avec l'écran TV. */
export function rankPlayers(members: Member[], state: PetitsChevauxClientState): Member[] {
  return [...members].sort((a, b) => {
    const fa = state.finishOrder.indexOf(a.id)
    const fb = state.finishOrder.indexOf(b.id)
    if (fa !== -1 && fb !== -1) return fa - fb
    if (fa !== -1) return -1
    if (fb !== -1) return 1
    const pa = state.positions[a.id] ?? 0
    const pb = state.positions[b.id] ?? 0
    if (pb !== pa) return pb - pa
    return (state.totalSips[a.id] ?? 0) - (state.totalSips[b.id] ?? 0)
  })
}
