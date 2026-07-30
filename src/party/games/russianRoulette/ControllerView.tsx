import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { CHAMBER_COUNT } from '../../../data/russianRoulette'
import type { RussianRouletteClientState } from './types'
import type { Member } from '../../../types'
import { HostCue } from '../../primitives'

export function RussianRouletteController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const me = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const endGame = usePartyStore((s) => s.endGame)
  const { play } = useSound()

  const phase = group?.party.phase ?? null
  const state = (group?.party.roundData as RussianRouletteClientState | null) ?? null

  // SFX : clic sec de tension, coup de feu au BANG.
  const lastPulls = useRef(-1)
  useEffect(() => {
    if (!state) return
    if (state.pullsDone !== lastPulls.current) {
      lastPulls.current = state.pullsDone
      if (state.lastPull) play(state.lastPull.bang ? 'lose' : 'tick')
    }
  }, [state, play])

  if (!group || !me || !state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-chalk-soft text-sm">Préparation du barillet…</p>
      </div>
    )
  }

  if (group.party.status === 'ended') {
    return <FinalPodium members={group.members} state={state} onExit={() => navigate('/lobby')} />
  }

  const memberName = (id: string) => group.members.find((m) => m.id === id)?.pseudo ?? '?'
  const currentId = state.order[state.currentIndex]
  const isMyTurn = currentId === me.id
  const oddsDenom = Math.max(1, CHAMBER_COUNT - state.chamber)

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      {isHost && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => {
              play('pop')
              endGame()
            }}
            className="text-xs text-chalk-faint underline"
          >
            Terminer la partie
          </button>
        </div>
      )}

      {phase === 'intro' && (
        <IntroView isHost={isHost} onStart={() => { play('start'); hostAdvance() }} />
      )}

      {phase === 'turn' && (
        <TurnView
          isMyTurn={isMyTurn}
          currentName={memberName(currentId)}
          oddsDenom={oddsDenom}
          chamber={state.chamber}
          lastPull={state.lastPull}
          memberName={memberName}
          onPull={() => { play('pop'); sendAction('pull', {}) }}
        />
      )}

      {phase === 'result' && state.lastPull?.bang && (
        <ResultView
          state={state}
          meId={me.id}
          isHost={isHost}
          memberName={memberName}
          onGage={(done) => { play(done ? 'win' : 'lose'); sendAction('gageResult', { done }) }}
          onNext={() => { play('pop'); hostAdvance() }}
        />
      )}
    </div>
  )
}

function IntroView({ isHost, onStart }: { isHost: boolean; onStart: () => void }) {
  const rules = [
    ['🔫', 'Un barillet, 6 chambres, une seule balle.'],
    ['🎯', 'Chacun son tour, tu appuies sur la détente.'],
    ['📈', 'À chaque clic, les chances de BANG montent…'],
    ['💥', 'BANG = gage hardcore ou cul sec de 6 gorgées.'],
    ['🏆', 'Le·la moins imbibé·e à la fin a survécu.'],
  ] as const
  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="text-center mb-6">
        <span className="text-6xl">🔫</span>
        <h1 className="text-3xl font-extrabold shimmer-text mt-2">Roulette russe</h1>
      </div>
      <Card className="mb-6">
        <div className="flex flex-col gap-3">
          {rules.map(([e, t], i) => (
            <p key={i} className="flex gap-3 text-sm text-chalk-muted">
              <span className="text-lg">{e}</span>
              <span>{t}</span>
            </p>
          ))}
        </div>
      </Card>
      {isHost ? (
        <Button fullWidth onClick={onStart} className="!py-3">
          Charger le barillet 🔫
        </Button>
      ) : (
        <HostCue action="a la main" />
      )}
    </div>
  )
}

function TurnView({
  isMyTurn,
  currentName,
  oddsDenom,
  chamber,
  lastPull,
  memberName,
  onPull,
}: {
  isMyTurn: boolean
  currentName: string
  oddsDenom: number
  chamber: number
  lastPull: RussianRouletteClientState['lastPull']
  memberName: (id: string) => string
  onPull: () => void
}) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center text-center">
      {lastPull && !lastPull.bang && (
        <motion.p
          key={lastPull.chamber}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-sm text-emerald-300 mb-4"
        >
          *clic* — {memberName(lastPull.pullerId)} a survécu 😮‍💨
        </motion.p>
      )}

      <p className="text-chalk-soft text-sm mb-1">Chambre {chamber + 1} / {CHAMBER_COUNT}</p>
      <p className="text-chalk-faint text-xs mb-6">Risque de BANG : 1 sur {oddsDenom}</p>

      {isMyTurn ? (
        <>
          <motion.button
            onClick={onPull}
            whileTap={{ scale: 0.9 }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1.1 }}
            className="w-52 h-52 rounded-full bg-gradient-to-b from-pink-500/30 to-red-600/30 border-4 border-red-500/60 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.4)]"
          >
            <span className="text-7xl">🔫</span>
            <span className="text-sm font-bold mt-2 text-chalk-muted">APPUYER</span>
          </motion.button>
          <p className="text-chalk-faint text-xs mt-6">C'est ton tour… courage.</p>
        </>
      ) : (
        <>
          <span className="text-7xl mb-4">🔫</span>
          <p className="text-lg font-semibold">Au tour de {currentName}</p>
          <p className="text-chalk-faint text-sm mt-1">Retiens ton souffle…</p>
        </>
      )}
    </div>
  )
}

function ResultView({
  state,
  meId,
  isHost,
  memberName,
  onGage,
  onNext,
}: {
  state: RussianRouletteClientState
  meId: string
  isHost: boolean
  memberName: (id: string) => string
  onGage: (done: boolean) => void
  onNext: () => void
}) {
  const lp = state.lastPull!
  const iAmLoser = lp.pullerId === meId
  const decided = lp.gageDone !== null

  return (
    <div className="flex-1 flex flex-col justify-center items-center text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', bounce: 0.6 }}
        className="mb-4"
      >
        <span className="text-7xl">💥</span>
        <h1 className="text-4xl font-extrabold text-red-400 mt-1">BANG !</h1>
      </motion.div>
      <p className="text-lg font-semibold mb-4">{memberName(lp.pullerId)} prend la balle.</p>

      {lp.gageText && (
        <Card className="mb-6 border-red-500/40">
          <p className="text-xs uppercase tracking-widest text-chalk-faint mb-1">Gage hardcore</p>
          <p className="text-base font-semibold text-chalk-muted">« {lp.gageText} »</p>
        </Card>
      )}

      {iAmLoser && !decided ? (
        <div className="w-full flex flex-col gap-3">
          <Button fullWidth onClick={() => onGage(true)} className="!py-3">
            ✅ Je relève le gage (+XP)
          </Button>
          <Button fullWidth variant="secondary" onClick={() => onGage(false)} className="!py-3">
            🥃 Je refuse — cul sec (6 gorgées)
          </Button>
        </div>
      ) : (
        <>
          {decided && (
            <p className={`text-lg font-semibold mb-4 ${lp.gageDone ? 'text-emerald-300' : 'text-pink-300'}`}>
              {lp.gageDone ? '✅ Gage relevé !' : `🥃 ${memberName(lp.pullerId)} boit cul sec.`}
            </p>
          )}
          {isHost ? (
            <Button fullWidth onClick={onNext} className="!py-3">
              Recharger et continuer →
            </Button>
          ) : (
            <HostCue
              memberId={decided ? null : lp.pullerId}
              action={decided ? 'relance le barillet' : 'doit choisir'}
            />
          )}
        </>
      )}
    </div>
  )
}

function FinalPodium({
  members,
  state,
  onExit,
}: {
  members: Member[]
  state: RussianRouletteClientState
  onExit: () => void
}) {
  const ranked = [...members]
    .filter((m) => state.order.includes(m.id))
    .sort((a, b) => (state.totalSips[a.id] ?? 0) - (state.totalSips[b.id] ?? 0))
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Roulette russe terminée</p>
      <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">🏆 Survivants</h1>
      <div className="flex flex-col gap-2 mb-6">
        {ranked.map((m, i) => (
          <Card key={m.id} delay={0.05 * i} className="flex items-center gap-3 py-3">
            <span className="text-lg font-bold w-6 text-center text-chalk-soft">{i === 0 ? '🏆' : i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-xs text-chalk-faint">💥 {state.bangs[m.id] ?? 0}</span>
            <span className="text-sm text-chalk-soft tabular-nums">{state.totalSips[m.id] ?? 0} 🍻</span>
          </Card>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>Retour au salon</Button>
      <p className="text-chalk-faint text-xs text-center mt-4">💧 Buvez de l'eau, ne prenez pas le volant après avoir bu.</p>
    </div>
  )
}
