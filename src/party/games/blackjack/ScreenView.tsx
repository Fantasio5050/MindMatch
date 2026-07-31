import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { PodiumRow } from '../shared/PodiumRow'
import { Confetti } from '../../../components/Confetti'
import { PlayingCard } from '../shared/PlayingCard'
import { handTotal, OUTCOME_LABEL, type BlackjackClientState } from './types'
import type { Member } from '../../../types'

export function BlackjackScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null
  const state = (group?.party.roundData as BlackjackClientState | null) ?? null

  const [confetti, setConfetti] = useState(0)
  const lastResults = useRef(0)
  useEffect(() => {
    if (phase === 'results' && state && state.roundsPlayed !== lastResults.current) {
      lastResults.current = state.roundsPlayed
      const anyWin = Object.values(state.results ?? {}).some((r) => r.outcome === 'win' || r.outcome === 'blackjack')
      play(anyWin ? 'win' : 'lose')
      if (Object.values(state.results ?? {}).some((r) => r.outcome === 'blackjack')) setConfetti((n) => n + 1)
    }
  }, [phase, state, play])

  if (!group || !state) {
    return <div className="min-h-svh flex items-center justify-center"><p className="text-chalk-faint text-xl">Connexion à la salle…</p></div>
  }

  const participants = group.members.filter((m) => state.order.includes(m.id))

  if (status === 'ended') return <FinalPodium members={participants} state={state} />

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-12 py-10">
      <Confetti trigger={confetti} />

      {phase === 'intro' && <IntroScreen adult={state.adult} />}

      {phase === 'betting' && (
        <div className="text-center">
          <span className="text-8xl">💰</span>
          <h1 className="text-6xl font-extrabold shimmer-text mt-4 mb-3">Faites vos jeux !</h1>
          <p className="text-chalk-soft text-2xl mb-8">{Object.keys(state.bets).length}/{state.order.length} ont misé</p>
          <div className="flex flex-wrap gap-3 justify-center max-w-4xl">
            {participants.map((m) => (
              <div key={m.id} className="glass-card rounded-2xl px-5 py-3 bg-ink/40 flex items-center gap-2">
                <Avatar pseudo={m.pseudo} color={m.color} size={28} photoUrl={m.photoUrl} />
                <span className="text-lg">{m.pseudo}</span>
                <span className="text-chalk-soft">{state.bets[m.id] !== undefined ? `✅ ${state.bets[m.id]}` : '…'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(phase === 'playing' || phase === 'results') && (
        <div className="w-full max-w-6xl">
          {/* Croupier */}
          <div className="text-center mb-8">
            <p className="text-chalk-faint uppercase tracking-widest text-lg mb-3">
              Croupier{phase === 'results' && state.dealer ? ` — ${state.dealer.total}${state.dealer.bust ? ' 💥' : ''}` : ''}
            </p>
            <div className="flex justify-center gap-2">
              {phase === 'results' && state.dealer
                ? state.dealer.cards.map((c, i) => (
                    <PlayingCard key={i} rank={c.rank} suit={c.suit} size={64} dealDelay={0.07 * i} flipReveal={i === 1} />
                  ))
                : (
                  <>
                    {state.dealerUp && <PlayingCard rank={state.dealerUp.rank} suit={state.dealerUp.suit} size={64} />}
                    <PlayingCard faceDown size={64} dealDelay={0.08} />
                  </>
                )}
            </div>
          </div>

          {/* Joueurs */}
          <div className="flex flex-wrap gap-4 justify-center">
            {participants.map((m) => {
              const h = state.playerHands[m.id]
              if (!h) return null
              const total = handTotal(h.cards)
              const r = state.results?.[m.id]
              const won = r?.outcome === 'win' || r?.outcome === 'blackjack'
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`glass-card rounded-2xl px-4 py-3 bg-ink/40 flex flex-col items-center gap-2 ${
                    r ? (won ? 'ring-2 ring-emerald-400/60' : r.outcome === 'push' ? '' : 'ring-2 ring-pink-500/50') : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar pseudo={m.pseudo} color={m.color} size={26} photoUrl={m.photoUrl} />
                    <span className="font-semibold">{m.pseudo}</span>
                    <span className="text-chalk-soft">— {total}</span>
                  </div>
                  <div className="flex gap-1">
                    {h.cards.map((c, i) => <PlayingCard key={i} rank={c.rank} suit={c.suit} size={40} dealDelay={0.06 * i} />)}
                  </div>
                  {phase === 'playing' && (
                    <span className="text-sm text-chalk-faint">{h.bust ? '💥 Sauté' : h.stood ? '✋ Reste' : total === 21 ? '21 !' : '🤔 En cours'}</span>
                  )}
                  {r && (
                    <span className={`text-sm font-bold ${won ? 'text-emerald-300' : r.outcome === 'push' ? 'text-chalk-soft' : 'text-pink-300'}`}>
                      {OUTCOME_LABEL[r.outcome]} {state.adult ? (r.sips > 0 ? `· ${r.sips}🍻` : '') : `· ${r.chips >= 0 ? '+' : ''}${r.chips}`}
                    </span>
                  )}
                </motion.div>
              )
            })}
          </div>
          <p className="text-center text-chalk-faint text-xl mt-8">
            {phase === 'playing' ? 'Tirez ou restez sur votre téléphone 📱' : "L'hôte relance une donne 📱"}
          </p>
        </div>
      )}
    </div>
  )
}

function IntroScreen({ adult }: { adult: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl px-12 py-10 max-w-2xl bg-ink/40 text-center">
      <span className="text-8xl">🃏</span>
      <h1 className="text-5xl font-extrabold shimmer-text mt-3 mb-6">Blackjack</h1>
      <div className="flex flex-col gap-3 text-2xl text-chalk-muted text-left">
        <p className="flex gap-3"><span>🎯</span><span>Approchez-vous de 21 sans dépasser, battez le croupier.</span></p>
        <p className="flex gap-3"><span>💰</span><span>Chacun mise {adult ? '1 à 5 gorgées' : '1 à 5 jetons'} avant la donne.</span></p>
        <p className="flex gap-3"><span>{adult ? '🍻' : '🏆'}</span><span>{adult ? 'Perdre = boire sa mise. Gagner = intouchable.' : 'Plus gros tapis à la fin !'}</span></p>
      </div>
      <p className="text-chalk-faint text-xl mt-6">L'hôte distribue 📱</p>
    </motion.div>
  )
}

function FinalPodium({ members, state }: { members: Member[]; state: BlackjackClientState }) {
  const ranked = [...members].sort((a, b) =>
    state.adult ? (state.totalSips[a.id] ?? 0) - (state.totalSips[b.id] ?? 0) : (state.chips[b.id] ?? 0) - (state.chips[a.id] ?? 0),
  )
  return (
    <div className="tv-frame text-center">
      <p className="text-chalk-faint text-xl uppercase tracking-widest mb-4">
        Blackjack — {state.roundsPlayed} donne{state.roundsPlayed > 1 ? 's' : ''}
      </p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <PodiumRow key={m.id} rank={i} total={ranked.length} width={500} loserEmoji={state.adult ? '🍺' : '😅'}>
            <span className="text-2xl font-bold w-8 text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-lg text-chalk-soft tabular-nums">
              {state.adult ? `${state.totalSips[m.id] ?? 0} 🍻` : `${state.chips[m.id] ?? 0} 🎰`}
            </span>
          </PodiumRow>
        ))}
      </div>
    </div>
  )
}
