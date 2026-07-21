import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { useAppStore } from '../store/useAppStore'
import { usePartyStore } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { levelProgress } from '../lib/xp'
import { BADGE_MAP } from '../data/badges'
import { apiGetGameHistory, apiUpdatePhoto, ApiError } from '../lib/api'
import { compressImage } from '../lib/compressImage'
import { GAME_META } from '../data/gameMeta'
import { GAME_LIBRARY, type GameLibraryEntry } from '../data/gameLibrary'
import { QUIZ_LEVELS } from '../data/quizLevels'
import type { Group, GameHistoryEntry } from '../types'

type PackChoice = 'classic' | 'trash' | 'mixed'

function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

export function LobbyPage() {
  const navigate = useNavigate()
  const identity = useAppStore((s) => s.identity)
  const appGroup = useAppStore((s) => s.currentGroup())
  const refreshGroup = useAppStore((s) => s.refreshGroup)

  const connectAsPlayer = usePartyStore((s) => s.connectAsPlayer)
  const startGame = usePartyStore((s) => s.startGame)
  const setAdultMode = usePartyStore((s) => s.setAdultMode)
  const disconnect = usePartyStore((s) => s.disconnect)
  const kickMember = usePartyStore((s) => s.kickMember)
  const partyGroup = usePartyStore((s) => s.group)
  const onlinePlayerIds = usePartyStore((s) => s.onlinePlayerIds)
  const isHost = usePartyStore((s) => s.isHost())
  const partyError = usePartyStore((s) => s.error)
  const clearError = usePartyStore((s) => s.clearError)
  const leaveGroup = useAppStore((s) => s.leaveGroup)

  const [copied, setCopied] = useState(false)
  const [confirmingAdultMode, setConfirmingAdultMode] = useState(false)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [confirmingKickId, setConfirmingKickId] = useState<string | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [dilemmaPack, setDilemmaPack] = useState<PackChoice>('classic')
  const [partyCardsPack, setPartyCardsPack] = useState<PackChoice>('classic')
  const [autorouteCycles, setAutorouteCycles] = useState(3)
  const [crayonRounds, setCrayonRounds] = useState(3)
  const [crayonWords, setCrayonWords] = useState('')
  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const { play } = useSound()
  const prevMemberCount = useRef<number | null>(null)

  useEffect(() => {
    if (!identity) return
    refreshGroup()
    connectAsPlayer()
  }, [identity, refreshGroup, connectAsPlayer])

  useEffect(() => {
    if (partyGroup?.party.status === 'playing') {
      play('start')
      navigate('/play')
    }
  }, [partyGroup?.party.status, navigate, play])

  // Little chime whenever someone new walks into the room.
  const memberCount = partyGroup?.members.length ?? null
  useEffect(() => {
    if (memberCount !== null && prevMemberCount.current !== null && memberCount > prevMemberCount.current) {
      play('join')
    }
    prevMemberCount.current = memberCount
  }, [memberCount, play])

  useEffect(() => {
    if (!identity) return
    apiGetGameHistory(identity.groupId, identity.memberId, identity.memberToken)
      .then(setHistory)
      .catch(() => {})
  }, [identity, partyGroup?.party.status])

  const group = partyGroup ?? appGroup
  if (!identity || !group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-sm">Chargement de la salle…</p>
      </div>
    )
  }

  const me = group.members.find((m) => m.id === identity.memberId)
  const quizDone = !!me?.scores
  const finishedCount = group.members.filter((m) => m.scores !== null).length
  const adultMode = group.adultModeEnabled

  /** Raison pour laquelle le jeu ne peut pas se lancer (null = jouable). */
  const requirementFor = (e: GameLibraryEntry): string | null => {
    if (group.members.length < e.minPlayers) return `Il faut au moins ${e.minPlayers} joueurs`
    if (e.quizFinishedNeed && finishedCount < e.quizFinishedNeed) {
      return e.quizFinishedNeed === 1
        ? 'Il faut 1 joueur ayant fini le test'
        : `Il faut ${e.quizFinishedNeed} joueurs ayant fini le test`
    }
    return null
  }

  const launchGame = (e: GameLibraryEntry) => {
    if (e.config === 'pack') {
      startGame(e.id, { pack: e.id === 'dilemmas' ? dilemmaPack : partyCardsPack })
    } else if (e.config === 'autoroute') {
      startGame(e.id, { cycles: autorouteCycles })
    } else if (e.config === 'crayon') {
      const customWords = crayonWords.split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean)
      startGame(e.id, { rounds: crayonRounds, customWords })
    } else {
      startGame(e.id)
    }
    setSelectedGameId(null)
  }

  const copyCode = async () => {
    play('pop')
    try {
      await navigator.clipboard.writeText(group.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable, ignore silently
    }
  }

  const handleLeave = () => {
    play('pop')
    disconnect()
    leaveGroup()
    navigate('/')
  }

  const handleKick = (targetMemberId: string) => {
    play('pop')
    kickMember(targetMemberId)
    setConfirmingKickId(null)
  }

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !identity) return
    setPhotoError(null)
    setUploadingPhoto(true)
    try {
      const dataUrl = await compressImage(file)
      await apiUpdatePhoto(identity.groupId, identity.memberId, identity.memberToken, dataUrl)
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : "Impossible d'envoyer la photo.")
    } finally {
      setUploadingPhoto(false)
    }
  }

  const selectedGame = GAME_LIBRARY.find((e) => e.id === selectedGameId) ?? null

  return (
    <PageTransition>
      <div className="px-6 pt-10 pb-10 safe-top">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-white/40">Salle</p>
          <h1 className="text-3xl font-extrabold shimmer-text mb-1">{group.name}</h1>
          <button onClick={copyCode} className="text-sm text-white/50">
            Code : <span className="font-bold tracking-[0.2em] text-white/80">{group.code}</span>{' '}
            <span className="text-fuchsia-300">{copied ? '✓ Copié' : '(copier)'}</span>
          </button>
          {confirmingLeave ? (
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-xs text-white/50">Quitter ce salon ?</span>
              <button
                onClick={handleLeave}
                className="rounded-full bg-pink-500/80 px-4 py-2 text-xs font-bold text-white shadow active:bg-pink-500"
              >
                Confirmer
              </button>
              <button
                onClick={() => setConfirmingLeave(false)}
                className="rounded-full bg-white/8 border border-white/15 px-4 py-2 text-xs font-semibold text-white/60 active:bg-white/15"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingLeave(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-pink-500/12 border border-pink-400/30 px-4 py-2 text-xs font-semibold text-pink-200/90 active:bg-pink-500/25 transition-colors"
            >
              🚪 Quitter le salon
            </button>
          )}
        </div>

        {partyError && (
          <Card className="mb-4 border-pink-500/40">
            <p className="text-sm text-pink-300">{partyError}</p>
            <button onClick={clearError} className="text-xs text-white/40 mt-1">
              Fermer
            </button>
          </Card>
        )}

        <Card className="mb-4" delay={0.05}>
          <h3 className="text-sm font-bold text-white/70 mb-3">
            Joueurs ({group.members.length})
          </h3>
          <div className="flex flex-col gap-3">
            {group.members.map((m) => {
              const progress = levelProgress(m.xp)
              const online = onlinePlayerIds.includes(m.id)
              const isMe = m.id === identity.memberId
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="relative">
                    {isMe ? (
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="relative block"
                        aria-label="Changer ma photo de profil"
                      >
                        <Avatar pseudo={m.pseudo} color={m.color} size={40} photoUrl={m.photoUrl} />
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 active:opacity-100 transition-opacity text-xs">
                          {uploadingPhoto ? '…' : '📷'}
                        </span>
                      </button>
                    ) : (
                      <Avatar pseudo={m.pseudo} color={m.color} size={40} photoUrl={m.photoUrl} />
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#14101f] ${online ? 'bg-emerald-400' : 'bg-white/20'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{m.pseudo}</p>
                      {m.id === group.party.hostMemberId && <span className="text-[10px]">👑</span>}
                      {m.badges.map((b) => (
                        <span key={b} className="text-xs" title={BADGE_MAP[b]?.name}>
                          {BADGE_MAP[b]?.emoji}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/40">Niveau {progress.level} · {m.xp} XP</p>
                  </div>
                  {isHost && !isMe && (
                    confirmingKickId === m.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleKick(m.id)}
                          className="rounded-full bg-pink-500/80 px-3 py-1.5 text-[11px] font-bold text-white shadow active:bg-pink-500"
                        >
                          Exclure ?
                        </button>
                        <button
                          onClick={() => setConfirmingKickId(null)}
                          className="rounded-full bg-white/8 border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/60 active:bg-white/15"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingKickId(m.id)}
                        className="shrink-0 rounded-full bg-pink-500/12 border border-pink-400/30 px-3 py-1.5 text-[11px] font-semibold text-pink-200/80 active:bg-pink-500/25 transition-colors"
                        aria-label={`Exclure ${m.pseudo}`}
                      >
                        🚫 Kick
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoPick}
          />
          {photoError && <p className="text-xs text-pink-300 mt-2">{photoError}</p>}
          <p className="text-[11px] text-white/30 mt-2">Touche ton avatar pour changer ta photo de profil.</p>
        </Card>

        {history.length > 0 && (
          <Card className="mb-4" delay={0.08}>
            <h3 className="text-sm font-bold text-white/70 mb-3">Parties récentes</h3>
            <div className="flex flex-col gap-2.5">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-3">
                  <span className="text-xl shrink-0">{GAME_META[h.gameId]?.icon ?? '🎮'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{h.gameName}</p>
                    <p className="text-[11px] text-white/40">
                      {h.roundsPlayed} manche{h.roundsPlayed !== 1 ? 's' : ''} · {relativeTime(h.endedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <AdultModeCard
          adultMode={adultMode}
          isHost={isHost}
          confirming={confirmingAdultMode}
          onRequestEnable={() => setConfirmingAdultMode(true)}
          onCancel={() => setConfirmingAdultMode(false)}
          onConfirm={() => {
            setAdultMode(true)
            setConfirmingAdultMode(false)
          }}
          onDisable={() => setAdultMode(false)}
        />

        {/* ---- Jaquette "à la une" : le test de personnalité + ses 3 niveaux ---- */}
        <div className="relative overflow-hidden rounded-3xl border border-fuchsia-400/25 mb-5 p-5"
          style={{ background: 'linear-gradient(150deg, rgba(217,70,239,0.28), rgba(124,58,237,0.18) 45%, rgba(20,16,31,0.9) 90%)' }}
        >
          <span className="absolute -right-4 -top-6 text-[7rem] opacity-15 rotate-12 select-none pointer-events-none">🧠</span>
          <p className="text-[10px] uppercase tracking-widest text-fuchsia-200/70 mb-1">À la une</p>
          <h3 className="text-lg font-extrabold mb-1">Test de personnalité MindMatch</h3>
          <p className="text-xs text-white/50 mb-4">
            {quizDone ? 'Terminé ! Tu peux revoir ton profil, ou refaire le test.' : 'Découvre ton archétype — choisis ta précision :'}
          </p>
          {quizDone && (
            <Button variant="secondary" fullWidth onClick={() => navigate('/profile')} className="!py-2.5 text-sm mb-3">
              Voir mon profil 🧠
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {QUIZ_LEVELS.map((l) => (
              <motion.button
                key={l.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/quiz?niveau=${l.key}`)}
                className="rounded-2xl bg-black/30 border border-white/10 px-2 py-3 text-center active:bg-white/10 transition-colors"
              >
                <span className="text-xl block mb-0.5">{l.emoji}</span>
                <p className="text-xs font-bold">{l.name}</p>
                <p className="text-[10px] text-white/40">{l.count} questions · {l.duration}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ---- Bibliothèque de jeux façon console ---- */}
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-white/70">🎮 Jeux</h3>
          <p className="text-[10px] text-white/30">📺 = optimisé pour affichage TV</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {GAME_LIBRARY.map((e, i) => (
            <GameTile
              key={e.id}
              entry={e}
              index={i}
              locked={!!e.adult && !adultMode}
              onOpen={() => {
                play('pop')
                setSelectedGameId(e.id)
              }}
            />
          ))}
        </div>

        <Card delay={0.15} className="text-center">
          <p className="text-sm font-semibold mb-1">📺 Mode écran partagé</p>
          <p className="text-xs text-white/40 mb-3">
            Sur une TV ou un ordinateur, entre le code <b>{group.code}</b> dans "Afficher sur un écran".
            L'écran TV est <b>fortement conseillé</b> (l'appli est pensée pour), mais jamais obligatoire :
            tous les jeux restent jouables sur téléphone.
          </p>
          <Button variant="secondary" fullWidth onClick={() => navigate(`/screen/${group.code}`)} className="!py-2.5 text-sm">
            Ouvrir l'écran ici
          </Button>
        </Card>
      </div>

      {/* ---- Fiche jeu (bottom sheet façon console) ---- */}
      <AnimatePresence>
        {selectedGame && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedGameId(null)}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(ev) => ev.stopPropagation()}
              className="relative w-full max-w-md rounded-t-3xl border-t border-x border-white/10 bg-[#171122] px-6 pt-5 pb-8"
            >
              <div className="mx-auto w-10 h-1 rounded-full bg-white/15 mb-4" />
              <GameSheet
                entry={selectedGame}
                locked={!!selectedGame.adult && !adultMode}
                requirement={requirementFor(selectedGame)}
                isHost={isHost}
                adultMode={adultMode}
                dilemmaPack={dilemmaPack}
                setDilemmaPack={setDilemmaPack}
                partyCardsPack={partyCardsPack}
                setPartyCardsPack={setPartyCardsPack}
                autorouteCycles={autorouteCycles}
                setAutorouteCycles={setAutorouteCycles}
                crayonRounds={crayonRounds}
                setCrayonRounds={setCrayonRounds}
                crayonWords={crayonWords}
                setCrayonWords={setCrayonWords}
                onLaunch={() => launchGame(selectedGame)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}

/** Jaquette de jeu façon console : dégradé teinté, grosse icône, chips 18+/TV/joueurs. */
function GameTile({
  entry,
  index,
  locked,
  onOpen,
}: {
  entry: GameLibraryEntry
  index: number
  locked: boolean
  onOpen: () => void
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.3 }}
      whileTap={{ scale: 0.96 }}
      onClick={onOpen}
      className="relative overflow-hidden rounded-2xl border border-white/10 aspect-[4/5] text-left shadow-lg"
      style={{ background: `linear-gradient(165deg, ${entry.hue}66 0%, ${entry.hue}1f 40%, #14101f 85%)` }}
    >
      <span
        className={`absolute -right-3 -top-4 text-[4.6rem] rotate-12 select-none pointer-events-none ${locked ? 'opacity-10 grayscale' : 'opacity-20'}`}
      >
        {entry.icon}
      </span>

      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="flex flex-wrap gap-1">
          {entry.adult && <TileChip className="bg-red-500/30 text-red-200">18+</TileChip>}
          {entry.tvOptimized && <TileChip className="bg-sky-500/25 text-sky-200">📺 TV</TileChip>}
          {entry.badge && <TileChip className="bg-fuchsia-500/30 text-fuchsia-200">{entry.badge}</TileChip>}
        </div>

        <span className={`text-4xl mt-auto mb-1.5 drop-shadow-lg ${locked ? 'grayscale opacity-60' : ''}`}>{entry.icon}</span>
        <p className="text-[13px] font-extrabold leading-tight mb-0.5">{entry.name}</p>
        <p className="text-[10px] text-white/50 leading-snug line-clamp-2">{entry.tagline}</p>
        <p className="text-[9px] text-white/35 mt-1">👥 {entry.minPlayers}+ joueurs</p>
      </div>

      {locked && (
        <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
          <span className="rounded-full bg-black/60 border border-white/15 px-3 py-1.5 text-[11px] font-bold">🔒 Mode 18+</span>
        </div>
      )}
    </motion.button>
  )
}

function TileChip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${className}`}>{children}</span>
  )
}

/** Contenu de la fiche jeu : pitch, pré-requis, options, bouton de lancement. */
function GameSheet({
  entry,
  locked,
  requirement,
  isHost,
  adultMode,
  dilemmaPack,
  setDilemmaPack,
  partyCardsPack,
  setPartyCardsPack,
  autorouteCycles,
  setAutorouteCycles,
  crayonRounds,
  setCrayonRounds,
  crayonWords,
  setCrayonWords,
  onLaunch,
}: {
  entry: GameLibraryEntry
  locked: boolean
  requirement: string | null
  isHost: boolean
  adultMode: boolean
  dilemmaPack: PackChoice
  setDilemmaPack: (p: PackChoice) => void
  partyCardsPack: PackChoice
  setPartyCardsPack: (p: PackChoice) => void
  autorouteCycles: number
  setAutorouteCycles: (n: number) => void
  crayonRounds: number
  setCrayonRounds: (n: number) => void
  crayonWords: string
  setCrayonWords: (s: string) => void
  onLaunch: () => void
}) {
  const pack = entry.id === 'dilemmas' ? dilemmaPack : partyCardsPack
  const setPack = entry.id === 'dilemmas' ? setDilemmaPack : setPartyCardsPack

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shrink-0 border border-white/10"
          style={{ background: `linear-gradient(150deg, ${entry.hue}55, ${entry.hue}18)` }}
        >
          {entry.icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">{entry.name}</h2>
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.adult && <TileChip className="bg-red-500/30 text-red-200">18+</TileChip>}
            {entry.badge && <TileChip className="bg-fuchsia-500/30 text-fuchsia-200">{entry.badge}</TileChip>}
            <TileChip className="bg-white/10 text-white/60">👥 {entry.minPlayers}+ joueurs</TileChip>
          </div>
        </div>
      </div>

      <p className="text-sm text-white/70 mb-3">{entry.tagline}</p>

      {entry.tvOptimized && (
        <p className="text-[11px] text-sky-200/80 bg-sky-500/10 border border-sky-400/20 rounded-xl px-3 py-2 mb-3">
          📺 <b>Optimisé pour affichage TV</b> — jouable sans écran partagé, mais fortement conseillé pour l'ambiance.
        </p>
      )}

      {locked ? (
        <p className="text-xs text-white/50 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-4">
          🔒 Ce jeu fait partie du contenu 18+. {isHost ? 'Active le mode 18+ dans le salon pour le débloquer.' : "Demande à l'hôte d'activer le mode 18+."}
        </p>
      ) : (
        <>
          {entry.config === 'pack' && (
            <div className="flex gap-1.5 mb-4">
              <PackPill label="Classique" active={pack === 'classic'} onClick={() => setPack('classic')} />
              <PackPill
                label="Trash 18+"
                active={pack === 'trash'}
                locked={!adultMode}
                onClick={() => adultMode && setPack('trash')}
              />
              <PackPill
                label="Mixte"
                active={pack === 'mixed'}
                locked={!adultMode}
                onClick={() => adultMode && setPack('mixed')}
              />
            </div>
          )}

          {entry.config === 'autoroute' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/50">Longueur de l'autoroute</span>
                <span className="text-xs font-bold text-fuchsia-300">
                  {autorouteCycles} cycles · {autorouteCycles * 4 - 1} cases
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={6}
                step={1}
                value={autorouteCycles}
                onChange={(e) => setAutorouteCycles(Number(e.target.value))}
                className="w-full accent-fuchsia-400"
                aria-label="Nombre de cycles de l'autoroute"
              />
            </div>
          )}

          {entry.config === 'crayon' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/50">Nombre de manches</span>
                <span className="text-xs font-bold text-fuchsia-300">{crayonRounds} manche{crayonRounds > 1 ? 's' : ''}</span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={crayonRounds}
                onChange={(e) => setCrayonRounds(Number(e.target.value))}
                className="w-full accent-fuchsia-400 mb-3"
                aria-label="Nombre de manches"
              />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/50">Tes mots custom (optionnel, séparés par des virgules)</span>
                <textarea
                  value={crayonWords}
                  onChange={(e) => setCrayonWords(e.target.value)}
                  placeholder="ex : le chien de Kevin, la voiture de tonton…"
                  rows={2}
                  className="rounded-2xl bg-white/6 border border-white/10 px-3 py-2.5 text-sm text-white/90 placeholder:text-white/25 resize-none"
                />
              </label>
            </div>
          )}
        </>
      )}

      {isHost ? (
        <Button fullWidth disabled={locked || requirement !== null} onClick={onLaunch}>
          {locked ? 'Verrouillé (18+)' : requirement ?? '▶ Lancer la partie'}
        </Button>
      ) : (
        <p className="text-xs text-white/40 text-center py-2">Seul·e l'hôte peut lancer ce jeu</p>
      )}
    </div>
  )
}

function PackPill({
  label,
  active,
  locked,
  onClick,
}: {
  label: string
  active: boolean
  locked?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
        active ? 'bg-fuchsia-500/30 text-white border border-fuchsia-400/50' : 'bg-white/6 text-white/50 border border-white/10'
      } ${locked ? 'opacity-40' : ''}`}
    >
      {locked ? `🔒 ${label}` : label}
    </button>
  )
}

function AdultModeCard({
  adultMode,
  isHost,
  confirming,
  onRequestEnable,
  onCancel,
  onConfirm,
  onDisable,
}: {
  adultMode: Group['adultModeEnabled']
  isHost: boolean
  confirming: boolean
  onRequestEnable: () => void
  onCancel: () => void
  onConfirm: () => void
  onDisable: () => void
}) {
  if (confirming) {
    return (
      <Card className="mb-4 border-pink-500/30">
        <p className="text-sm font-bold mb-2">🔞 Activer le contenu 18+ ?</p>
        <p className="text-xs text-white/60 leading-relaxed mb-4">
          Cette salle va inclure de l'humour cru et des jeux à boire (Pyramide, Palmier, Autoroute). Buvez avec
          modération, restez maîtres de votre soirée, ne prenez jamais le volant après avoir bu, et remplacez
          l'alcool par de l'eau ou une boisson sans alcool si vous préférez. L'objectif reste de s'amuser ensemble.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onCancel} className="!py-2.5 text-sm">
            Annuler
          </Button>
          <Button fullWidth onClick={onConfirm} className="!py-2.5 text-sm">
            J'ai compris, activer
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mb-4 flex items-center gap-3">
      <span className="text-2xl">🔞</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">Mode 18+</p>
        <p className="text-xs text-white/40">
          {adultMode ? 'Activé — contenu trash et jeu à boire débloqués' : 'Débloque les packs trash et le jeu à boire'}
        </p>
      </div>
      {isHost ? (
        adultMode ? (
          <button onClick={onDisable} className="text-xs text-white/40 underline shrink-0">
            Désactiver
          </button>
        ) : (
          <Button onClick={onRequestEnable} className="!px-4 !py-2 text-sm shrink-0">
            Activer
          </Button>
        )
      ) : (
        <span className={`text-xs shrink-0 ${adultMode ? 'text-emerald-400' : 'text-white/30'}`}>
          {adultMode ? '✓ actif' : '—'}
        </span>
      )}
    </Card>
  )
}
