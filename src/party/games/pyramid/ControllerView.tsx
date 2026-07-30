import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { CardFace } from './CardFace'
import { PlayingCard } from '../shared/PlayingCard'
import { sipLabel, rankLabel, SUITS, distributionSlots } from './types'
import type { PyramidClientState, Accusation, RecitationGuess } from './types'
import type { Member } from '../../../types'
import { HostCue } from '../../primitives'
import { GroupPulse } from '../../../components/GroupPulse'

function memberNameFactory(members: Member[]) {
  return (id: string) => members.find((m) => m.id === id)?.pseudo ?? '?'
}

function accusationLabel(a: Accusation, memberName: (id: string) => string): string {
  const accuser = memberName(a.accuserId)
  const target = memberName(a.targetId)
  const sips = `${a.sips} gorgée${a.sips > 1 ? 's' : ''}`
  switch (a.status) {
    case 'pending':
      return `${accuser} distribue ${sips} à ${target}… en attente de réponse`
    case 'accepted':
      return `${target} a bu ${sips} (a fait confiance à ${accuser})`
    case 'awaiting-proof':
      return `${target} a dit "tu bluffes !" → ${accuser} doit prouver sa carte`
    case 'contested-wrong':
      return `${target} a douté à tort → boit ${a.sips * 2} gorgées !`
    case 'contested-right':
      return `${accuser} bluffait → boit ${a.sips * 2} gorgées !`
  }
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
  const selfId = currentMember?.id ?? null
  const preState = group?.party.roundData as PyramidClientState | null
  const resolvedKey = preState?.accusations
    .filter((a) => a.status !== 'pending' && a.status !== 'awaiting-proof')
    .map((a) => `${a.id}:${a.status}`)
    .join('|')
  const seenResolved = useRef(new Set<string>())

  useEffect(() => {
    if (phase === 'matching' && lastPhase.current !== 'matching' && lastPhase.current !== null) play('tick')
    lastPhase.current = phase
  }, [phase, play])

  // Personal jingle when a distribution involving me resolves: sad if I end up drinking, victory
  // fanfare if my bluff call (or my proof) makes the other one drink double.
  useEffect(() => {
    if (!preState || !selfId) return
    for (const a of preState.accusations) {
      if (a.status === 'pending' || a.status === 'awaiting-proof') continue
      const key = `${a.id}:${a.status}`
      if (seenResolved.current.has(key)) continue
      seenResolved.current.add(key)
      const iDrink =
        (a.status === 'accepted' && a.targetId === selfId) ||
        (a.status === 'contested-wrong' && a.targetId === selfId) ||
        (a.status === 'contested-right' && a.accuserId === selfId)
      const iWin =
        (a.status === 'contested-wrong' && a.accuserId === selfId) ||
        (a.status === 'contested-right' && a.targetId === selfId)
      if (iDrink) play('lose')
      else if (iWin) play('win')
    }
    // resolvedKey is the memoized fingerprint of the accusation list used above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedKey, selfId, play])

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
        onSubmit={(guesses) => sendAction('submitRecitation', { guesses })}
        onDistribute={(targetMemberId) => sendAction('distributeRecitationBonus', { targetMemberId })}
        onAdvance={() => hostAdvance()}
      />
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Préparation de la pyramide…</p>
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
    ['🧠', 'À la fin, récite tes cartes dans l\'ordre (valeur ET signe) : 1 gorgée à distribuer par bonne réponse, à répartir comme tu veux !'],
  ] as const

  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-6">
        <span className="text-5xl">🍻</span>
        <h1 className="text-2xl font-extrabold mt-2">Pyramide</h1>
      </div>
      <Card className="mb-6">
        <ul className="flex flex-col gap-3 text-sm text-chalk-muted">
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
        <HostCue action="lance la partie" />
      )}
      <p className="text-center text-chalk-faint text-xs mt-6">💧 Tu peux toujours remplacer l'alcool par de l'eau.</p>
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
      <p className="text-chalk-soft text-sm mb-6">Elles seront cachées dès que le temps sera écoulé.</p>

      <div className="flex justify-center gap-3 mb-8">
        {state.yourHand.map((c, i) => (
          <div key={c.id} className="flex flex-col items-center gap-1">
            <PlayingCard rank={c.rank} suit={c.suit} size={56} dealDelay={0.12 * i} />
            <span className="text-[10px] text-chalk-faint">{i + 1}</span>
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

  // Distribution budget for THIS card: 1 shot for level 1 / cul sec, or as many 1-sip slots as
  // the card is worth for levels 2-4 — splittable across several targets, but never re-usable
  // once spent (stops one player from spamming "Distribuer" on every single victim).
  const totalSlots = distributionSlots(card.sips)
  const mySlotsUsed = cardAccusations.filter((a) => a.accuserId === selfId).length
  const slotsLeft = Math.max(0, totalSlots - mySlotsUsed)
  const canDistribute = slotsLeft > 0

  return (
    <div className="min-h-svh flex flex-col px-6 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
        Carte {state.currentIndex + 1} / {state.pyramid.length}
      </p>

      {/* Mini-pyramide : suivre la progression sans écran TV (fallback téléphone seul). */}
      <MiniPyramid state={state} />

      <div className="flex flex-col items-center mb-4">
        <PlayingCard key={state.currentIndex} rank={card.rank} suit={card.suit} size={72} flipReveal />
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
          <p className="text-xs text-chalk-soft text-center mb-3">
            Tes cartes sont face cachée : pointe, de mémoire, celle qui correspond — un seul essai !
          </p>
          <div className="flex justify-center gap-2">
            {state.yourHand.map((c, i) => (
              <button key={c.id} onClick={() => onProveCard(myProofNeeded.id, i)} className="flex flex-col items-center gap-1">
                <CardFace faceDown size={48} />
                <span className="text-[10px] text-chalk-faint">{i + 1}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {!pickingTarget && canDistribute && (
        <Button fullWidth variant="secondary" onClick={() => setPickingTarget(true)} className="mb-4">
          🍻 Distribuer{totalSlots > 1 ? ` (${slotsLeft} restante${slotsLeft > 1 ? 's' : ''})` : ' une gorgée'}
        </Button>
      )}

      {!pickingTarget && !canDistribute && (
        <p className="text-center text-chalk-faint text-xs mb-4">
          Tu as déjà distribué cette carte — attends la prochaine !
        </p>
      )}

      {pickingTarget && (
        <Card className="mb-4">
          <p className="text-sm font-semibold mb-3 text-center">
            {totalSlots > 1 ? `Qui doit boire 1 gorgée ? (${slotsLeft} à distribuer)` : 'Qui doit boire ?'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {members
              .filter((m) => m.id !== selfId)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onDistribute(m.id)
                    if (slotsLeft <= 1) setPickingTarget(false)
                  }}
                  className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5"
                >
                  <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
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
            <p key={a.id} className="text-xs text-chalk-soft text-center">
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
          <p className="text-center text-chalk-faint text-xs">L'hôte peut avancer à tout moment</p>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-xs text-chalk-faint mb-2 text-center">Ta main (face cachée — souviens-toi !)</p>
        <div className="flex justify-center gap-2">
          {state.yourHand.map((c, i) => (
            <div key={c.id} className="flex flex-col items-center gap-1">
              <CardFace faceDown size={40} />
              <span className="text-[10px] text-chalk-faint">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Pyramide compacte sur le téléphone — permet de suivre la révélation sans écran TV. */
function MiniPyramid({ state }: { state: PyramidClientState }) {
  const rows: Record<number, PyramidClientState['pyramid']> = {}
  for (const card of state.pyramid) {
    rows[card.row] = rows[card.row] ?? []
    rows[card.row].push(card)
  }
  const rowIndexes = Object.keys(rows).map(Number).sort((a, b) => b - a)

  return (
    <div className="flex flex-col items-center gap-1 mb-3">
      {rowIndexes.map((rowIdx) => (
        <div key={rowIdx} className="flex gap-1">
          {rows[rowIdx].map((card) => {
            const isCurrent = state.pyramid[state.currentIndex]?.id === card.id
            return (
              <div key={card.id} className={isCurrent ? 'ring-2 ring-fuchsia-400 rounded' : ''}>
                <CardFace rank={card.rank} suit={card.suit} size={18} faceDown={!card.revealed} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

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
  onSubmit: (guesses: RecitationGuess[]) => void
  onDistribute: (targetMemberId: string) => void
  onAdvance: () => void
}) {
  const handSize = state.yourHand.length
  const [guesses, setGuesses] = useState<RecitationGuess[]>([])
  const [pendingRank, setPendingRank] = useState<number | null>(null)
  const entry = state.recitation[selfId]
  const currentSlot = guesses.length

  const pickRank = (rank: number) => setPendingRank(rank)
  const pickSuit = (suit: number) => {
    if (pendingRank === null) return
    setGuesses((prev) => [...prev, { rank: pendingRank, suit }])
    setPendingRank(null)
  }
  const restart = () => {
    setGuesses([])
    setPendingRank(null)
  }

  return (
    <div className="min-h-svh flex flex-col px-6 pt-8 pb-6 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Récitation finale</p>
      <h1 className="text-xl font-extrabold text-center mb-4">🧠 Récite tes cartes, dans l'ordre</h1>

      {!entry ? (
        <>
          <Card className="mb-4">
            <p className="text-xs text-chalk-soft mb-3 text-center">
              Tes cartes sont toujours cachées : donne la valeur ET le signe de chacune, dans l'ordre du départ. 1
              gorgée à distribuer par bonne réponse !
            </p>

            <div className="flex justify-center gap-2 mb-4">
              {Array.from({ length: handSize }).map((_, i) => {
                const g = guesses[i]
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    {g ? (
                      <CardFace rank={g.rank} suit={g.suit} size={44} selected />
                    ) : (
                      <div className={i === currentSlot ? 'ring-2 ring-fuchsia-400 rounded-lg' : ''}>
                        <CardFace faceDown size={44} />
                      </div>
                    )}
                    <span className="text-[10px] text-chalk-faint">{i + 1}</span>
                  </div>
                )
              })}
            </div>

            {currentSlot < handSize && (
              <>
                <p className="text-sm font-semibold text-center mb-2">
                  Carte {currentSlot + 1} : {pendingRank === null ? 'quelle valeur ?' : 'quel signe ?'}
                </p>
                {pendingRank === null ? (
                  <div className="grid grid-cols-5 gap-1.5">
                    {RANKS.map((r) => (
                      <button
                        key={r}
                        onClick={() => pickRank(r)}
                        className="glass-card rounded-xl py-2.5 text-sm font-bold text-white active:bg-felt-raised"
                      >
                        {rankLabel(r)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-center gap-2">
                    {SUITS.map((s, suit) => (
                      <button
                        key={suit}
                        onClick={() => pickSuit(suit)}
                        className={`glass-card rounded-xl w-14 h-14 text-2xl active:bg-felt-raised ${s.red ? 'text-red-400' : 'text-white'}`}
                      >
                        {s.symbol}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {guesses.length > 0 && (
              <button onClick={restart} className="block mx-auto mt-3 text-xs text-chalk-faint underline">
                Recommencer
              </button>
            )}
          </Card>
          <Button fullWidth disabled={guesses.length !== handSize} onClick={() => onSubmit(guesses)}>
            Valider ma récitation
          </Button>
        </>
      ) : (
        <>
          <Card className="mb-4">
            <p className="text-center font-bold mb-3">
              {entry.score > 0 ? `🎉 ${entry.score}/${handSize * 2} — ${entry.score} gorgée${entry.score > 1 ? 's' : ''} à distribuer !` : `😅 0/${handSize * 2} — mémoire à travailler !`}
            </p>
            <div className="flex justify-center gap-3">
              {entry.actualHand.map((c, i) => (
                <div key={c.id} className="flex flex-col items-center gap-1">
                  <PlayingCard rank={c.rank} suit={c.suit} size={48} dealDelay={0.1 * i} flipReveal />
                  <span className="text-[10px]">
                    <span className={entry.perCard[i]?.rankCorrect ? 'text-emerald-300' : 'text-pink-300'}>
                      {entry.perCard[i]?.rankCorrect ? '✓' : '✗'} val
                    </span>{' '}
                    <span className={entry.perCard[i]?.suitCorrect ? 'text-emerald-300' : 'text-pink-300'}>
                      {entry.perCard[i]?.suitCorrect ? '✓' : '✗'} signe
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {entry.remaining > 0 ? (
            <Card>
              <p className="text-center text-chalk-soft text-sm mb-3">
                Touche un joueur pour lui donner 1 gorgée — reste{' '}
                <b className="text-fuchsia-300">{entry.remaining}</b> à distribuer (tu peux répartir !)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {members
                  .filter((m) => m.id !== selfId)
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onDistribute(m.id)}
                      className="glass-card rounded-2xl p-3 flex flex-col items-center gap-1.5 relative"
                    >
                      <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
                      <span className="text-xs font-medium truncate w-full text-center">{m.pseudo}</span>
                      {(entry.given[m.id] ?? 0) > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-fuchsia-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {entry.given[m.id]}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </Card>
          ) : (
            <Card className="text-center">
              <p className="text-2xl mb-1">✅</p>
              {entry.bonusSips > 0 && (
                <p className="text-chalk-soft text-xs mb-1">
                  {Object.entries(entry.given)
                    .map(([id, n]) => `${n} → ${members.find((m) => m.id === id)?.pseudo ?? '?'}`)
                    .join(' · ')}
                </p>
              )}
              <GroupPulse actedIds={Object.keys(state.recitation)} noun="ont récité" verb="a récité" mode="creative" />
            </Card>
          )}
        </>
      )}

      <div className="mt-auto pt-6">
        {isHost ? (
          <Button fullWidth variant="secondary" onClick={onAdvance}>
            Voir le classement final →
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-xs">L'hôte peut conclure à tout moment</p>
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
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Pyramide terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🍻 Classement</h1>
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
      <p className="text-center text-chalk-faint text-xs mb-4">💧 Pense à boire de l'eau entre deux verres !</p>
      <Button fullWidth onClick={onExit}>
        Retour au salon
      </Button>
    </div>
  )
}
