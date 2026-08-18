import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../../../store/usePartyStore'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import {
  POKER_GLOSSARY,
  ACTION_LABELS,
  BETTING_ROUND_LABELS,
  RANK_LABELS,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  STRENGTH_EMOJI,
  STRENGTH_LABELS,
} from './types'
import type {
  PokerClientState,
  PokerCard,
} from './types'
import type { Member } from '../../../types'

export function PokerController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)

  if (!group || !currentMember) return null
  const { party } = group
  const state = party.roundData as PokerClientState | null

  if (party.status === 'ended') {
    return <FinalResults members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-chalk-soft text-sm">Préparation de la table…</p>
      </div>
    )
  }

  // Mode selection phase
  if (party.phase === 'mode-selection' && !state.modesChosen) {
    const hasChosen = state.playersWhoChoseMode.includes(currentMember.id)
    if (hasChosen) {
      return (
        <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">🃏</span>
            <p className="text-chalk-soft text-sm">En attente des autres joueurs…</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {group.members.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                    state.playersWhoChoseMode.includes(m.id)
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-felt-raised text-chalk-faint'
                  }`}
                >
                  <Avatar pseudo={m.pseudo} color={m.color} size={20} />
                  {state.playersWhoChoseMode.includes(m.id) ? '✓' : '…'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    return (
      <ModeSelection
        onChoose={(assisted) => sendAction('choose-mode', { assisted })}
      />
    )
  }

  // Host starts after mode selection
  if (party.phase === 'mode-selection-ready' || (party.phase === 'mode-selection' && state.modesChosen)) {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top justify-center">
        <div className="flex flex-col items-center gap-4 text-center mb-8">
          <span className="text-6xl">🃏</span>
          <h1 className="text-3xl font-extrabold shimmer-text">Poker Texas Hold'em</h1>
          <p className="text-chalk-soft text-sm max-w-xs">
            Tous les joueurs sont prêts ! {state.assistedMode ? 'Certains jouent en mode assisté.' : ''}
          </p>
        </div>
        {isHost ? (
          <Button fullWidth onClick={() => sendAction('start', {})}>
            Distribuer les cartes 🃏
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte lance la première main…</p>
        )}
      </div>
    )
  }

  // Showdown / ended phase
  if (state.phase === 'ended' && state.winner) {
    const winnerMember = group.members.find((m) => m.id === state.winner?.memberId)
    const isYou = state.winner.memberId === currentMember.id
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <div className="flex flex-col items-center gap-3 mb-6 mt-4">
          <span className="text-5xl">{isYou ? '🏆' : '🃏'}</span>
          <p className="text-xl font-bold text-center">
            {isYou ? 'Tu gagnes la main !' : `${winnerMember?.pseudo} gagne la main`}
          </p>
          <p className="text-chalk-soft text-sm text-center">{state.winner.handDescription}</p>
          <p className="text-emerald-300 font-mono text-lg font-bold">+{state.pot} jetons</p>
        </div>

        {/* Show winner's cards if you're the winner, or always in showdown */}
        {isYou && state.yourCards.length > 0 && (
          <div className="flex justify-center gap-2 mb-6">
            {state.yourCards.map((card) => (
              <CardVisual key={card.id} card={card} />
            ))}
          </div>
        )}

        {/* Chip counts */}
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-xs uppercase tracking-widest text-chalk-faint mb-1">Jetons</p>
          {group.members.map((m) => (
            <div
              key={m.id}
              className={`flex items-center gap-2.5 rounded-card p-2.5 ${
                state.winner?.memberId === m.id ? 'bg-emerald-500/10 border border-emerald-400/20' : 'bg-felt-raised'
              }`}
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={28} />
              <span className="flex-1 text-sm font-medium">{m.pseudo}</span>
              <span className="font-mono text-sm text-chalk-soft">{state.handCounts[m.id] ?? 0}</span>
            </div>
          ))}
        </div>

        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>
            Main suivante →
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte lance la main suivante…</p>
        )}
      </div>
    )
  }

  // Betting phase
  if (state.phase === 'betting') {
    return (
      <BettingView
        state={state}
        currentMember={currentMember}
        
        isHost={isHost}
        onAction={(type, payload) => sendAction(type, payload)}
      />
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Chargement…</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode Selection
// ---------------------------------------------------------------------------

function ModeSelection({ onChoose }: { onChoose: (assisted: boolean) => void }) {
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top justify-center">
      <div className="flex flex-col items-center gap-3 mb-8 text-center">
        <span className="text-6xl">🃏</span>
        <h1 className="text-3xl font-extrabold shimmer-text">Poker Texas Hold'em</h1>
        <p className="text-chalk-soft text-sm max-w-xs">
          Choisis ton mode de jeu. Tu peux changer d'avis à chaque main.
        </p>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <button
          onClick={() => onChoose(false)}
          className="rounded-2xl border border-line bg-felt-raised p-5 flex flex-col items-center gap-2 active:scale-95 transition-all"
        >
          <span className="text-4xl">♠️</span>
          <span className="font-bold text-lg">Mode Normal</span>
          <span className="text-chalk-soft text-xs text-center">
            Tu joues par toi-même, sans aide.
          </span>
        </button>

        <button
          onClick={() => onChoose(true)}
          className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 flex flex-col items-center gap-2 active:scale-95 transition-all"
        >
          <span className="text-4xl">💡</span>
          <span className="font-bold text-lg text-amber-200">Mode Assisté</span>
          <span className="text-chalk-soft text-xs text-center">
            Indicateur de force, suggestions, pot odds, outs et glossaire.
          </span>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Betting View
// ---------------------------------------------------------------------------

function BettingView({
  state,
  currentMember,
  isHost: _isHost,
  onAction,
}: {
  state: PokerClientState
  currentMember: Member
  isHost: boolean
  onAction: (type: string, payload: Record<string, unknown>) => void
}) {
  const [raiseAmount, setRaiseAmount] = useState(0)
  const [showRaise, setShowRaise] = useState(false)
  const [showGlossary, setShowGlossary] = useState(false)
  const [showOuts, setShowOuts] = useState(false)

  const isYourTurn = state.isYourTurn
  const isFolded = state.foldedPlayers.includes(currentMember.id)
  const isAllIn = state.yourChips === 0
  const toCall = Math.max(0, state.currentBet - state.yourBet)

  // Initialize raise amount when raise panel opens
  useEffect(() => {
    if (isYourTurn && showRaise && raiseAmount === 0) {
      setRaiseAmount(state.minRaise)
    }
  }, [isYourTurn, showRaise, raiseAmount, state.minRaise])

  // If folded or all-in, show waiting view
  if (isFolded || isAllIn) {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <PhaseIndicator state={state} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <span className="text-4xl">{isFolded ? '🪑' : '🃏'}</span>
          <p className="text-chalk-soft text-sm text-center">
            {isFolded ? 'Tu es couché pour cette main.' : 'Tu es à tapis !'}
          </p>
          <p className="text-chalk-faint text-xs text-center">
            En attente des autres joueurs…
          </p>
        </div>
        <CommunityCards cards={state.communityCards} />
        <PotDisplay pot={state.pot} />
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <PhaseIndicator state={state} />

      {/* Your hole cards */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <p className="text-xs uppercase tracking-widest text-chalk-faint">Tes cartes</p>
        <div className="flex gap-2.5">
          {state.yourCards.map((card) => (
            <CardVisual key={card.id} card={card} />
          ))}
        </div>
      </div>

      {/* Assisted mode: hand strength + suggestion */}
      {state.assistedMode && state.handStrength && (
        <Card className="mb-3 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-chalk-faint">Force de ta main</span>
            <span className="text-sm font-bold">
              {STRENGTH_EMOJI[state.handStrength.level]} {STRENGTH_LABELS[state.handStrength.level]}
            </span>
          </div>
          <p className="text-sm text-chalk-soft">{state.handStrength.description}</p>

          {state.suggestion && (
            <div className="mt-3 pt-3 border-t border-line">
              <p className="text-xs font-bold uppercase tracking-wider text-chalk-faint mb-1">💡 Suggestion</p>
              <p className="text-sm">
                <span className="font-bold text-amber-200">{ACTION_LABELS[state.suggestion.action] ?? state.suggestion.action}</span>
                <span className="text-chalk-soft"> — {state.suggestion.reason}</span>
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Assisted mode: pot odds */}
      {state.assistedMode && state.potOdds && (
        <Card className="mb-3 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-chalk-faint">Pot Odds</span>
            <span className="text-sm font-mono text-chalk-soft">
              Payer {state.potOdds.toCall} pour {state.potOdds.potSize} pot ({state.potOdds.ratio})
            </span>
          </div>
        </Card>
      )}

      {/* Assisted mode: outs */}
      {state.assistedMode && state.outs && (
        <Card className="mb-3 p-3">
          <button
            onClick={() => setShowOuts(!showOuts)}
            className="flex items-center justify-between w-full"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-chalk-faint">
              Outs {showOuts ? '▼' : '▶'}
            </span>
            <span className="text-sm text-chalk-soft">{state.outs.count} outs</span>
          </button>
          {showOuts && (
            <p className="text-sm text-chalk-soft mt-2">{state.outs.description}</p>
          )}
        </Card>
      )}

      {/* Community cards */}
      <CommunityCards cards={state.communityCards} />

      {/* Pot + your bet info */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <PotDisplay pot={state.pot} />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-chalk-faint">Tes jetons</span>
          <span className="font-mono font-bold text-sm">{state.yourChips}</span>
          {state.yourBet > 0 && (
            <span className="text-xs text-chalk-faint">Misé: {state.yourBet}</span>
          )}
        </div>
      </div>

      {/* Last action */}
      {state.lastAction && (
        <div className="mb-3 text-center">
          <p className="text-xs text-chalk-faint">
            {state.lastAction.playerName} {actionVerb(state.lastAction.action, state.lastAction.amount)}
          </p>
        </div>
      )}

      {/* Current player indicator */}
      {!isYourTurn && state.currentPlayer && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Avatar
            pseudo={state.currentPlayer.pseudo}
            color={state.currentPlayer.color}
            size={56}
          />
          <p className="text-chalk-soft text-sm text-center">
            {state.currentPlayer.pseudo} réfléchit…
          </p>
        </div>
      )}

      {/* Your turn: action buttons */}
      {isYourTurn && (
        <div className="mt-auto flex flex-col gap-2.5">
          {!showRaise ? (
            <>
              <div className="flex gap-2.5">
                {state.canCheck ? (
                  <Button className="flex-1" onClick={() => onAction('check', {})}>
                    ✓ {ACTION_LABELS.check}
                  </Button>
                ) : (
                  <Button className="flex-1" onClick={() => onAction('call', {})}>
                    📞 {ACTION_LABELS.call} {toCall}
                  </Button>
                )}
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() => {
                    setShowRaise(true)
                    setRaiseAmount(state.minRaise)
                  }}
                >
                  ⬆ {ACTION_LABELS.raise}
                </Button>
              </div>
              <div className="flex gap-2.5">
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() => onAction('fold', {})}
                >
                  🪑 {ACTION_LABELS.fold}
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() => onAction('all-in', {})}
                >
                  🃏 {ACTION_LABELS['all-in']} ({state.yourChips})
                </Button>
              </div>
            </>
          ) : (
            <RaiseControl
              minRaise={state.minRaise}
              maxRaise={state.yourBet + state.yourChips}
              currentChips={state.yourChips}
              raiseAmount={raiseAmount}
              setRaiseAmount={setRaiseAmount}
              onConfirm={() => {
                onAction('raise', { amount: raiseAmount })
                setShowRaise(false)
                setRaiseAmount(0)
              }}
              onCancel={() => {
                setShowRaise(false)
                setRaiseAmount(0)
              }}
            />
          )}
        </div>
      )}

      {/* Assisted mode: glossary button */}
      {state.assistedMode && (
        <button
          onClick={() => setShowGlossary(!showGlossary)}
          className="mt-3 mx-auto text-xs text-chalk-faint underline"
        >
          ❓ Glossaire
        </button>
      )}

      {/* Glossary modal */}
      {showGlossary && (
        <GlossaryModal onClose={() => setShowGlossary(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Raise Control
// ---------------------------------------------------------------------------

function RaiseControl({
  minRaise,
  maxRaise,
  currentChips: _currentChips,
  raiseAmount,
  setRaiseAmount,
  onConfirm,
  onCancel,
}: {
  minRaise: number
  maxRaise: number
  currentChips: number
  raiseAmount: number
  setRaiseAmount: (n: number) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const step = Math.max(10, Math.floor(minRaise / 2))
  const canConfirm = raiseAmount >= minRaise && raiseAmount <= maxRaise

  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-3">
        Relancer à
      </p>
      <p className="text-3xl font-extrabold text-center font-mono mb-4">{raiseAmount}</p>

      <input
        type="range"
        min={minRaise}
        max={maxRaise}
        step={step}
        value={raiseAmount}
        onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
        className="w-full mb-3 accent-amber-400"
      />

      <div className="flex justify-between text-xs text-chalk-faint mb-4">
        <span>Min: {minRaise}</span>
        <span>Max: {maxRaise}</span>
      </div>

      <div className="flex gap-2.5">
        <Button className="flex-1" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button className="flex-1" disabled={!canConfirm} onClick={onConfirm}>
          Confirmer {raiseAmount}
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PhaseIndicator({ state }: { state: PokerClientState }) {
  const phaseLabel = BETTING_ROUND_LABELS[state.bettingRound] ?? state.bettingRound
  const roundLabel = state.phase === 'betting' ? phaseLabel : state.phase

  return (
    <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">
      {roundLabel}
      {state.assistedMode && (
        <span className="ml-2 text-amber-300/60">· Mode Assisté</span>
      )}
    </p>
  )
}

function CardVisual({ card, size = 'md' }: { card: PokerCard; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-9 h-12 text-base rounded-md',
    md: 'w-12 h-16 text-xl rounded-lg',
    lg: 'w-16 h-22 text-2xl rounded-xl',
  }
  const className = sizeClasses[size]

  return (
    <div
      className={`${className} bg-white flex flex-col items-center justify-center font-bold leading-none shadow-lg border border-gray-300`}
      style={{ minHeight: size === 'lg' ? '5.5rem' : undefined }}
    >
      <span className={SUIT_COLORS[card.suit]}>{RANK_LABELS[card.rank]}</span>
      <span className={SUIT_COLORS[card.suit]}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

function CommunityCards({ cards }: { cards: PokerCard[] }) {
  if (cards.length === 0) return null
  return (
    <div className="flex flex-col items-center gap-1.5 mb-4">
      <p className="text-xs uppercase tracking-widest text-chalk-faint">Cartes communes</p>
      <div className="flex gap-1.5">
        {cards.map((card) => (
          <CardVisual key={card.id} card={card} />
        ))}
        {/* Placeholder for missing community cards */}
        {Array.from({ length: Math.max(0, 5 - cards.length) }).map((_, i) => (
          <div
            key={`placeholder-${i}`}
            className="w-9 h-12 rounded-md border border-dashed border-line bg-felt-raised opacity-30"
          />
        ))}
      </div>
    </div>
  )
}

function PotDisplay({ pot }: { pot: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-chalk-faint">Pot</span>
      <span className="font-mono font-bold text-base text-emerald-300">{pot}</span>
    </div>
  )
}

function GlossaryModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="max-w-sm w-full max-h-[80vh] overflow-y-auto p-5 rounded-card bg-felt-raised border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4 text-center">📖 Glossaire du Poker</h3>
        <div className="flex flex-col gap-3">
          {Object.entries(POKER_GLOSSARY).map(([term, def]) => (
            <div key={term}>
              <p className="text-sm font-bold text-amber-200 capitalize">{term.replace(/-/g, ' ')}</p>
              <p className="text-xs text-chalk-soft">{def}</p>
            </div>
          ))}
        </div>
        <Button fullWidth variant="secondary" onClick={onClose} className="mt-5">
          Fermer
        </Button>
      </div>
    </div>
  )
}

function FinalResults({ members, onExit }: { members: Member[]; onExit: () => void }) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <h2 className="text-2xl font-extrabold text-center mb-6">Partie terminée !</h2>
      <div className="flex flex-col gap-3 mb-6">
        {ranked.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3 rounded-card bg-felt-raised p-3">
            <span className="text-lg font-bold w-6 text-center">{i + 1}</span>
            <Avatar pseudo={m.pseudo} color={m.color} size={36} />
            <span className="flex-1 font-semibold">{m.pseudo}</span>
            <span className="text-emerald-300 font-mono text-sm">{m.xp} XP</span>
          </div>
        ))}
      </div>
      <Button fullWidth onClick={onExit}>Retour au salon</Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionVerb(action: string, amount: number): string {
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