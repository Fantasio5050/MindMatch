import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Avatar } from '../../../components/Avatar'
import { Confetti } from '../../../components/Confetti'
import { PodiumRow } from '../shared/PodiumRow'
import { rankArtists } from './ControllerView'
import { CDC_SLIDESHOW_MS, type CoupDeCrayonClientState } from './types'
import type { Member } from '../../../types'

export function CoupDeCrayonScreen() {
  const group = usePartyStore((s) => s.group)
  const { play } = useSound()
  const [confetti, setConfetti] = useState(0)
  const lastResults = useRef(-1)
  const phase = group?.party.phase ?? null
  const status = group?.party.status ?? null
  const state = (group?.party.roundData as CoupDeCrayonClientState | null) ?? null

  useEffect(() => {
    if (phase === 'results' && state && state.roundsPlayed !== lastResults.current) {
      lastResults.current = state.roundsPlayed
      play('win')
      setConfetti((n) => n + 1)
    }
  }, [phase, state, play])

  if (!group || !state) {
    return <div className="min-h-svh flex items-center justify-center"><p className="text-white/40 text-xl">Connexion à la salle…</p></div>
  }

  const participants = group.members.filter((m) => state.order.includes(m.id))

  if (status === 'ended') {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-16 py-12 text-center">
        <Confetti trigger={confetti} />
        <p className="text-white/40 text-xl uppercase tracking-widest mb-4">Coup de Crayon — {state.roundsPlayed} manche{state.roundsPlayed > 1 ? 's' : ''}</p>
        <h1 className="text-6xl font-extrabold shimmer-text mb-12">🏆 Classement final</h1>
        <div className="flex flex-col gap-4 items-center">
          {rankArtists(participants, state).map((m, i, arr) => (
            <PodiumRow key={m.id} rank={i} total={arr.length} width={500}>
              <span className="text-2xl font-bold w-8 text-white/50">{i === 0 ? '🏆' : i + 1}</span>
              <Avatar pseudo={m.pseudo} color={m.color} size={44} photoUrl={m.photoUrl} />
              <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
              <span className="text-lg text-white/60 tabular-nums">🏆 {state.artScore[m.id] ?? 0} · 🤣 {state.funScore[m.id] ?? 0}</span>
            </PodiumRow>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-12 py-10">
      <Confetti trigger={confetti} />
      {phase === 'intro' && <IntroScreen state={state} />}
      {phase === 'drawing' && <DrawingScreen state={state} participants={participants} />}
      {phase === 'voting' && <VotingScreen state={state} participants={participants} />}
      {phase === 'results' && <ResultsScreen state={state} members={participants} />}
    </div>
  )
}

function IntroScreen({ state }: { state: CoupDeCrayonClientState }) {
  const rules = [
    ['🎲', 'Un mot tiré au sort — tout le monde dessine LE MÊME mot.'],
    ['⏱️', `${state.drawSeconds} secondes chrono sur le téléphone.`],
    ['📺', 'Révélation des dessins ici, un par un, anonymement.'],
    ['🏆🤣', 'Double vote : le mieux réussi ET le plus drôle.'],
  ] as const
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl">
      <span className="text-7xl mb-4 inline-block">🖍️</span>
      <h1 className="text-6xl font-extrabold shimmer-text mb-8">Coup de Crayon</h1>
      <div className="flex flex-col gap-4 items-start mx-auto w-fit">
        {rules.map(([emoji, text], i) => (
          <motion.p key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 * i }} className="text-2xl text-white/85 flex gap-3">
            <span>{emoji}</span>
            <span>{text}</span>
          </motion.p>
        ))}
      </div>
      <p className="text-white/30 text-xl mt-10">L'hôte distribue les crayons 📱</p>
    </motion.div>
  )
}

function DrawingScreen({ state, participants }: { state: CoupDeCrayonClientState; participants: Member[] }) {
  const [secondsLeft, setSecondsLeft] = useState(state.drawSeconds)
  useEffect(() => {
    const startedAt = state.drawingStartedAt ?? Date.now()
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil(state.drawSeconds - (Date.now() - startedAt) / 1000)))
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [state.drawingStartedAt, state.drawSeconds])

  return (
    <div className="text-center w-full max-w-4xl">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-6">
        Manche {state.roundsPlayed + 1} / {state.totalRounds} — tout le monde dessine :
      </p>
      <div className="rounded-3xl bg-[#141019] border border-white/10 px-12 py-8 inline-block mb-8 shadow-2xl">
        <p className="text-5xl font-extrabold">{state.currentWord}</p>
      </div>
      <motion.p
        key={secondsLeft <= 10 ? secondsLeft : 'calm'}
        initial={secondsLeft <= 10 ? { scale: 1.5, opacity: 0.6 } : false}
        animate={{ scale: 1, opacity: 1 }}
        className={`text-7xl font-extrabold tabular-nums mb-10 ${secondsLeft <= 10 ? 'text-pink-300' : ''}`}
      >
        {secondsLeft}s
      </motion.p>
      <p className="text-white/50 text-2xl mb-5">✏️ {state.submittedCount}/{participants.length} dessins rendus</p>
      <div className="flex flex-wrap gap-3 justify-center">
        {participants.map((m) => (
          <div key={m.id} className="flex items-center gap-2 glass-card rounded-full pl-1.5 pr-4 py-1.5 bg-black/30">
            <Avatar pseudo={m.pseudo} color={m.color} size={28} photoUrl={m.photoUrl} />
            <span className="text-lg">{m.pseudo}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Vote : d'abord un diaporama suspense (un dessin à la fois), puis la galerie complète pendant
 * que les votes tombent. Cadencé côté client sur votingStartedAt — aucun timer serveur. */
function VotingScreen({ state, participants }: { state: CoupDeCrayonClientState; participants: Member[] }) {
  const { play } = useSound()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 400)
    return () => clearInterval(interval)
  }, [])

  const startedAt = state.votingStartedAt ?? now
  const slideIndex = Math.floor((now - startedAt) / CDC_SLIDESHOW_MS)
  const inSlideshow = slideIndex < state.gallery.length

  const lastSlide = useRef(-1)
  useEffect(() => {
    if (inSlideshow && slideIndex !== lastSlide.current) {
      lastSlide.current = slideIndex
      play('tick')
    }
  }, [inSlideshow, slideIndex, play])

  if (inSlideshow) {
    return (
      <div className="text-center">
        <p className="text-white/40 text-xl uppercase tracking-widest mb-6">« {state.currentWord} » — dessin {slideIndex + 1} / {state.gallery.length}</p>
        <AnimatePresence mode="wait">
          <motion.img
            key={slideIndex}
            src={state.gallery[slideIndex]?.image}
            alt={`Dessin ${slideIndex + 1}`}
            initial={{ opacity: 0, scale: 0.85, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="mx-auto rounded-3xl border-4 border-white/20 bg-white shadow-2xl"
            style={{ maxHeight: '62vh' }}
          />
        </AnimatePresence>
        <p className="text-white/30 text-lg mt-6">🤫 Anonyme… votez sur vos téléphones après le défilé</p>
      </div>
    )
  }

  return (
    <div className="text-center w-full max-w-6xl">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-2">« {state.currentWord} »</p>
      <p className="text-2xl text-white/70 mb-6">
        Votez 🏆 le mieux réussi et 🤣 le plus drôle — {state.votedCount}/{participants.length} 📱
      </p>
      <div className="flex flex-wrap gap-5 justify-center">
        {state.gallery.map((g, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
            className="rounded-2xl overflow-hidden border-2 border-white/20 bg-white shadow-xl"
          >
            <img src={g.image} alt={`Dessin ${i + 1}`} style={{ height: '30vh' }} />
            <p className="text-center text-[#1a1030] font-bold text-sm py-1">n°{i + 1}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ResultsScreen({ state, members }: { state: CoupDeCrayonClientState; members: Member[] }) {
  const r = state.results
  if (!r) return null
  const member = (id: string) => members.find((m) => m.id === id)

  const winnerBlock = (indices: number[], tally: number[], emoji: string, label: string, ring: string) =>
    indices.length > 0 && (
      <div className="text-center">
        <p className="text-2xl font-bold mb-3">{emoji} {label}</p>
        <div className="flex gap-4 justify-center">
          {indices.map((i) => {
            const author = member(r.entries[i].authorId)
            return (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <img src={r.entries[i].image} alt="" className={`rounded-2xl border-4 bg-white shadow-2xl ${ring}`} style={{ maxHeight: '34vh' }} />
                <div className="flex items-center justify-center gap-2 mt-2">
                  {author && <Avatar pseudo={author.pseudo} color={author.color} size={30} photoUrl={author.photoUrl} />}
                  <span className="text-xl font-bold">{author?.pseudo ?? '?'}</span>
                  <span className="text-white/50">· {tally[i]} vote{tally[i] > 1 ? 's' : ''}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    )

  return (
    <div className="w-full max-w-6xl flex flex-col items-center">
      <p className="text-white/40 text-xl uppercase tracking-widest mb-6">Résultats — « {r.word} »</p>
      <div className="flex flex-wrap gap-12 justify-center mb-8">
        {winnerBlock(r.bestWinners, r.bestVotes, '🏆', 'Le mieux réussi', 'border-amber-300/80')}
        {winnerBlock(r.funnyWinners, r.funnyVotes, '🤣', 'Le plus drôle', 'border-fuchsia-400/80')}
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {r.entries.map((e, i) => {
          const author = member(e.authorId)
          return (
            <div key={i} className="text-center">
              <img src={e.image} alt="" className="rounded-xl border border-white/15 bg-white" style={{ height: '14vh' }} />
              <p className="text-xs text-white/60 mt-1">{author?.pseudo ?? '?'} · 🏆{r.bestVotes[i]} 🤣{r.funnyVotes[i]}</p>
            </div>
          )
        })}
      </div>
      <p className="text-white/30 text-lg mt-8">L'hôte enchaîne 📱</p>
    </div>
  )
}
