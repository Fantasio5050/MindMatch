import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { PlayingCard } from '../shared/PlayingCard'
import { handTotal, OUTCOME_LABEL, type BlackjackClientState } from './types'
import type { Member } from '../../../types'

export function BlackjackController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const me = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const endGame = usePartyStore((s) => s.endGame)
  const { play } = useSound()

  const phase = group?.party.phase ?? null
  const state = (group?.party.roundData as BlackjackClientState | null) ?? null

  if (!group || !me || !state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-white/50 text-sm">Préparation du tapis…</p>
      </div>
    )
  }

  if (group.party.status === 'ended') {
    return <FinalPodium members={group.members} state={state} onExit={() => navigate('/lobby')} />
  }

  const memberName = (id: string) => group.members.find((m) => m.id === id)?.pseudo ?? '?'

  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      {isHost && (
        <div className="flex justify-end mb-2">
          <button onClick={() => { play('pop'); endGame() }} className="text-xs text-white/40 underline">
            Terminer la partie
          </button>
        </div>
      )}

      {phase === 'intro' && <IntroView adult={state.adult} isHost={isHost} onStart={() => { play('start'); hostAdvance() }} />}

      {phase === 'betting' && (
        <BettingView
          state={state}
          meId={me.id}
          onBet={(amount) => { play('pop'); sendAction('bet', { amount }) }}
        />
      )}

      {phase === 'playing' && (
        <PlayingView
          state={state}
          meId={me.id}
          memberName={memberName}
          onHit={() => { play('tick'); sendAction('hit', {}) }}
          onStand={() => { play('pop'); sendAction('stand', {}) }}
        />
      )}

      {phase === 'results' && (
        <ResultsView
          state={state}
          meId={me.id}
          isHost={isHost}
          memberName={memberName}
          onNext={() => { play('pop'); hostAdvance() }}
        />
      )}
    </div>
  )
}

function IntroView({ adult, isHost, onStart }: { adult: boolean; isHost: boolean; onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="text-center mb-6">
        <span className="text-6xl">🃏</span>
        <h1 className="text-3xl font-extrabold shimmer-text mt-2">Blackjack</h1>
      </div>
      <Card className="mb-6">
        <div className="flex flex-col gap-3 text-sm text-white/85">
          <p className="flex gap-3"><span>🎯</span><span>Approche-toi de 21 sans dépasser. Bats le croupier.</span></p>
          <p className="flex gap-3"><span>💰</span><span>Tu mises {adult ? '1 à 5 gorgées' : '1 à 5 jetons'} avant de recevoir tes cartes.</span></p>
          {adult ? (
            <p className="flex gap-3"><span>🍻</span><span>Perdu = tu bois ta mise, sauté = mise +1, gagné = tu ne bois pas.</span></p>
          ) : (
            <p className="flex gap-3"><span>🏆</span><span>Gagné = +ta mise, blackjack = ×1,5. Plus gros tapis à la fin !</span></p>
          )}
        </div>
      </Card>
      {isHost ? (
        <Button fullWidth onClick={onStart} className="!py-3">Distribuer 🃏</Button>
      ) : (
        <p className="text-center text-white/40 text-sm">En attente de l'hôte…</p>
      )}
    </div>
  )
}

function BettingView({ state, meId, onBet }: { state: BlackjackClientState; meId: string; onBet: (n: number) => void }) {
  const [amount, setAmount] = useState(2)
  const myBet = state.bets[meId]
  const betCount = Object.keys(state.bets).length
  const unit = state.adult ? 'gorgée' : 'jeton'

  return (
    <div className="flex-1 flex flex-col justify-center text-center">
      <span className="text-5xl mb-2">💰</span>
      <h1 className="text-2xl font-extrabold mb-1">Faites vos jeux !</h1>
      <p className="text-white/40 text-sm mb-8">{betCount}/{state.order.length} ont misé</p>

      {myBet !== undefined ? (
        <Card className="text-center">
          <p className="text-3xl mb-1">✅</p>
          <p className="font-semibold">Mise : {myBet} {unit}{myBet > 1 ? 's' : ''}</p>
          <p className="text-white/40 text-sm mt-1">En attente des autres…</p>
        </Card>
      ) : (
        <>
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setAmount(n)}
                className={`w-14 h-14 rounded-full font-bold text-lg transition-all ${
                  amount === n ? 'bg-fuchsia-500 text-white scale-110 shadow-lg' : 'bg-white/8 text-white/60'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-white/50 text-sm mb-6">
            Miser <b>{amount}</b> {unit}{amount > 1 ? 's' : ''} {state.adult ? '🍻' : '🎰'}
          </p>
          <Button fullWidth onClick={() => onBet(amount)} className="!py-3">Miser</Button>
        </>
      )}
    </div>
  )
}

function PlayingView({
  state,
  meId,
  memberName,
  onHit,
  onStand,
}: {
  state: BlackjackClientState
  meId: string
  memberName: (id: string) => string
  onHit: () => void
  onStand: () => void
}) {
  const myHand = state.playerHands[meId]
  const myTotal = myHand ? handTotal(myHand.cards) : 0
  const done = !myHand || myHand.stood || myHand.bust || myTotal === 21

  return (
    <div className="flex-1 flex flex-col">
      {/* Croupier */}
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Croupier</p>
        <div className="flex justify-center gap-1.5">
          {state.dealerUp && <PlayingCard rank={state.dealerUp.rank} suit={state.dealerUp.suit} size={44} />}
          <PlayingCard faceDown size={44} dealDelay={0.08} />
        </div>
      </div>

      {/* Ma main */}
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Ta main — {myTotal}</p>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {myHand?.cards.map((c, i) => (
            <PlayingCard key={i} rank={c.rank} suit={c.suit} size={54} dealDelay={0.09 * i} />
          ))}
        </div>
        {myHand?.blackjack && <p className="text-amber-300 font-bold mt-2">Blackjack ! 🎉</p>}
        {myHand?.bust && <p className="text-pink-400 font-bold mt-2">Sauté ! 💥</p>}
      </div>

      <div className="mt-auto">
        {done ? (
          <Card className="text-center">
            <p className="text-white/60 text-sm">
              {myHand?.bust ? 'Tu as sauté.' : myTotal === 21 ? 'Tu as 21 !' : 'Tu restes.'} En attente des autres…
            </p>
          </Card>
        ) : (
          <div className="flex gap-3">
            <Button fullWidth onClick={onHit} className="!py-3">Tirer</Button>
            <Button fullWidth variant="secondary" onClick={onStand} className="!py-3">Rester</Button>
          </div>
        )}

        {/* Statut des autres */}
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {state.order.filter((id) => id !== meId).map((id) => {
            const h = state.playerHands[id]
            const status = !h ? '' : h.bust ? '💥' : h.stood ? '✋' : '🤔'
            return (
              <span key={id} className="text-xs text-white/40">
                {memberName(id)} {status}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ResultsView({
  state,
  meId,
  isHost,
  memberName,
  onNext,
}: {
  state: BlackjackClientState
  meId: string
  isHost: boolean
  memberName: (id: string) => string
  onNext: () => void
}) {
  const mine = state.results?.[meId]
  const dealer = state.dealer
  const won = mine?.outcome === 'win' || mine?.outcome === 'blackjack'

  return (
    <div className="flex-1 flex flex-col">
      <div className="text-center mb-4">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
          Croupier — {dealer?.total}{dealer?.bust ? ' (sauté)' : ''}
        </p>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {dealer?.cards.map((c, i) => (
            // La 2e carte (le "trou") se retourne pour la révélation, comme au vrai Blackjack.
            <PlayingCard key={i} rank={c.rank} suit={c.suit} size={40} dealDelay={0.07 * i} flipReveal={i === 1} />
          ))}
        </div>
      </div>

      {mine && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-4">
          <p className={`text-3xl font-extrabold ${won ? 'text-emerald-300' : mine.outcome === 'push' ? 'text-white/70' : 'text-pink-400'}`}>
            {OUTCOME_LABEL[mine.outcome]}
          </p>
          <p className="text-white/60 text-sm mt-1">
            {state.adult
              ? mine.sips > 0
                ? `Tu bois ${mine.sips} gorgée${mine.sips > 1 ? 's' : ''} 🍻`
                : 'Tu ne bois pas 😎'
              : `${mine.chips >= 0 ? '+' : ''}${mine.chips} jeton${Math.abs(mine.chips) > 1 ? 's' : ''}`}
          </p>
        </motion.div>
      )}

      {/* Récap des autres */}
      <Card className="mb-4">
        <div className="flex flex-col gap-2">
          {state.order.map((id) => {
            const r = state.results?.[id]
            if (!r) return null
            const w = r.outcome === 'win' || r.outcome === 'blackjack'
            return (
              <div key={id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{memberName(id)}</span>
                <span className={w ? 'text-emerald-300' : r.outcome === 'push' ? 'text-white/50' : 'text-pink-300'}>
                  {OUTCOME_LABEL[r.outcome]}
                </span>
                <span className="text-white/40 tabular-nums w-16 text-right">
                  {state.adult ? (r.sips > 0 ? `${r.sips} 🍻` : '—') : `${r.chips >= 0 ? '+' : ''}${r.chips}`}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="mt-auto">
        {isHost ? (
          <Button fullWidth onClick={onNext} className="!py-3">Nouvelle donne →</Button>
        ) : (
          <p className="text-center text-white/40 text-sm">En attente de l'hôte…</p>
        )}
      </div>
    </div>
  )
}

function FinalPodium({ members, state, onExit }: { members: Member[]; state: BlackjackClientState; onExit: () => void }) {
  const ranked = [...members]
    .filter((m) => state.order.includes(m.id))
    .sort((a, b) =>
      state.adult
        ? (state.totalSips[a.id] ?? 0) - (state.totalSips[b.id] ?? 0)
        : (state.chips[b.id] ?? 0) - (state.chips[a.id] ?? 0),
    )
  return (
    <div className="min-h-svh flex flex-col px-6 pt-10 pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-white/40 text-center mb-2">Blackjack terminé</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🏆 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-white/50">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-sm text-white/60 tabular-nums">
              {state.adult ? `${state.totalSips[m.id] ?? 0} 🍻` : `${state.chips[m.id] ?? 0} 🎰`}
            </span>
          </Card>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>Retour au salon</Button>
    </div>
  )
}
