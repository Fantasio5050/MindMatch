import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { CardFace } from './CardFace'
import { sipLabel } from './types'
import type { PyramidClientState, Accusation, HandCard } from './types'
import type { Member } from '../../../types'

function memberNameFactory(members: Member[]) {
  return (id: string) => members.find((m) => m.id === id)?.pseudo ?? '?'
}

function accusationLabel(a: Accusation, memberName: (id: string) => string): string {
  const accuser = memberName(a.accuserId)
  const target = memberName(a.targetId)
  switch (a.status) {
    case 'pending':
      return `${accuser} distribue à ${target}… en attente de réponse`
    case 'accepted':
      return `${target} a bu (a fait confiance à ${accuser})`
    case 'awaiting-proof':
      return `${target} a dit "tu bluffes !" → ${accuser} doit prouver sa carte`
    case 'contested-wrong':
      return `${target} a douté à tort → boit double !`
    case 'contested-right':
      return `${accuser} bluffait → boit double !`
  }
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function PyramidController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const phase = group?.party.phase ?? null

  useEffect(() => {
    if (phase === 'matching' && lastPhase.current !== 'matching' && lastPhase.current !== null) play('tick')
    lastPhase.current = phase
  }, [phase, play])

  if (!group || !currentMember) return null
  const { party, members } = group
  const state = party.roundData as PyramidClientState
  const memberName = memberNameFactory(members)

  if (party.status === 'ended') {
    return <FinalResults members={members} totals={state.totalSipsReceived} onExit={() => navigate('/lobby')} />
  }

  if (party.phase === 'intro') {
    return <IntroView isHost={isHost} onStart={() => hostAdvance()} />
  }

  if (party.phase === 'memorize') {
    return <MemorizeView state={state} isHost={isHost} onAdvance={() => hostAdvance()} />
  }

  if (party.phase === 'matching') {
    return (
      <MatchingView
        state={state}
        members={members}
        selfId={currentMember.id}
        isHost={isHost}
        memberName={memberName}
        onDistribute={(targetMemberId) => {
          play('vote')
          sendAction('accuse', { targetMemberId })
        }}
        onRespond={(accusationId, contest) => {
          play('vote')
          sendAction('respond', { accusationId, contest })
        }}
        onProveCard={(accusationId, cardSlotIndex) => {
          play('vote')
          sendAction('proveCard', { accusationId, cardSlotIndex })
        }}
        onAdvance={() => hostAdvance()}
      />
    )
  }

  if (party.phase === 'recitation') {
    return (
      <RecitationView
        state={state}
        members={members}
        selfId={currentMember.id}
        isHost={isHost}
        onSubmit={(order) => sendAction('submitRecitation', { order })}
        onDistribute={(targetMemberId) => sendAction('distributeRecitationBonus', { targetMemberId })}
        onAdvance={() => hostAdvance()}
      />
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-white/50 text-sm">Préparation de la pyramide…</p>
    </div>
  )
}

function IntroView({ isHost, onStart }: { isHost: boolean; onStart: () => void }) {
  const rules = [
    ['🃏', 'Chacun reçoit 4 cartes secrètes — tu auras 30 secondes pour les mémoriser avant qu\'elles ne soient cachées.'],
    ['🔺', 'La pyramide se révèle carte par carte, du bas (1 gorgée) jusqu\'au sommet (cul sec).'],
    ['👉', 'À chaque carte, distribue à qui tu veux : "Tu bois !" (tu n\'as pas besoin d\'avoir la carte)'],
    ['🤔', 'La personne visée boit… ou dit "tu bluffes !" si elle doute de toi.'],
    ['🃏', 'Si on doute de toi, tu as UN SEUL essai pour montrer, de mémoire, laquelle de tes 4 cartes correspond.'],
    ['✅', 'Bonne carte → la personne qui doutait boit double.'],
    ['🎭', 'Mauvaise carte (ou bluff) → c\'est toi qui bois double.'],
    ['🧠', 'À la fin, retrouve l\'ordre de tes cartes de mémoire : gorgées bonus à la clé !'],
  ] as const

  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-6">
        <span className="text-5xl">🍻</span>
        <h1 className="text-2xl font-extrabold mt-2">Pyramide</h1>
      </div>
      <Card className="mb-6">
        <ul className="flex flex-col gap-3 text-sm text-white/80">
          {rules.map(([emoji, text], i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="flex gap-2"
            >
              <span className="shrink-0">{emoji}</span>
              <span>{text}</span>
            </motion.li>
          ))}
        </ul>
      </Card>
      {isHost ? (
        <Button fullWidth onClick={onStart}>
          C'est parti !
        </Button>
      ) : (
        <p className="text-center text-white/40 text-sm">En attente que l'hôte lance la partie…</p>
      )}
      <p className="text-center text-white/20 text-xs mt-6">💧 Tu peux toujours remplacer l'alcool par de l'eau.</p>
    </div>
  )
}

const MEMORIZE_SECONDS = 30

function MemorizeView({
  state,
  isHost,
  onAdvance,
}: {
  state: PyramidClientState
  isHost: boolean
  onAdvance: () => void
}) {
  const [secondsLeft, setSecondsLeft] = useState(MEMORIZE_SECONDS)
  const advancedRef = useRef(false)

  useEffect(() => {
    setSecondsLeft(MEMORIZE_SECONDS)
    advancedRef.current = false
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (secondsLeft === 0 && isHost && !advancedRef.current) {
      advancedRef.current = true
      onAdvance()
    }
  }, [secondsLeft, isHost, onAdvance])

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 safe-top text-center">
      <span className="text-5xl mb-2 block">🧠</span>
      <h1 className="text-2xl font-extrabold mb-2">Mémorise tes cartes !</h1>
      <p className="text-white/50 text-sm mb-6">Elles seront cachées dès que le temps sera écoulé.</p>

      <div className="flex justify-center gap-3 mb-8">
        {state.yourHand.map((c, i) => (
          <div key={c.id} className="flex flex-col items-center gap-1">
            <CardFace rank={c.rank} suit={c.suit} size={56} />
            <span className="text-[10px] text-white/30">{i + 1}</span>
          </div>
        ))}
      </div>

      <motion.div
        key={secondsLeft}
        initial={{ scale: 1.3, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-5xl font-extrabold shimmer-text mb-8 tabular-nums"
      >
        {secondsLeft}s
      </motion.div>

      {isHost && (
        <Button fullWidth onClick={onAdvance}>
          C'est bon, jouons ! →
        </Button>
      )}
    </div>
  )
}

function MatchingView({
  state,
  members,
  selfId,
  isHost,
  memberName,
  onDistribute,
  onRespond,
  onProveCard,
  onAdvance,
}: {
  state: PyramidClientState
  members: Member[]
  selfId: string
  isHost: boolean
  memberName: (id: string) => string
  onDistribute: (targetMemberId: string) => void
  onRespond: (accusationId: string, contest: boolean) => void
  onProveCard: (accusationId: string, cardSlotIndex: number) => void
  onAdvance: () => void
}) {
  const [pickingTarget, setPickingTarget] = useState(false)
  const card = state.pyramid[state.currentIndex]
  if (!card) return null

  const cardAccusations = state.accusations.filter((a) => a.cardIndex === state.currentIndex)
  const myPending = cardAccusations.find((a) => a.targetId === selfId && a.status === 'pending')
  const myProofNeeded = cardAccusations.find((a) => a.accuserId === selfId && a.status === 'awaiting-proof')
  const isLast = state.currentIndex >= state.pyramid.length - 1

  return (
    <div className="min-h-svh flex flex-col px-6 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">
        Carte {state.currentIndex + 1} / {state.pyramid.length}
      </p>

      <div className="flex flex-col items-center mb-4">
        <CardFace rank={card.rank} suit={card.suit} size={72} />
        <p className="mt-2 text-lg font-bold">{sipLabel(card.sips)}</p>
      </div>

      {myPending && (
        <Card className="mb-4 border-fuchsia-400/40">
          <p className="text-sm text-center mb-3">
            <b>{memberName(myPending.accuserId)}</b> te distribue cette carte : tu bois !
          </p>
          <div className="flex gap-2">
            <Button fullWidth onClick={() => onRespond(myPending.id, false)}>
              Je bois
            </Button>
            <Button fullWidth variant="secondary" onClick={() => onRespond(myPending.id, true)}>
              Tu bluffes !
            </Button>
          </div>
        </Card>
      )}

      {myProofNeeded && (
        <Card className="mb-4 border-fuchsia-400/40">
          <p className="text-sm text-center mb-1">
            <b>{memberName(myProofNeeded.targetId)}</b> pense que tu bluffes !
          </p>
          <p className="text-xs text-white/50 text-center mb-3">
            Montre, de mémoire, laquelle de tes cartes correspond — un seul essai !
          </p>
          <div className="flex justify-center gap-2">
            {state.yourHand.map((c, i) => (
              <button key={c.id} onClick={() => onProveCard(myProofNeeded.id, i)}>
                <CardFace rank={c.rank} suit={c.suit} size={48} />
              </button>
            ))}
          </div>
        </Card>
      )}

      {!pickingTarget && (
        <Button fullWidth variant="secondary" onClick={() => setPickingTarget(true)} className="mb-4">
          🍻 Distribuer une gorgée
        </Button>
      )}

      {pickingTarget && (
        <Card className="mb-4">
          <p className="text-sm font-semibold mb-3 text-center">Qui doit boire ?</p>
          <div className="grid grid-cols-3 gap-2">
            {members
              .filter((m) => m.id !== selfId)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onDistribute(m.id)
                    setPickingTarget(false)
                  }}
                  className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5"
                >
                  <Avatar pseudo={m.pseudo} color={m.color} size={36} />
                  <span className="text-xs font-medium truncate w-full text-center">{m.pseudo}</span>
                </button>
              ))}
          </div>
          <Button fullWidth variant="ghost" onClick={() => setPickingTarget(false)} className="mt-2">
            Annuler
          </Button>
        </Card>
      )}

      {cardAccusations.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-4">
          {cardAccusations.map((a) => (
            <p key={a.id} className="text-xs text-white/60 text-center">
              {accusationLabel(a, memberName)}
            </p>
          ))}
        </div>
      )}

      <div className="mt-auto pt-2">
        {isHost ? (
          <Button fullWidth onClick={onAdvance}>
            {isLast ? 'Passer à la récitation →' : 'Carte suivante →'}
          </Button>
        ) : (
          <p className="text-center text-white/30 text-xs">L'hôte peut avancer à tout moment</p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-white/40 mb-2 text-center">Ta main</p>
        <div className="flex justify-center gap-2">
          {state.yourHand.map((c) => (
            <CardFace key={c.id} rank={c.rank} suit={c.suit} size={40} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RecitationView({
  state,
  members,
  selfId,
  isHost,
  onSubmit,
  onDistribute,
  onAdvance,
}: {
  state: PyramidClientState
  members: Member[]
  selfId: string
  isHost: boolean
  onSubmit: (order: string[]) => void
  onDistribute: (targetMemberId: string) => void
  onAdvance: () => void
}) {
  // Shuffle once on mount so the display order doesn't jump around as room:update ticks in.
  const shuffled = useMemo(() => shuffle(state.yourHand), [])
  const [order, setOrder] = useState<string[]>([])
  const entry = state.recitation[selfId]

  const toggleCard = (id: string) => {
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < shuffled.length ? [...prev, id] : prev))
  }

  const cardById = (id: string): HandCard | undefined => shuffled.find((c) => c.id === id)

  return (
    <div className="min-h-svh flex flex-col px-6 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Récitation finale</p>
      <h1 className="text-xl font-extrabold text-center mb-4">🧠 Retrouve l'ordre de tes cartes</h1>

      {!entry ? (
        <>
          <Card className="mb-4">
            <p className="text-xs text-white/50 mb-3 text-center">
              Touche tes cartes dans l'ordre où tu penses les avoir reçues.
            </p>
            <div className="flex justify-center gap-2 mb-4 min-h-[70px]">
              {order.length === 0 && <p className="text-white/30 text-xs self-center">Aucune carte sélectionnée</p>}
              {order.map((id, i) => {
                const c = cardById(id)
                if (!c) return null
                return (
                  <div key={id} className="flex flex-col items-center gap-1">
                    <CardFace rank={c.rank} suit={c.suit} size={44} selected />
                    <span className="text-[10px] text-white/40">{i + 1}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-center gap-2">
              {shuffled.map((c) => (
                <button key={c.id} onClick={() => toggleCard(c.id)} className="disabled:opacity-30" disabled={order.includes(c.id)}>
                  <CardFace rank={c.rank} suit={c.suit} size={48} selected={order.includes(c.id)} />
                </button>
              ))}
            </div>
          </Card>
          <Button fullWidth disabled={order.length !== shuffled.length} onClick={() => onSubmit(order)}>
            Valider mon rappel
          </Button>
        </>
      ) : !entry.distributed ? (
        entry.bonusSips > 0 ? (
          <Card>
            <p className="text-center font-bold mb-1">🎉 {entry.bonusSips} gorgée{entry.bonusSips > 1 ? 's' : ''} bonus !</p>
            <p className="text-center text-white/50 text-sm mb-4">À qui les distribues-tu ?</p>
            <div className="grid grid-cols-3 gap-2">
              {members
                .filter((m) => m.id !== selfId)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onDistribute(m.id)}
                    className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5"
                  >
                    <Avatar pseudo={m.pseudo} color={m.color} size={36} />
                    <span className="text-xs font-medium truncate w-full text-center">{m.pseudo}</span>
                  </button>
                ))}
            </div>
          </Card>
        ) : (
          <Card className="text-center">
            <p className="text-white/60 text-sm">Pas de bonus cette fois — mémoire à travailler ! 😅</p>
          </Card>
        )
      ) : (
        <Card className="text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-white/60 text-sm">En attente des autres…</p>
        </Card>
      )}

      <div className="mt-auto pt-6">
        {isHost ? (
          <Button fullWidth variant="secondary" onClick={onAdvance}>
            Voir le classement final →
          </Button>
        ) : (
          <p className="text-center text-white/30 text-xs">L'hôte peut conclure à tout moment</p>
        )}
      </div>
    </div>
  )
}

function FinalResults({
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
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Pyramide terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🍻 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-white/50">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-white/60">{totals[m.id] ?? 0} gorgées</span>
          </Card>
        ))}
      </div>
      <p className="text-center text-white/30 text-xs mb-4">💧 Pense à boire de l'eau entre deux verres !</p>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
