import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { useSound } from '../../../hooks/useSound'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import type { UnoClientState, UnoCard } from './types'
import {
  COLOR_LABELS,
  COLOR_EMOJI,
  COLOR_CLASSES,
  VALUE_LABELS,
  PLAYABLE_COLORS,
} from './types'
import type { Member } from '../../../types'

export function UnoController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const sendAction = usePartyStore((s) => s.sendAction)
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const { play } = useSound()
  const lastPhase = useRef<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [chosenColor, setChosenColor] = useState<'red' | 'yellow' | 'green' | 'blue' | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const state = (group?.party.roundData as unknown as UnoClientState | null) ?? null

  useEffect(() => {
    const phase = state?.phase
    if (phase && phase !== lastPhase.current) {
      if (phase === 'ended') play('win')
      if (state?.lastEvent?.type === 'play') play('vote')
      lastPhase.current = phase
    }
  }, [state?.phase, state?.lastEvent, play])

  if (!group || !currentMember) return null
  const { party } = group

  if (party.status === 'ended' || state?.phase === 'ended') {
    const winner = state?.winner
    const winnerMember = winner ? group.members.find((m) => m.id === winner) : null
    return <FinalView winnerName={winnerMember?.pseudo ?? '???'} winnerColor={winnerMember?.color ?? '#fff'} members={group.members} onExit={() => navigate('/lobby')} />
  }

  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-chalk-soft text-sm">Préparation des cartes…</p>
      </div>
    )
  }

  // Intro: host starts
  if (party.phase === 'intro' || (!state.topCard && !state.myTurn)) {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top justify-center">
        <span className="text-6xl mb-4 block text-center">🃏</span>
        <h1 className="text-3xl font-extrabold shimmer-text text-center mb-6">UNO</h1>
        <div className="flex flex-col gap-2.5 text-sm text-chalk-muted mb-8 max-w-xs mx-auto text-center">
          <p>Pose une carte qui match la <b>couleur</b> ou la <b>valeur</b> de la défausse.</p>
          <p>Quand il te reste <b>1 carte</b>, appuie vite sur <b>UNO !</b></p>
          <p>Premier à vider sa main <b>gagne</b> 🎉</p>
          <p>🎨 Joker = change la couleur · +4 Joker = couleur + 4 cartes au suivant</p>
        </div>
        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>
            Lancer la partie 🃏
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte va lancer la partie…</p>
        )}
      </div>
    )
  }

  const handlePlayCard = (card: UnoCard) => {
    if (card.color === 'wild') {
      setSelectedCardId(card.id)
      setShowColorPicker(true)
      return
    }
    sendAction('play-card', { cardId: card.id })
    setSelectedCardId(null)
  }

  const handleConfirmWild = () => {
    if (selectedCardId && chosenColor) {
      sendAction('play-card', { cardId: selectedCardId, chosenColor })
      setSelectedCardId(null)
      setShowColorPicker(false)
      setChosenColor(null)
    }
  }

  const handleDraw = () => {
    sendAction('draw-card', {})
    setSelectedCardId(null)
  }

  const handleCallUno = () => {
    sendAction('call-uno', {})
    play('vote')
  }

  return (
    <div className="min-h-svh flex flex-col px-4 pt-[4.5rem] pb-4 safe-top">
      {/* ─── Header: tour actuel + sens ─── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {state.currentPlayer && (
            <>
              <Avatar
                pseudo={state.currentPlayer.pseudo}
                color={state.currentPlayer.color}
                size={32}
              />
              <span className="text-sm font-semibold text-chalk">
                {state.myTurn ? 'À toi !' : state.currentPlayer.pseudo}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-chalk-faint">
          <span className={state.direction === 1 ? 'rotate-0' : 'rotate-180'}>↻</span>
          <span>{state.direction === 1 ? 'Horaire' : 'Anti-horaire'}</span>
        </div>
      </div>

      {/* ─── Carte sur la défausse + couleur active ─── */}
      <div className="flex items-center justify-center gap-4 mb-3">
        {state.topCard && (
          <CardBadge card={state.topCard} currentColor={state.currentColor} />
        )}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-chalk-faint uppercase tracking-wider">Couleur</span>
          <div className={`w-8 h-8 rounded-full ${COLOR_CLASSES[state.currentColor]} shadow-lg`} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-chalk-faint uppercase tracking-wider">Pioche</span>
          <div className="w-12 h-16 rounded-lg bg-felt-raised border border-line flex items-center justify-center text-xs text-chalk-faint">
            {state.deckCount}
          </div>
        </div>
      </div>

      {/* ─── Joueurs + compte de cartes ─── */}
      <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
        {Object.entries(state.handCounts).map(([pid, count]) => {
          const member = group.members.find((m) => m.id === pid)
          if (!member) return null
          const isCurrent = state.currentPlayer?.memberId === pid
          const calledUno = count === 1
          return (
            <div
              key={pid}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 border whitespace-nowrap transition-all ${
                isCurrent
                  ? 'border-fuchsia-400/50 bg-fuchsia-500/10'
                  : 'border-line bg-felt-raised'
              }`}
            >
              <Avatar pseudo={member.pseudo} color={member.color} size={20} />
              <span className="text-xs font-medium text-chalk-soft">{member.pseudo}</span>
              <span className={`text-xs font-bold ${calledUno ? 'text-amber-300' : 'text-chalk-faint'}`}>
                {calledUno ? 'UNO!' : `${count}🂠`}
              </span>
            </div>
          )
        })}
      </div>

      {/* ─── Bouton UNO ! ─── */}
      <AnimatePresence>
        {state.mustCallUno && !state.unoCalled && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mb-3"
          >
            <Button
              fullWidth
              onClick={handleCallUno}
              className="bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 text-white font-extrabold text-lg animate-pulse"
            >
              🗨️ UNO !
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main du joueur (scrollable horizontal) ─── */}
      <div className="flex-1 flex flex-col justify-end">
        <p className="text-xs text-chalk-faint uppercase tracking-wider mb-2 text-center">
          Ta main ({state.hand.length} cartes)
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 px-1 snap-x">
          {state.hand.length === 0 ? (
            <p className="text-chalk-faint text-sm w-full text-center py-8">Main vide…</p>
          ) : (
            state.hand.map((card, index) => {
              const playable = state.myTurn && canPlayCardClient(card, state.topCard, state.currentColor)
              const isSelected = selectedCardId === card.id
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-shrink-0 snap-center"
                  style={{ zIndex: isSelected ? 10 : 1 }}
                >
                  <CardTile
                    card={card}
                    playable={playable}
                    selected={isSelected}
                    onClick={() => playable && handlePlayCard(card)}
                    index={index}
                  />
                </motion.div>
              )
            })
          )}
        </div>

        {/* ─── Bouton piocher ─── */}
        {state.myTurn && (
          <div className="mt-3">
            <Button
              fullWidth
              variant="secondary"
              onClick={handleDraw}
            >
              🃏 Piocher une carte
            </Button>
            {!state.canPlay && (
              <p className="text-center text-xs text-chalk-faint mt-2">
                Aucune carte jouable — pioche !
              </p>
            )}
          </div>
        )}

        {!state.myTurn && state.phase === 'playing' && (
          <p className="text-center text-chalk-faint text-sm mt-3">
            En attente de {state.currentPlayer?.pseudo}…
          </p>
        )}
      </div>

      {/* ─── Color picker modal (pour jokers) ─── */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6"
            onClick={() => setShowColorPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-felt-raised rounded-card border border-line p-6 max-w-xs w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-center text-lg font-bold mb-4">Choisis une couleur</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {PLAYABLE_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setChosenColor(color)}
                    className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                      chosenColor === color
                        ? 'border-white scale-105'
                        : 'border-transparent opacity-70'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full ${COLOR_CLASSES[color]}`} />
                    <span className="text-sm font-medium">{COLOR_EMOJI[color]} {COLOR_LABELS[color]}</span>
                  </button>
                ))}
              </div>
              <Button fullWidth onClick={handleConfirmWild} disabled={!chosenColor}>
                Confirmer
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Sous-composants ─────────────────────────────────────

function canPlayCardClient(
  card: UnoCard,
  topCard: UnoCard | null,
  currentColor: string,
): boolean {
  if (!topCard) return false
  if (card.color === 'wild') return true
  if (card.color === currentColor) return true
  if (card.value === topCard.value) return true
  return false
}

function CardTile({
  card,
  playable,
  selected,
  onClick,
  index,
}: {
  card: UnoCard
  playable: boolean
  selected: boolean
  onClick: () => void
  index: number
}) {
  const isWild = card.color === 'wild'
  const bgClass = COLOR_CLASSES[card.color] ?? COLOR_CLASSES.wild
  const displayValue = typeof card.value === 'number' ? String(card.value) : (VALUE_LABELS[card.value] ?? '?')

  return (
    <button
      onClick={onClick}
      disabled={!playable}
      className={`relative w-16 h-24 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
        bgClass
      } ${
        playable
          ? 'cursor-pointer hover:scale-110 hover:-translate-y-2 active:scale-95 border-white/60 shadow-lg'
          : 'opacity-50 border-line'
      } ${selected ? '-translate-y-4 scale-110 shadow-2xl' : ''}`}
      style={{ marginLeft: index > 0 ? '-8px' : '0' }}
    >
      <span className="text-2xl font-extrabold text-white drop-shadow-md leading-none">
        {displayValue}
      </span>
      <span className="absolute top-1 left-1 text-xs font-bold text-white/80">
        {displayValue}
      </span>
      <span className="absolute bottom-1 right-1 text-xs font-bold text-white/80 rotate-180">
        {displayValue}
      </span>
      {isWild && (
        <span className="absolute inset-0 rounded-xl border-2 border-white/40" />
      )}
    </button>
  )
}

function CardBadge({ card, currentColor: _currentColor }: { card: UnoCard; currentColor: string }) {
  const bgClass = COLOR_CLASSES[card.color] ?? COLOR_CLASSES.wild
  const displayValue = typeof card.value === 'number' ? String(card.value) : (VALUE_LABELS[card.value] ?? '?')

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-chalk-faint uppercase tracking-wider">Défausse</span>
      <div className={`w-16 h-24 rounded-xl border-2 border-white/40 flex flex-col items-center justify-center ${bgClass} shadow-xl`}>
        <span className="text-3xl font-extrabold text-white drop-shadow-md leading-none">
          {displayValue}
        </span>
      </div>
    </div>
  )
}

function FinalView({
  winnerName,
  winnerColor,
  members,
  onExit,
}: {
  winnerName: string
  winnerColor: string
  members: Member[]
  onExit: () => void
}) {
  const ranked = [...members].sort((a, b) => b.xp - a.xp)
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center mb-6"
      >
        <span className="text-6xl block mb-3">🎉</span>
        <h2 className="text-2xl font-extrabold shimmer-text mb-2">Victoire !</h2>
        <div className="flex items-center justify-center gap-2">
          <Avatar pseudo={winnerName} color={winnerColor} size={48} />
          <span className="text-xl font-bold">{winnerName}</span>
        </div>
        <p className="text-chalk-soft text-sm mt-2">a gagné la partie d'UNO !</p>
      </motion.div>

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