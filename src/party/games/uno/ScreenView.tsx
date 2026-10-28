import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Player } from '../../../components/Player'
import { TvViewport } from '../../primitives/TvViewport'
import { UnoFlatScreen } from './FlatScreen'
import { COLOR_LABELS, type UnoClientState } from './types'
import { UNO_HEX } from './three/cardFaces'
import type { TableMember, TableState, UnoTable } from './three/table'
import type { Member } from '../../../types'

/**
 * UNO sur la TV : la table en 3D temps réel.
 *
 * La scène three.js (`three/table.ts`) occupe tout l'écran ; par-dessus, un habillage minimal à
 * l'échelle de scène : à qui c'est le tour, la couleur demandée, le sens, et les moments forts
 * (joueur exposé sans UNO, classement final). Si la TV ne sait pas faire de WebGL, on bascule sur
 * l'ancien écran 2D plutôt que d'afficher un écran noir.
 */
export function UnoScreen() {
  const group = usePartyStore((s) => s.group)
  const [flat, setFlat] = useState(false)
  const state = (group?.party.roundData ?? null) as UnoClientState | null

  if (!group || !state) return null
  if (flat) {
    return (
      <TvViewport>
        <UnoFlatScreen />
      </TvViewport>
    )
  }
  return <Uno3D state={state} members={group.members} onUnsupported={() => setFlat(true)} />
}

function toTableState(s: UnoClientState): TableState {
  return {
    phase: s.phase,
    order: s.order,
    handCounts: s.handCounts,
    currentId: s.currentPlayer?.memberId ?? null,
    direction: s.direction,
    currentColor: s.currentColor,
    deckCount: s.deckCount,
    discards: s.recentDiscards ?? (s.topCard ? [{ ...s.topCard, chosenColor: s.topCard.color === 'wild' ? s.currentColor : null }] : []),
    lastEvent: s.lastEvent,
    unoSafeIds: s.unoSafeIds ?? [],
    exposed: s.exposed ?? null,
    winner: s.winner,
  }
}

function Uno3D({ state, members, onUnsupported }: { state: UnoClientState; members: Member[]; onUnsupported: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const table = useRef<UnoTable | null>(null)
  const latest = useRef({ state, members })
  latest.current = { state, members }
  const { play } = useSound()
  const playRef = useRef(play)
  playRef.current = play
  const [ready, setReady] = useState(false)

  const tableMembers: TableMember[] = useMemo(
    () => members.map((m) => ({ id: m.id, pseudo: m.pseudo, color: m.color, photoUrl: m.photoUrl })),
    [members],
  )

  // Montage de la scène (une fois) — chargée à la demande avec three.js.
  useEffect(() => {
    let cancelled = false
    let instance: UnoTable | null = null
    void import('./three/table')
      .then(({ UnoTable }) => UnoTable.create(host.current!, (s) => playRef.current(s)))
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
        console.error('UNO 3D indisponible, repli en 2D :', error)
        if (!cancelled) onUnsupported()
      })
    return () => {
      cancelled = true
      instance?.dispose()
      table.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Chaque nouvel instantané est transmis à la scène, qui en déduit ses animations.
  useEffect(() => {
    if (!ready || !table.current) return
    if (table.current.fatal) {
      onUnsupported()
      return
    }
    table.current.sync(toTableState(state), tableMembers)
  }, [ready, state, tableMembers, onUnsupported])

  return (
    <div className="fixed inset-0 bg-[#09070d]">
      <div ref={host} className="absolute inset-0" />
      <Hud state={state} members={members} />
    </div>
  )
}

function Hud({ state, members }: { state: UnoClientState; members: Member[] }) {
  const byId = (id: string | null | undefined) => members.find((m) => m.id === id)
  const current = byId(state.currentPlayer?.memberId)
  const exposed = byId(state.exposed)
  const winner = byId(state.winner)
  const colorHex = UNO_HEX[state.currentColor]

  return (
    <div className="pointer-events-none absolute inset-0" style={{ padding: 'var(--tv-gutter-y) var(--tv-gutter-x)', paddingTop: 'var(--tv-gutter-top)' }}>
      {/* Bandeau haut : le tour, la couleur, le sens. */}
      {state.phase === 'playing' && (
        <div className="flex items-start justify-between">
          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="flex items-center gap-4 rounded-sheet bg-ink/70 border border-line px-5 py-3 backdrop-blur-sm"
              >
                <Player member={current} size="focus" showName={false} speaking />
                <div>
                  <p className="kicker text-tv-xs">Au tour de</p>
                  <p className="font-stage text-tv-xl text-chalk leading-none">{current.pseudo}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-4 rounded-sheet bg-ink/70 border border-line px-5 py-3 backdrop-blur-sm">
            <motion.span
              key={state.currentColor}
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 16 }}
              className="rounded-full"
              style={{ width: 'calc(5 * var(--tv-unit))', height: 'calc(5 * var(--tv-unit))', background: colorHex, boxShadow: `0 0 calc(3 * var(--tv-unit)) ${colorHex}` }}
            />
            <div>
              <p className="kicker text-tv-xs">Couleur</p>
              <p className="font-stage text-tv-lg leading-none" style={{ color: colorHex }}>
                {COLOR_LABELS[state.currentColor]}
              </p>
            </div>
            <div className="w-px self-stretch bg-line mx-1" />
            <div className="text-center">
              <p className="kicker text-tv-xs">Sens</p>
              <motion.p
                animate={{ rotate: state.direction === 1 ? 0 : 180, scaleX: state.direction === 1 ? 1 : -1 }}
                className="text-tv-xl text-chalk leading-none"
              >
                ↻
              </motion.p>
            </div>
          </div>
        </div>
      )}

      {/* Joueur à une carte qui n'a pas annoncé : la course au Contre-UNO. */}
      <AnimatePresence>
        {state.phase === 'playing' && exposed && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute left-1/2 -translate-x-1/2 rounded-sheet border-2 px-8 py-4 text-center"
            style={{ bottom: 'calc(var(--tv-gutter-y) * 2.2)', borderColor: UNO_HEX.red, background: 'rgba(229,50,45,0.18)' }}
          >
            <p className="font-stage text-tv-xl" style={{ color: UNO_HEX.red }}>
              {exposed.pseudo} n'a pas dit UNO !
            </p>
            <p className="text-tv-base text-chalk-muted">Vite — « Contre-UNO » sur vos téléphones</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Règles pendant la distribution. */}
      {state.phase === 'intro' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="absolute rounded-sheet bg-ink/75 border border-line px-7 py-5 backdrop-blur-sm"
          style={{ left: 'var(--tv-gutter-x)', top: 'var(--tv-gutter-top)', maxWidth: '30%' }}
        >
          <p className="font-stage text-tv-2xl text-chalk mb-2">UNO</p>
          <p className="text-tv-base text-chalk-muted">
            Même couleur ou même valeur. Avant ta dernière carte, annonce <b className="text-chalk">UNO</b> — sinon les autres te font piocher.
          </p>
          <p className="kicker text-tv-xs mt-3">L'hôte lance la partie</p>
        </motion.div>
      )}

      {/* Fin : classement par cartes restantes. */}
      {state.phase === 'ended' && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.6 }}
          className="absolute rounded-sheet bg-ink/80 border border-line px-7 py-5 backdrop-blur-sm"
          style={{ left: 'var(--tv-gutter-x)', bottom: 'var(--tv-gutter-y)', minWidth: '24%' }}
        >
          <p className="kicker text-tv-xs mb-1">Victoire</p>
          <p className="font-stage text-tv-2xl text-brass mb-4">{winner?.pseudo ?? '—'}</p>
          <div className="flex flex-col gap-2">
            {(state.ranking ?? []).map((r, i) => {
              const m = byId(r.memberId)
              if (!m) return null
              return (
                <div key={r.memberId} className="flex items-center gap-3">
                  <span className="text-tv-sm text-chalk-faint w-6">{i + 1}</span>
                  <span className="text-tv-sm text-chalk flex-1 truncate">{m.pseudo}</span>
                  <span className="text-tv-sm text-chalk-muted tabular-nums">
                    {r.cardsLeft} carte{r.cardsLeft > 1 ? 's' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
