import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { PlayingCard } from '../shared/PlayingCard'
import type { PalmierClientState } from './types'
import type { Member } from '../../../types'

const NEEDS_TARGET = new Set(['give-sips', 'center-give', 'buddy'])
const NEEDS_JUDGE = new Set(['race', 'challenge'])

export function PalmierController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()
  const lastCardId = useRef<string | null>(null)
  const state = (group?.party.roundData as PalmierClientState | null) ?? null

  useEffect(() => {
    if (state?.currentCard && state.currentCard.id !== lastCardId.current) {
      play('reveal')
      lastCardId.current = state.currentCard.id
    }
  }, [state?.currentCard, play])

  if (!group || !currentMember) return null
  const { party } = group

  if (party.status === 'ended') {
    return <FinalPodium members={group.members} totals={state?.totalSipsReceived ?? {}} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'intro') {
    return <IntroView isHost={isHost} onStart={() => hostAdvance()} />
  }

  if (party.phase === 'drawing' && state) {
    return (
      <DrawingView
        state={state}
        members={group.members}
        currentMemberId={currentMember.id}
        isHost={isHost}
        onChooseTarget={(targetMemberId) => {
          play('vote')
          sendAction('chooseTarget', { targetMemberId })
        }}
        onJudgeLoser={(loserMemberId) => sendAction('judgeLoser', { loserMemberId })}
        onSetRule={(text) => sendAction('setRule', { text })}
        onNext={() => hostAdvance()}
      />
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Préparation du Palmier…</p>
    </div>
  )
}

function IntroView({ isHost, onStart }: { isHost: boolean; onStart: () => void }) {
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top justify-center">
      <span className="text-6xl mb-4 block text-center">🌴</span>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">Palmier</h1>
      <div className="flex flex-col gap-2.5 text-sm text-chalk-muted mb-8">
        <p>🃏 52 cartes tirées une par une, à tour de rôle.</p>
        <p>❤️♦️ As, 2, 3 rouges = tu bois. ♠️♣️ noirs = tu distribues.</p>
        <p>✋ 4 = Four to the floor, 5 = Five to the fly — le/la dernier·ère boit.</p>
        <p>👈👉 6 = ton voisin de gauche boit, 7 = ta voisine de droite boit.</p>
        <p>🤝 8 = complice, 9 = rime, 10 = catégorie, Valet = nouvelle règle, Dame = question.</p>
        <p>👑 Roi = tu verses dans le verre central — le 4e Roi le boit cul sec !</p>
      </div>
      {isHost ? (
        <Button fullWidth onClick={onStart}>
          Commencer 🌴
        </Button>
      ) : (
        <p className="text-center text-chalk-faint text-sm">L'hôte va lancer la première carte…</p>
      )}
    </div>
  )
}

function DrawingView({
  state,
  members,
  currentMemberId,
  isHost,
  onChooseTarget,
  onJudgeLoser,
  onSetRule,
  onNext,
}: {
  state: PalmierClientState
  members: Member[]
  currentMemberId: string
  isHost: boolean
  onChooseTarget: (targetMemberId: string) => void
  onJudgeLoser: (loserMemberId: string | undefined) => void
  onSetRule: (text: string) => void
  onNext: () => void
}) {
  const [ruleDraft, setRuleDraft] = useState('')
  const drawer = members.find((m) => m.id === state.drawerMemberId)
  const isDrawer = state.drawerMemberId === currentMemberId
  const lastLog = state.log[state.log.length - 1]
  const needsTarget = !!state.effect && NEEDS_TARGET.has(state.effect)
  const needsJudge = !!state.effect && NEEDS_JUDGE.has(state.effect)
  const needsRule = state.effect === 'rule'

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">
        Carte {state.currentIndex + 1} / {state.totalCards}
      </p>

      {state.ruleText && (
        <div className="glass-card rounded-2xl px-4 py-2.5 text-center text-xs text-fuchsia-300/90 mb-4">
          📜 Règle active : « {state.ruleText} »
        </div>
      )}

      {state.currentCard && (
        <div className="flex flex-col items-center gap-2 mb-4">
          <PlayingCard key={state.currentCard.id} rank={state.currentCard.rank} suit={state.currentCard.suit} size={72} flipReveal />
          <div className="flex items-center gap-2 mt-1">
            <Avatar pseudo={drawer?.pseudo ?? '?'} color={drawer?.color ?? '#fff'} size={28} />
            <span className="text-sm text-chalk-soft">{drawer?.pseudo} tire la carte</span>
          </div>
        </div>
      )}

      <Card className="text-center mb-4">
        <p className="font-semibold text-sm leading-snug">{state.label}</p>
      </Card>

      {!state.resolved && needsTarget && isDrawer && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {members
            .filter((m) => m.id !== currentMemberId)
            .map((m, i) => (
              <motion.button
                key={m.id}
                onClick={() => onChooseTarget(m.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                whileTap={{ scale: 0.95 }}
                className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2"
              >
                <Avatar pseudo={m.pseudo} color={m.color} size={44} />
                <span className="text-sm font-semibold">{m.pseudo}</span>
              </motion.button>
            ))}
        </div>
      )}

      {!state.resolved && needsJudge && isHost && (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            {members.map((m, i) => (
              <motion.button
                key={m.id}
                onClick={() => onJudgeLoser(m.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                whileTap={{ scale: 0.95 }}
                className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2"
              >
                <Avatar pseudo={m.pseudo} color={m.color} size={44} />
                <span className="text-sm font-semibold">{m.pseudo}</span>
              </motion.button>
            ))}
          </div>
          <Button variant="ghost" fullWidth onClick={() => onJudgeLoser(undefined)} className="!py-2 text-sm">
            Personne n'a perdu
          </Button>
        </div>
      )}

      {!state.resolved && needsRule && isDrawer && (
        <div className="flex flex-col gap-3 mb-4">
          <input
            value={ruleDraft}
            onChange={(e) => setRuleDraft(e.target.value.slice(0, 80))}
            placeholder="Ta nouvelle règle…"
            className="w-full rounded-2xl bg-felt-raised border border-line px-4 py-3 text-[15px] text-chalk-muted placeholder:text-chalk-faint"
          />
          <Button fullWidth disabled={!ruleDraft.trim()} onClick={() => onSetRule(ruleDraft.trim())}>
            Valider la règle
          </Button>
        </div>
      )}

      {!state.resolved && !((needsTarget && isDrawer) || (needsJudge && isHost) || (needsRule && isDrawer)) && (
        <p className="text-center text-chalk-faint text-sm mb-4">
          {needsJudge ? "En attente du jugement de l'hôte…" : `En attente de ${drawer?.pseudo}…`}
        </p>
      )}

      {state.resolved && lastLog && (
        <Card className="text-center mb-4 border-emerald-400/20">
          <p className="text-sm text-emerald-300/90">✅ {lastLog.text}</p>
        </Card>
      )}

      {isHost ? (
        <Button fullWidth onClick={onNext}>
          Carte suivante →
        </Button>
      ) : (
        <p className="text-center text-chalk-faint text-sm">L'hôte passera à la carte suivante.</p>
      )}
    </div>
  )
}

function FinalPodium({
  members,
  totals,
  onExit,
}: {
  members: Member[]
  totals: Record<string, number>
  onExit: () => void
}) {
  const ranked = [...members].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Palmier terminé</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🌴 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-chalk-soft">{totals[m.id] ?? 0} gorgées</span>
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
