import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { PlayingCard } from '../shared/PlayingCard'
import { HORSES, PMU_TRACK_LEN } from './types'
import type { PmuClientState } from './types'
import { usePmuPlayback } from './usePmuPlayback'
import type { Member } from '../../../types'
import { HostCue } from '../../primitives'

export function PmuController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()

  const phase = group?.party.phase ?? null
  const state = group?.party.roundData as PmuClientState | null
  const racing = phase === 'racing'
  const playback = usePmuPlayback(racing && state ? state.events : null, racing && state ? state.raceStartedAt : null)

  // Jingle personnel à l'arrivée : fanfare si mon cheval gagne, wah-wah sinon.
  const cheeredRace = useRef(0)
  useEffect(() => {
    if (!playback?.done || !state || !currentMember) return
    if (cheeredRace.current === state.racesPlayed) return
    cheeredRace.current = state.racesPlayed
    const myResult = state.raceResults[currentMember.id]
    if (myResult) play(myResult.won ? 'win' : 'lose')
  }, [playback?.done, state, currentMember, play])

  if (!group || !currentMember || !state) return null
  const { party } = group
  const participants = group.members.filter((m) => party.participantIds.includes(m.id))

  if (party.status === 'ended') {
    return <FinalResults members={participants} state={state} onExit={() => navigate('/lobby')} />
  }

  if (phase === 'intro') {
    return <IntroView isHost={isHost} onStart={() => hostAdvance()} />
  }

  if (phase === 'betting') {
    return (
      <BettingView
        state={state}
        totalPlayers={participants.length}
        onBet={(suit, sips) => {
          play('vote')
          sendAction('bet', { suit, sips })
        }}
      />
    )
  }

  if (phase === 'racing' && playback) {
    return (
      <RacingView
        state={state}
        playback={playback}
        selfId={currentMember.id}
        isHost={isHost}
        onResults={() => hostAdvance()}
      />
    )
  }

  if (phase === 'results') {
    return (
      <ResultsView
        state={state}
        members={participants}
        selfId={currentMember.id}
        isHost={isHost}
        onDistribute={(targetMemberId) => {
          play('pop')
          sendAction('distributeSip', { targetMemberId })
        }}
        onNextRace={() => hostAdvance()}
        onFinish={() => sendAction('finish', {})}
      />
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Préparation de l'hippodrome…</p>
    </div>
  )
}

function IntroView({ isHost, onStart }: { isHost: boolean; onStart: () => void }) {
  const rules = [
    ['🏇', 'Les 4 As sont des chevaux : ♠ ♥ ♦ ♣.'],
    ['💰', 'Parie des gorgées (1 à 6) sur le cheval de ton choix.'],
    ['🃏', 'Le paquet défile sur la TV : chaque carte fait avancer le cheval de sa couleur.'],
    ['⚠️', 'Piège : les cartes de côté font RECULER un cheval quand tous ont passé une rangée.'],
    ['🎉', 'Ton cheval gagne : tu distribues le DOUBLE de ta mise (splittable).'],
    ['🍻', 'Il perd : tu bois ta mise. Simple. Cruel. Magnifique.'],
  ] as const

  return (
    <div className="min-h-svh flex flex-col justify-center px-6 py-10 safe-top">
      <div className="text-center mb-6">
        <span className="text-5xl">🏇</span>
        <h1 className="text-2xl font-extrabold mt-2">PMU</h1>
        <p className="text-chalk-faint text-sm">La course se joue sur la TV, en 3D 📺</p>
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
          Ouvrir les paris ! 💰
        </Button>
      ) : (
        <HostCue action="ouvre les paris" />
      )}
      <p className="text-center text-chalk-faint text-xs mt-6">💧 Tu peux toujours remplacer l'alcool par de l'eau.</p>
    </div>
  )
}

function BettingView({
  state,
  totalPlayers,
  onBet,
}: {
  state: PmuClientState
  totalPlayers: number
  onBet: (suit: number, sips: number) => void
}) {
  const [suit, setSuit] = useState<number | null>(state.yourVote?.suit ?? null)
  const [sips, setSips] = useState(state.yourVote?.sips ?? 2)
  const placed = state.yourVote

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-1">Course {state.racesPlayed + 1}</p>
      <h1 className="text-xl font-extrabold text-center mb-5">💰 Fais ton pari</h1>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {HORSES.map((h) => (
          <motion.button
            key={h.suit}
            whileTap={{ scale: 0.96 }}
            onClick={() => setSuit(h.suit)}
            className={`glass-card rounded-3xl p-4 text-center border-2 transition-colors ${
              suit === h.suit ? 'border-fuchsia-400' : 'border-transparent'
            }`}
          >
            <span className="text-4xl block mb-1" style={{ color: h.color }}>
              {h.symbol}
            </span>
            <p className="text-sm font-bold">{h.name}</p>
          </motion.button>
        ))}
      </div>

      <Card className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-chalk-soft">Ta mise</span>
          <span className="text-sm font-bold text-fuchsia-300">
            {sips} gorgée{sips > 1 ? 's' : ''} → {sips * 2} à distribuer si gagné
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={6}
          step={1}
          value={sips}
          onChange={(e) => setSips(Number(e.target.value))}
          className="w-full accent-fuchsia-400"
          aria-label="Nombre de gorgées misées"
        />
      </Card>

      <Button fullWidth disabled={suit === null} onClick={() => suit !== null && onBet(suit, sips)}>
        {placed ? 'Modifier mon pari' : 'Valider mon pari 🏇'}
      </Button>

      {placed && (
        <p className="text-center text-emerald-300 text-sm mt-3">
          ✅ Pari posé : {HORSES[placed.suit].symbol} {HORSES[placed.suit].name} — {placed.sips} gorgée{placed.sips > 1 ? 's' : ''}
        </p>
      )}
      <p className="text-center text-chalk-faint text-xs mt-3">
        {state.votedCount}/{totalPlayers} paris posés — la course part quand tout le monde a parié !
      </p>
    </div>
  )
}

function RacingView({
  state,
  playback,
  selfId,
  isHost,
  onResults,
}: {
  state: PmuClientState
  playback: NonNullable<ReturnType<typeof usePmuPlayback>>
  selfId: string
  isHost: boolean
  onResults: () => void
}) {
  const myBet = state.bets[selfId]
  const event = playback.current

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Course {state.racesPlayed} 🏇</p>

      {playback.countdown ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <motion.span
            key={playback.countdownSeconds}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-7xl font-extrabold shimmer-text"
          >
            {playback.countdownSeconds > 0 ? playback.countdownSeconds : 'Partez !'}
          </motion.span>
          <p className="text-chalk-faint text-sm mt-6">📺 Regarde la course en 3D sur la TV !</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center mb-5 min-h-[150px] justify-center">
            {event && event.type !== 'finish' && (
              <PlayingCard key={playback.index} rank={event.card.rank} suit={event.card.suit} size={64} />
            )}
            {event && (
              <p className="mt-2 text-sm font-bold text-center" style={{ color: HORSES[event.suit].color }}>
                {event.type === 'draw' && `${HORSES[event.suit].symbol} ${HORSES[event.suit].name} avance !`}
                {event.type === 'setback' && `⚠️ ${HORSES[event.suit].symbol} recule !`}
                {event.type === 'finish' && `🏆 ${HORSES[event.suit].name} gagne !`}
              </p>
            )}
            {playback.done && <p className="text-chalk-soft text-sm mt-2">Course terminée !</p>}
          </div>

          <div className="flex flex-col gap-3 mb-6">
            {HORSES.map((h) => (
              <div key={h.suit} className="flex items-center gap-2">
                <span className="text-xl w-7" style={{ color: h.color }}>
                  {h.symbol}
                </span>
                <div className="flex-1 h-4 rounded-full bg-felt-raised overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(playback.positions[h.suit] / PMU_TRACK_LEN) * 100}%`, background: h.color }}
                  />
                </div>
                <span className="text-lg">🐎</span>
                {myBet?.suit === h.suit && <span className="text-[10px] font-bold text-fuchsia-300">TOI</span>}
              </div>
            ))}
          </div>
          <p className="text-center text-chalk-faint text-xs">📺 La vraie course est sur la TV !</p>
        </>
      )}

      <div className="mt-auto pt-4">
        {isHost && playback.done ? (
          <Button fullWidth onClick={onResults}>
            Voir les résultats →
          </Button>
        ) : isHost ? (
          <p className="text-center text-chalk-faint text-xs">Les résultats arrivent à la fin de la course…</p>
        ) : null}
      </div>
    </div>
  )
}

function ResultsView({
  state,
  members,
  selfId,
  isHost,
  onDistribute,
  onNextRace,
  onFinish,
}: {
  state: PmuClientState
  members: Member[]
  selfId: string
  isHost: boolean
  onDistribute: (targetMemberId: string) => void
  onNextRace: () => void
  onFinish: () => void
}) {
  const winner = state.winnerSuit !== null ? HORSES[state.winnerSuit] : null
  const myResult = state.raceResults[selfId]

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      {winner && (
        <h1 className="text-xl font-extrabold text-center mb-4">
          🏆 <span style={{ color: winner.color }}>{winner.symbol} {winner.name}</span> l'emporte !
        </h1>
      )}

      {myResult ? (
        myResult.won ? (
          <Card className="mb-4 border-emerald-400/30">
            <p className="text-center font-bold mb-1">🎉 Bien joué, tu avais le bon cheval !</p>
            {myResult.remaining > 0 ? (
              <>
                <p className="text-center text-chalk-soft text-sm mb-3">
                  Touche un joueur pour lui donner 1 gorgée — reste <b className="text-fuchsia-300">{myResult.remaining}</b> (tu peux répartir !)
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
                        {(myResult.given[m.id] ?? 0) > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-fuchsia-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {myResult.given[m.id]}
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              </>
            ) : (
              <p className="text-center text-chalk-soft text-sm">
                ✅ {myResult.sipsToGive} gorgée{myResult.sipsToGive > 1 ? 's' : ''} distribuée{myResult.sipsToGive > 1 ? 's' : ''} !
              </p>
            )}
          </Card>
        ) : (
          <Card className="mb-4 border-pink-500/30 text-center">
            <p className="font-bold mb-1">
              ❌ {HORSES[myResult.bet.suit].symbol} n'a pas tenu la distance…
            </p>
            <p className="text-pink-300 text-sm font-semibold">
              Tu bois {myResult.sipsToDrink} gorgée{myResult.sipsToDrink > 1 ? 's' : ''} 🍻
            </p>
          </Card>
        )
      ) : (
        <Card className="mb-4 text-center">
          <p className="text-chalk-faint text-sm">Tu n'avais pas parié sur cette course.</p>
        </Card>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {members.map((m) => {
          const r = state.raceResults[m.id]
          if (!r || m.id === selfId) return null
          return (
            <div key={m.id} className="flex items-center gap-3 text-sm">
              <Avatar pseudo={m.pseudo} color={m.color} size={28} photoUrl={m.photoUrl} />
              <span className="flex-1 truncate">{m.pseudo}</span>
              <span style={{ color: HORSES[r.bet.suit].color }}>{HORSES[r.bet.suit].symbol}</span>
              <span className={r.won ? 'text-emerald-300' : 'text-pink-300'}>
                {r.won ? `distribue ${r.sipsToGive}` : `boit ${r.sipsToDrink} 🍻`}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-auto pt-4 flex flex-col gap-2">
        {isHost ? (
          <>
            <Button fullWidth onClick={onNextRace}>
              🏇 Course suivante
            </Button>
            <Button fullWidth variant="secondary" onClick={onFinish}>
              Terminer le PMU (podium)
            </Button>
          </>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte relance une course ou clôt le PMU…</p>
        )}
      </div>
    </div>
  )
}

function FinalResults({ members, state, onExit }: { members: Member[]; state: PmuClientState; onExit: () => void }) {
  const ranked = [...members].sort((a, b) => (state.totalSipsDrunk[a.id] ?? 0) - (state.totalSipsDrunk[b.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">
        PMU terminé — {state.racesPlayed} course{state.racesPlayed > 1 ? 's' : ''}
      </p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🏇 Classement</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{m.pseudo}</p>
              <p className="text-[11px] text-chalk-faint">
                🏅 {state.raceWins[m.id] ?? 0} course{(state.raceWins[m.id] ?? 0) > 1 ? 's' : ''} gagnée{(state.raceWins[m.id] ?? 0) > 1 ? 's' : ''} · ↗ {state.totalSipsGiven[m.id] ?? 0} données
              </p>
            </div>
            <span className="text-sm text-chalk-soft">{state.totalSipsDrunk[m.id] ?? 0} 🍻</span>
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
