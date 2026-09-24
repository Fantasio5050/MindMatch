import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { Avatar } from '../../../components/Avatar'
import {
  RANK_LABELS,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  BETTING_ROUND_LABELS,
} from './types'
import type {
  PokerClientState,
  PokerCard,
} from './types'
import type { Member } from '../../../types'

export function PokerScreen() {
  const group = usePartyStore((s) => s.group)

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-xl">Connexion à la table…</p>
      </div>
    )
  }

  const { party, members } = group
  const state = party.roundData as PokerClientState | null

  return (
    <div className="tv-frame">
      {party.status === 'ended' && <FinalPodium state={state} members={members} />}

      {party.status !== 'ended' && party.phase === 'mode-selection' && state && (
        <ModeSelectionScreen state={state} members={members} />
      )}

      {party.status !== 'ended' && party.phase === 'mode-selection-ready' && state && (
        <ReadyScreen members={members} />
      )}

      {party.status !== 'ended' && state && state.phase === 'betting' && (
        <BettingScreen state={state} members={members} />
      )}

      {party.status !== 'ended' && state && state.phase === 'ended' && state.winner && (
        <ShowdownScreen state={state} members={members} />
      )}

      {party.status !== 'ended' && !state && (
        <p className="text-chalk-faint text-2xl">Préparation de la table…</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode Selection Screen
// ---------------------------------------------------------------------------

function ModeSelectionScreen({ state, members }: { state: PokerClientState; members: Member[] }) {
  const chosen = state.playersWhoChoseMode.length
  const total = members.length

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="mode-selection"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-4xl"
      >
        <span className="text-7xl mb-6 block">🃏</span>
        <h1 className="text-5xl font-extrabold shimmer-text mb-4">Poker Texas Hold'em</h1>
        <p className="text-2xl text-chalk-soft mb-8">Choisissez votre mode de jeu</p>

        <div className="flex justify-center gap-8 mb-8">
          <div className="rounded-2xl border border-line bg-felt-raised p-6 flex flex-col items-center gap-3 max-w-xs">
            <span className="text-5xl">♠️</span>
            <span className="text-2xl font-bold">Mode Normal</span>
            <span className="text-sm text-chalk-soft">Joue par toi-même</span>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 flex flex-col items-center gap-3 max-w-xs">
            <span className="text-5xl">💡</span>
            <span className="text-2xl font-bold text-amber-200">Mode Assisté</span>
            <span className="text-sm text-chalk-soft">Aide, suggestions, pot odds</span>
          </div>
        </div>

        <p className="text-xl text-chalk-faint mb-4">
          {chosen} / {total} joueurs prêts
        </p>

        <div className="flex flex-wrap gap-3 justify-center max-w-2xl mx-auto">
          {members.map((m) => {
            const hasChosen = state.playersWhoChoseMode.includes(m.id)
            return (
              <div
                key={m.id}
                className={`flex items-center gap-2 rounded-full px-4 py-2 ${
                  hasChosen ? 'bg-emerald-500/15' : 'bg-felt-raised'
                }`}
              >
                <Avatar pseudo={m.pseudo} color={m.color} size={32} photoUrl={m.photoUrl} />
                <span className="text-sm font-medium">{m.pseudo}</span>
                <span className={hasChosen ? 'text-emerald-300' : 'text-chalk-faint'}>
                  {hasChosen ? '✓' : '…'}
                </span>
              </div>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function ReadyScreen({ members }: { members: Member[] }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="ready"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-4xl"
      >
        <span className="text-7xl mb-6 block">🃏</span>
        <h1 className="text-5xl font-extrabold shimmer-text mb-4">Tout le monde est prêt !</h1>
        <p className="text-2xl text-chalk-soft mb-8">L'hôte va distribuer les cartes…</p>
        <div className="flex flex-wrap gap-3 justify-center max-w-2xl mx-auto">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-full px-4 py-2 bg-felt-raised">
              <Avatar pseudo={m.pseudo} color={m.color} size={32} photoUrl={m.photoUrl} />
              <span className="text-sm font-medium">{m.pseudo}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Betting Screen
// ---------------------------------------------------------------------------

function BettingScreen({ state, members }: { state: PokerClientState; members: Member[] }) {
  const roundLabel = BETTING_ROUND_LABELS[state.bettingRound] ?? state.bettingRound
  const currentPlayer = state.currentPlayer
    ? members.find((m) => m.id === state.currentPlayer!.memberId)
    : null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`bet-${state.bettingRound}-${state.pot}`}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center max-w-5xl w-full"
      >
        {/* Phase indicator */}
        <p className="text-xl text-chalk-faint uppercase tracking-widest mb-6">
          {roundLabel}
        </p>

        {/* Pot */}
        <div className="flex flex-col items-center gap-1 mb-8">
          <span className="text-sm text-chalk-faint uppercase tracking-widest">Pot</span>
          <motion.span
            key={state.pot}
            initial={{ scale: 1.2, color: '#fbbf24' }}
            animate={{ scale: 1, color: '#6ee7b7' }}
            className="text-5xl font-extrabold font-mono text-emerald-300"
          >
            {state.pot}
          </motion.span>
        </div>

        {/* Community cards */}
        <div className="flex gap-3 mb-8">
          {Array.from({ length: 5 }).map((_, i) => {
            const card = state.communityCards[i]
            if (card) {
              return <TvCard key={card.id} card={card} />
            }
            return (
              <div
                key={`placeholder-${i}`}
                className="w-16 h-24 rounded-xl border-2 border-dashed border-line bg-felt-raised opacity-30"
              />
            )
          })}
        </div>

        {/* Players grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full mb-6">
          {members.map((m) => (
            <PlayerSlot
              key={m.id}
              member={m}
              state={state}
              isCurrentPlayer={state.currentPlayer?.memberId === m.id}
            />
          ))}
        </div>

        {/* Current player + last action */}
        <div className="flex flex-col items-center gap-3">
          {currentPlayer && (
            <motion.div
              key={currentPlayer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-felt-raised rounded-full px-5 py-2.5"
            >
              <Avatar
                pseudo={currentPlayer.pseudo}
                color={currentPlayer.color}
                size={36}
                photoUrl={currentPlayer.photoUrl}
              />
              <span className="text-xl font-bold">{currentPlayer.pseudo}</span>
              <span className="text-amber-300 text-sm animate-pulse">réfléchit…</span>
            </motion.div>
          )}

          {state.lastAction && (
            <motion.p
              key={`${state.lastAction.playerId}-${state.lastAction.action}-${state.lastAction.amount}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg text-chalk-soft"
            >
              {state.lastAction.playerName}{' '}
              <span className="font-bold text-chalk">
                {actionVerbScreen(state.lastAction.action, state.lastAction.amount)}
              </span>
            </motion.p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Player Slot
// ---------------------------------------------------------------------------

function PlayerSlot({
  member,
  state,
  isCurrentPlayer,
}: {
  member: Member
  state: PokerClientState
  isCurrentPlayer: boolean
}) {
  const isFolded = state.foldedPlayers.includes(member.id)
  const chips = state.handCounts[member.id] ?? 0
  const isWinner = state.winner?.memberId === member.id

  return (
    <motion.div
      animate={{
        opacity: isFolded ? 0.4 : 1,
        scale: isCurrentPlayer ? 1.05 : 1,
      }}
      className={`flex flex-col items-center gap-2 rounded-2xl p-4 transition-all ${
        isCurrentPlayer
          ? 'bg-amber-500/10 border-2 border-amber-400/40'
          : isWinner
            ? 'bg-emerald-500/10 border-2 border-emerald-400/30'
            : 'bg-felt-raised border border-line'
      }`}
    >
      <Avatar
        pseudo={member.pseudo}
        color={member.color}
        size={48}
        photoUrl={member.photoUrl}
      />
      <span className="text-sm font-bold truncate max-w-full">{member.pseudo}</span>

      {isFolded ? (
        <span className="text-xs text-chalk-faint">🪑 Couché</span>
      ) : (
        <span className="text-xs font-mono text-chalk-soft">{chips} jetons</span>
      )}

      {/* Assisted mode indicator */}
      {state.assistedMode && member.id === state.currentPlayer?.memberId && (
        <span className="text-xs text-amber-300/60">💡 Assisté</span>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// TV Card
// ---------------------------------------------------------------------------

function TvCard({ card }: { card: PokerCard }) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: 180, scale: 0.8 }}
      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-16 h-24 rounded-xl bg-white flex flex-col items-center justify-center font-bold leading-none shadow-xl border border-gray-300"
    >
      <span className={`text-2xl ${SUIT_COLORS[card.suit]}`}>{RANK_LABELS[card.rank]}</span>
      <span className={`text-xl ${SUIT_COLORS[card.suit]}`}>{SUIT_SYMBOLS[card.suit]}</span>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Showdown Screen
// ---------------------------------------------------------------------------

function ShowdownScreen({ state, members }: { state: PokerClientState; members: Member[] }) {
  const winner = state.winner
    ? members.find((m) => m.id === state.winner!.memberId)
    : null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`showdown-${state.winner?.memberId}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-4xl"
      >
        <p className="kicker text-tv-xs mb-3">Abattage · main n° {state.handNumber}</p>

        <p className="text-3xl font-extrabold shimmer-text mb-2">
          {state.winners.length > 1 ? 'Pot partagé' : `${winner?.pseudo} ramasse le pot`}
        </p>

        {state.winners.map((w) => (
          <p key={w.memberId} className="text-xl text-chalk-soft mb-1">
            {members.find((m) => m.id === w.memberId)?.pseudo} · +{w.amount} · {w.handDescription}
          </p>
        ))}

        <motion.p
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring' }}
          className="text-4xl font-extrabold font-mono text-jade mb-5"
        >
          +{state.pot}
        </motion.p>

        {/* Community cards */}
        {state.communityCards.length > 0 && (
          <div className="flex gap-3 justify-center mb-5">
            {state.communityCards.map((card) => (
              <TvCard key={card.id} card={card} />
            ))}
          </div>
        )}

        {Object.keys(state.revealedHands).length > 0 && (
          <div className="flex flex-wrap justify-center gap-6 mb-5">
            {Object.entries(state.revealedHands).map(([id, r]) => {
              const m = members.find((x) => x.id === id)
              const won = state.winners.some((w) => w.memberId === id)
              return (
                <div key={id} className={`flex flex-col items-center gap-2 rounded-2xl p-3 ${won ? 'bg-brass/10 border border-brass/40' : 'bg-felt-raised'}`}>
                  <span className="text-base font-bold text-chalk">{m?.pseudo}</span>
                  <div className="flex gap-2">
                    {r.cards.map((c) => <TvCard key={c.id} card={c} />)}
                  </div>
                  <span className="text-sm text-chalk-soft">{r.handDescription}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Chip counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {members.filter((m) => state.seats.includes(m.id)).map((m) => (
            <div
              key={m.id}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 ${
                state.winners.some((w) => w.memberId === m.id)
                  ? 'bg-emerald-500/10 border border-emerald-400/30'
                  : 'bg-felt-raised'
              }`}
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={36} photoUrl={m.photoUrl} />
              <span className="text-sm font-bold truncate max-w-full">{m.pseudo}</span>
              <span className="text-xs font-mono text-chalk-soft">
                {state.handCounts[m.id] ?? 0} jetons
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Final Podium
// ---------------------------------------------------------------------------

function FinalPodium({ state, members }: { state: PokerClientState | null; members: Member[] }) {
  const counts = state?.handCounts ?? {}
  const ranked = (state?.seats ?? members.map((m) => m.id))
    .map((id) => ({ member: members.find((m) => m.id === id), chips: counts[id] ?? 0 }))
    .filter((r): r is { member: Member; chips: number } => !!r.member)
    .sort((a, b) => b.chips - a.chips)
  const winner = ranked[0]?.member

  return (
    <div className="text-center max-w-4xl">
      <p className="kicker text-tv-xs mb-3">Champion de la table</p>
      <p className="font-stage text-tv-2xl text-brass mb-8">{winner?.pseudo}</p>

      <div className="flex flex-col gap-3 max-w-md mx-auto">
        {ranked.map(({ member: m, chips }, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className={`flex items-center gap-3 rounded-2xl p-4 ${
              i === 0 ? 'bg-brass/10 border border-brass/40' : 'bg-felt-raised'
            }`}
          >
            <span className="text-2xl font-bold w-10 text-center text-chalk-soft">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={40} photoUrl={m.photoUrl} />
            <span className="flex-1 text-lg font-bold text-left">{m.pseudo}</span>
            <span className="font-mono text-lg text-chalk-soft">{chips} jetons</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionVerbScreen(action: string, amount: number): string {
  switch (action) {
    case 'check':
      return 'a checké'
    case 'call':
      return `a suivi (${amount})`
    case 'raise':
      return `a relancé à ${amount}`
    case 'fold':
      return 's\'est couché'
    case 'all-in':
      return `fait tapis (${amount})`
    default:
      return action
  }
}