import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { PodiumRow } from '../shared/PodiumRow'
import { Confetti } from '../../../components/Confetti'
import { SceneErrorBoundary } from '../../../components/SceneErrorBoundary'
import { CardFace } from '../pyramid/CardFace'
import { HORSES, PMU_TRACK_LEN } from './types'
import type { PmuClientState } from './types'
import { usePmuPlayback } from './usePmuPlayback'
import type { Member } from '../../../types'

// three.js ne se charge que quand la TV affiche réellement le PMU.
const RaceScene3D = lazy(() => import('./RaceScene3D'))

export function PmuScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null
  const state = group?.party.roundData as PmuClientState | null

  const racing = phase === 'racing' || phase === 'results'
  const playback = usePmuPlayback(racing && state ? state.events : null, racing && state ? state.raceStartedAt : null)

  // SFX calés sur la lecture : tick à chaque carte, wah-wah au recul, fanfare + confettis à l'arrivée.
  const lastIndex = useRef(-2)
  useEffect(() => {
    if (!playback || !state) return
    if (playback.index !== lastIndex.current) {
      lastIndex.current = playback.index
      const event = playback.current
      if (event?.type === 'draw') play('tick')
      if (event?.type === 'setback') play('lose')
      if (event?.type === 'finish') {
        play('win')
        setConfettiTrigger((n) => n + 1)
      }
    }
  }, [playback, state, play])

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const participants = group.members.filter((m) => group.party.participantIds.includes(m.id))

  if (status === 'ended' && state) {
    return <FinalPodium members={participants} state={state} />
  }

  return (
    <div className="relative min-h-svh overflow-hidden">
      <Confetti trigger={confettiTrigger} />
      <SceneErrorBoundary
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/30 text-xl px-10 text-center">🏇 Affichage 3D indisponible sur cet appareil — la course continue ci-dessous.</p>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/40 text-2xl">Préparation de l'hippodrome… 🏇</p>
            </div>
          }
        >
          <RaceScene3D
            events={racing && state ? state.events : null}
            raceStartedAt={racing && state ? state.raceStartedAt : null}
            winnerSuit={state?.winnerSuit ?? null}
          />
        </Suspense>
      </SceneErrorBoundary>

      {/* HUD au-dessus de la 3D */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {phase === 'intro' && <IntroOverlay />}
        {phase === 'betting' && state && <BettingOverlay state={state} participants={participants} />}
        {phase === 'racing' && state && playback && <RaceHud state={state} playback={playback} members={participants} />}
        {phase === 'results' && state && <ResultsOverlay state={state} members={participants} />}
      </div>
    </div>
  )
}

function IntroOverlay() {
  const rules = [
    ['🏇', 'Les 4 As sont des chevaux : Pique, Cœur, Carreau, Trèfle.'],
    ['💰', 'Chacun parie des gorgées (1 à 6) sur un cheval.'],
    ['🃏', 'Le paquet défile : chaque carte fait galoper le cheval de sa couleur.'],
    ['⚠️', 'Les cartes de côté font RECULER un cheval quand tous ont passé une rangée…'],
    ['🍻', 'Cheval gagnant : tu distribues le DOUBLE de ta mise. Perdant : tu bois ta mise.'],
  ] as const
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl px-12 py-10 max-w-2xl bg-black/40"
      >
        <h1 className="text-5xl font-extrabold shimmer-text text-center mb-6">🏇 PMU</h1>
        <div className="flex flex-col gap-3 text-xl text-white/85">
          {rules.map(([emoji, text], i) => (
            <motion.p key={i} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 * i }} className="flex gap-3">
              <span>{emoji}</span>
              <span>{text}</span>
            </motion.p>
          ))}
        </div>
        <p className="text-white/40 text-lg text-center mt-6">L'hôte ouvre les paris sur son téléphone 📱</p>
      </motion.div>
    </div>
  )
}

function BettingOverlay({ state, participants }: { state: PmuClientState; participants: Member[] }) {
  return (
    <>
      <div className="flex justify-center pt-8">
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl px-10 py-5 bg-black/40 text-center">
          <h1 className="text-4xl font-extrabold shimmer-text mb-1">Faites vos jeux ! 💰</h1>
          <p className="text-white/60 text-xl">
            Pariez sur votre téléphone — {state.votedCount}/{participants.length} paris posés
          </p>
        </motion.div>
      </div>
      <div className="mt-auto flex justify-center gap-4 pb-8">
        {HORSES.map((h) => (
          <div key={h.suit} className="glass-card rounded-2xl px-5 py-3 bg-black/40 flex items-center gap-3">
            <span className="text-3xl" style={{ color: h.color }}>
              {h.symbol}
            </span>
            <span className="text-lg font-semibold">{h.name}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function RaceHud({
  state,
  playback,
  members,
}: {
  state: PmuClientState
  playback: NonNullable<ReturnType<typeof usePmuPlayback>>
  members: Member[]
}) {
  const event = playback.current

  return (
    <>
      {/* Compte à rebours de départ */}
      <AnimatePresence>
        {playback.countdown && (
          <motion.div
            key={playback.countdownSeconds}
            initial={{ scale: 2.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-[10rem] font-extrabold shimmer-text drop-shadow-2xl">
              {playback.countdownSeconds > 0 ? playback.countdownSeconds : 'Partez !'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Carte tirée + commentaire */}
      {!playback.countdown && event && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          {/* Transitions très courtes : à ~1 carte/seconde, un fondu long rendrait la carte
              illisible la moitié du temps. */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={playback.index}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.06 } }}
              transition={{ duration: 0.14 }}
              className="flex flex-col items-center gap-2"
            >
              {event.type !== 'finish' && <CardFace rank={event.card.rank} suit={event.card.suit} size={76} />}
              <div className="glass-card rounded-full px-6 py-2 bg-black/50 text-xl font-bold" style={{ color: HORSES[event.suit].color }}>
                {event.type === 'draw' && `${HORSES[event.suit].symbol} ${HORSES[event.suit].name} avance !`}
                {event.type === 'setback' && `⚠️ Carte de côté : ${HORSES[event.suit].symbol} recule !`}
                {event.type === 'finish' && `🏆 ${HORSES[event.suit].name} remporte la course !`}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Mini-classement + paris en bas */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-end gap-6">
        <div className="glass-card rounded-2xl px-5 py-3 bg-black/50 flex flex-col gap-1.5">
          {HORSES.map((h) => (
            <div key={h.suit} className="flex items-center gap-2">
              <span className="text-lg w-6" style={{ color: h.color }}>
                {h.symbol}
              </span>
              <div className="w-56 h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(playback.positions[h.suit] / PMU_TRACK_LEN) * 100}%`, background: h.color }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="glass-card rounded-2xl px-5 py-3 bg-black/50 flex flex-col gap-1 max-h-40 overflow-hidden">
          {members.map((m) => {
            const bet = state.bets[m.id]
            if (!bet) return null
            return (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <Avatar pseudo={m.pseudo} color={m.color} size={22} photoUrl={m.photoUrl} />
                <span className="w-24 truncate">{m.pseudo}</span>
                <span style={{ color: HORSES[bet.suit].color }}>{HORSES[bet.suit].symbol}</span>
                <span className="text-white/50">{bet.sips} 🍻</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function ResultsOverlay({ state, members }: { state: PmuClientState; members: Member[] }) {
  const winner = state.winnerSuit !== null ? HORSES[state.winnerSuit] : null
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="glass-card rounded-3xl px-12 py-8 bg-black/50 max-w-2xl w-full">
        {winner && (
          <h1 className="text-4xl font-extrabold text-center mb-6">
            🏆 <span style={{ color: winner.color }}>{winner.symbol} {winner.name}</span> l'emporte !
          </h1>
        )}
        <div className="flex flex-col gap-3">
          {members.map((m) => {
            const r = state.raceResults[m.id]
            if (!r) return null
            return (
              <div key={m.id} className="flex items-center gap-3 text-xl">
                <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
                <span className="w-40 truncate font-medium">{m.pseudo}</span>
                <span style={{ color: HORSES[r.bet.suit].color }}>{HORSES[r.bet.suit].symbol}</span>
                <span className="flex-1 text-right">
                  {r.won ? (
                    <span className="text-emerald-300">distribue {r.sipsToGive} gorgée{r.sipsToGive > 1 ? 's' : ''} 🎉</span>
                  ) : (
                    <span className="text-pink-300">boit {r.sipsToDrink} gorgée{r.sipsToDrink > 1 ? 's' : ''} 🍻</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-white/40 text-lg text-center mt-6">
          Course {state.racesPlayed} — l'hôte peut relancer une course ou clore le PMU 📱
        </p>
      </motion.div>
    </div>
  )
}

function FinalPodium({ members, state }: { members: Member[]; state: PmuClientState }) {
  const ranked = [...members].sort((a, b) => (state.totalSipsDrunk[a.id] ?? 0) - (state.totalSipsDrunk[b.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12 text-center">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-4">PMU terminé — {state.racesPlayed} course{state.racesPlayed > 1 ? 's' : ''}</p>
      <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏇 Classement final</h1>
      <div className="flex flex-col gap-4 items-center">
        {ranked.map((m, i) => (
          <PodiumRow key={m.id} rank={i} total={ranked.length} width={520} loserEmoji="🍺">
            <span className="text-2xl font-bold w-8 text-white/50">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
            <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
            <span className="text-white/50 text-lg">🏅 {state.raceWins[m.id] ?? 0}</span>
            <span className="text-emerald-300/80 text-lg">↗ {state.totalSipsGiven[m.id] ?? 0}</span>
            <span className="text-lg text-white/60 tabular-nums">{state.totalSipsDrunk[m.id] ?? 0} 🍻</span>
          </PodiumRow>
        ))}
      </div>
      <p className="text-white/30 text-lg mt-8">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
    </div>
  )
}
