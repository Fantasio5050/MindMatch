import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { Player } from '../../../components/Player'
import { TvViewport } from '../../primitives/TvViewport'
import { CssDie } from './CssDie'
import { FLAVOR, currentTurn, ranking, sips, useRollAnimation } from './shared'
import type { DiceClientState } from './types'
import type { DiceMember, DiceTable, DiceTableEvent, DiceTableState } from './three/diceTable'
import type { Member } from '../../../types'

/**
 * Lancer de dés sur la TV : le bac à dés en 3D temps réel, et par-dessus un habillage léger à
 * l'échelle de scène (à qui le tour, le verdict « X boit N gorgées », le classement final).
 * Sans WebGL, on bascule sur un écran 2D où le dé roule en 3D CSS.
 */
export function DiceScreen() {
  const group = usePartyStore((s) => s.group)
  const [flat, setFlat] = useState(false)
  const state = (group?.party.roundData ?? null) as DiceClientState | null

  if (!group || !state) return null
  const phase = (group.party.status === 'ended' ? 'ended' : group.party.phase) as DiceTableState['phase']
  if (flat) {
    return (
      <TvViewport>
        <DiceFlatScreen state={state} phase={phase} members={group.members} />
      </TvViewport>
    )
  }
  return <Dice3D state={state} phase={phase} members={group.members} onUnsupported={() => setFlat(true)} />
}

type Banner = { n: number; memberId: string; value: number } | null

function Dice3D({ state, phase, members, onUnsupported }: { state: DiceClientState; phase: DiceTableState['phase']; members: Member[]; onUnsupported: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const table = useRef<DiceTable | null>(null)
  const [ready, setReady] = useState(false)
  // Ce que la scène est en train de montrer : le HUD suit la scène, pas l'état du serveur (qui a
  // déjà passé la main au joueur suivant pendant que le dé roule encore).
  const [rolling, setRolling] = useState<string | null>(null)
  const [banner, setBanner] = useState<Banner>(null)
  // Dernier lancer dont la scène a montré le résultat : les compteurs n'en disent pas plus.
  const [revealedN, setRevealedN] = useState(state.lastRoll?.n ?? 0)

  const tableMembers: DiceMember[] = useMemo(() => members.map((m) => ({ id: m.id, pseudo: m.pseudo, color: m.color, photoUrl: m.photoUrl })), [members])

  useEffect(() => {
    let cancelled = false
    let instance: DiceTable | null = null
    const onEvent = (e: DiceTableEvent) => {
      if (e.type === 'rolling') {
        setRolling(e.memberId)
        setBanner(null)
      } else if (e.type === 'landed') {
        setRolling(null)
        setRevealedN(e.n)
        setBanner({ n: e.n, memberId: e.memberId, value: e.value })
      } else {
        setRolling(null)
      }
    }
    void import('./three/diceTable')
      .then(({ DiceTable }) => DiceTable.create(host.current!, onEvent))
      .then((t) => {
        if (cancelled) {
          t.dispose()
          return
        }
        instance = t
        table.current = t
        setReady(true)
      })
      .catch((error) => {
        console.error('Lancer de dés 3D indisponible, repli en 2D :', error)
        if (!cancelled) onUnsupported()
      })
    return () => {
      cancelled = true
      instance?.dispose()
      table.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || !table.current) return
    if (table.current.fatal) {
      onUnsupported()
      return
    }
    table.current.sync(
      { phase, order: state.order, currentId: currentTurn(state, members), lastRoll: state.lastRoll, totalSips: state.totalSips },
      tableMembers,
    )
  }, [ready, state, phase, members, tableMembers, onUnsupported])

  // Le verdict reste affiché un moment, puis laisse la place au joueur suivant.
  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner((b) => (b?.n === banner.n ? null : b)), 4200)
    return () => window.clearTimeout(t)
  }, [banner])

  return (
    <div className="fixed inset-0 bg-[#0a0709]">
      <div ref={host} className="absolute inset-0" />
      <Hud state={state} phase={phase} members={members} rolling={rolling} banner={banner} revealedN={revealedN} />
    </div>
  )
}

function Hud({
  state,
  phase,
  members,
  rolling,
  banner,
  revealedN,
}: {
  state: DiceClientState
  phase: DiceTableState['phase']
  members: Member[]
  rolling: string | null
  banner: Banner
  revealedN: number
}) {
  const byId = (id: string | null | undefined) => members.find((m) => m.id === id)
  const current = byId(rolling ?? currentTurn(state, members))
  // Les lancers pas encore montrés par la scène ne comptent pas encore : pas de spoiler.
  const hidden = state.history.filter((r) => r.n > revealedN)
  const totalDrunk = Object.values(state.totalSips).reduce((a, b) => a + b, 0) - hidden.reduce((a, r) => a + r.value, 0)
  const rollsShown = state.rolls - hidden.length
  const bannerMember = byId(banner?.memberId)

  return (
    <div className="pointer-events-none absolute inset-0" style={{ padding: 'var(--tv-gutter-y) var(--tv-gutter-x)', paddingTop: 'var(--tv-gutter-top)' }}>
      {phase === 'turn' && (
        <div className="flex items-start justify-between">
          <AnimatePresence mode="wait">
            {banner && bannerMember ? (
              // Le verdict du lancer prend la place du « à qui le tour » : même endroit, en grand.
              <motion.div
                key={`b${banner.n}`}
                initial={{ opacity: 0, y: -20, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="flex items-center gap-5 rounded-sheet bg-ink/80 border-2 px-6 py-3 backdrop-blur-sm"
                style={{ borderColor: bannerMember.color }}
              >
                <Player member={bannerMember} size="focus" showName={false} />
                <div>
                  <p className="font-stage text-tv-2xl text-chalk leading-none">
                    {bannerMember.pseudo} boit <span style={{ color: '#f5a524' }}>{sips(banner.value)}</span>
                  </p>
                  <p className="text-tv-base text-chalk-muted mt-1">{FLAVOR[banner.value]}</p>
                </div>
              </motion.div>
            ) : current && (
              <motion.div
                key={`${current.id}-${rolling ? 'r' : 't'}`}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="flex items-center gap-4 rounded-sheet bg-ink/70 border border-line px-5 py-3 backdrop-blur-sm"
              >
                <Player member={current} size="focus" showName={false} speaking />
                <div>
                  <p className="kicker text-tv-xs">{rolling ? 'Lance le dé…' : 'Au tour de'}</p>
                  <p className="font-stage text-tv-xl text-chalk leading-none">{current.pseudo}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="ml-auto flex items-center gap-5 rounded-sheet bg-ink/70 border border-line px-5 py-3 backdrop-blur-sm">
            <div className="text-center">
              <p className="kicker text-tv-xs">Lancers</p>
              <p className="font-stage text-tv-lg text-chalk leading-none tabular-nums">{rollsShown}</p>
            </div>
            <div className="w-px self-stretch bg-line" />
            <div className="text-center">
              <p className="kicker text-tv-xs">Gorgées bues</p>
              <p className="font-stage text-tv-lg leading-none tabular-nums" style={{ color: '#f5a524' }}>
                {totalDrunk}
              </p>
            </div>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute rounded-sheet bg-ink/75 border border-line px-7 py-5 backdrop-blur-sm"
          style={{ left: 'var(--tv-gutter-x)', top: 'var(--tv-gutter-top)', maxWidth: '32%' }}
        >
          <p className="font-stage text-tv-2xl text-chalk mb-2">Lancer de dés</p>
          <p className="text-tv-base text-chalk-muted">
            Chacun son tour, lance le dé depuis ton téléphone. Ce que tu fais, <b className="text-chalk">tu le bois</b>. C'est tout.
          </p>
          <p className="kicker text-tv-xs mt-3">L'hôte lance la partie</p>
        </motion.div>
      )}

      {phase === 'ended' && <FinalPanel state={state} members={members} />}
    </div>
  )
}

function FinalPanel({ state, members }: { state: DiceClientState; members: Member[] }) {
  const ranked = ranking(state, members)
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.2 }}
      className="absolute rounded-sheet bg-ink/80 border border-line px-7 py-5 backdrop-blur-sm"
      style={{ left: 'var(--tv-gutter-x)', bottom: 'var(--tv-gutter-y)', minWidth: '26%' }}
    >
      <p className="kicker text-tv-xs mb-1">Le plus assoiffé</p>
      <p className="font-stage text-tv-2xl text-brass mb-4">{ranked[0]?.pseudo ?? '—'}</p>
      <div className="flex flex-col gap-2">
        {ranked.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3">
            <span className="text-tv-sm text-chalk-faint w-6">{i + 1}</span>
            <span className="text-tv-sm text-chalk flex-1 truncate">{m.pseudo}</span>
            <span className="text-tv-sm tabular-nums" style={{ color: '#f5a524' }}>
              {sips(state.totalSips[m.id] ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/** Écran de secours sans WebGL : le dé roule en 3D CSS au centre de la scène. */
function DiceFlatScreen({ state, phase, members }: { state: DiceClientState; phase: DiceTableState['phase']; members: Member[] }) {
  const { rolling } = useRollAnimation(state.lastRoll)
  const byId = (id: string | null | undefined) => members.find((m) => m.id === id)
  const last = state.lastRoll
  const roller = byId(last?.memberId)
  const current = byId(currentTurn(state, members))
  // Le total du lanceur n'avance qu'une fois le dé posé.
  const shownSips = (id: string) => (state.totalSips[id] ?? 0) - (rolling && last?.memberId === id ? last.value : 0)

  if (phase === 'ended') {
    const ranked = ranking(state, members)
    return (
      <div className="tv-frame text-center">
        <p className="kicker text-tv-sm mb-2">Lancer de dés — {state.rolls} lancers</p>
        <h1 className="font-stage text-tv-2xl text-brass mb-6">Santé !</h1>
        <div className="ranking-list">
          {ranked.map((m, i) => (
            <div key={m.id} className="flex items-center gap-4 rounded-2xl bg-white/5 border border-line px-6 py-3 w-[30rem]">
              <span className="text-xl font-bold w-8 text-chalk-soft">{i + 1}</span>
              <Player member={m} size="chip" showName={false} />
              <span className="flex-1 text-xl font-semibold text-left">{m.pseudo}</span>
              <span className="text-lg tabular-nums" style={{ color: '#f5a524' }}>
                {sips(state.totalSips[m.id] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="tv-frame text-center gap-6">
      {phase === 'intro' ? (
        <>
          <h1 className="font-stage text-tv-3xl text-chalk">Lancer de dés</h1>
          <p className="text-tv-lg text-chalk-muted max-w-3xl">Chacun son tour, lance le dé depuis ton téléphone. Ce que tu fais, tu le bois.</p>
          <CssDie value={6} rollKey={0} rolling={false} size={150} />
        </>
      ) : (
        <>
          <CssDie value={last?.value ?? 1} rollKey={last?.n ?? 0} rolling={rolling} size={170} glow={roller?.color} />
          <div className="h-24">
            {last && roller && !rolling ? (
              <motion.div key={last.n} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="font-stage text-tv-2xl text-chalk">
                  {roller.pseudo} boit <span style={{ color: '#f5a524' }}>{sips(last.value)}</span>
                </p>
                <p className="text-tv-base text-chalk-muted">{FLAVOR[last.value]}</p>
              </motion.div>
            ) : (
              current && <p className="font-stage text-tv-xl text-chalk">{rolling ? `${roller?.pseudo ?? ''} lance…` : `Au tour de ${current.pseudo}`}</p>
            )}
          </div>
        </>
      )}
      <div className="flex flex-wrap justify-center gap-4 max-w-5xl">
        {state.order.map((id) => {
          const m = byId(id)
          if (!m) return null
          return (
            <div key={id} className="flex flex-col items-center gap-1">
              <Player member={m} size="md" speaking={phase === 'turn' && id === current?.id && !rolling} />
              <span className="text-base tabular-nums" style={{ color: '#f5a524' }}>
                {shownSips(id)} 🍺
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
