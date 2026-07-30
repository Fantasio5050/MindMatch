import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { Surface } from '../components/Card'
import { Button } from '../components/Button'
import { Player } from '../components/Player'
import { useAppStore } from '../store/useAppStore'
import { usePartyStore } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { apiGetGameHistory, apiUpdatePhoto, ApiError } from '../lib/api'
import { compressImage } from '../lib/compressImage'
import { GAME_META } from '../data/gameMeta'
import { GAME_LIBRARY, type GameLibraryEntry } from '../data/gameLibrary'
import { QUIZ_LEVELS } from '../data/quizLevels'
import { spotifyEnabled } from '../lib/spotify'
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
  const startMusic = usePartyStore((s) => s.startMusic)
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
  const [intrusPack, setIntrusPack] = useState<PackChoice>('classic')
  const [intrusTurnSeconds, setIntrusTurnSeconds] = useState(30)
  const [intrusMrWhite, setIntrusMrWhite] = useState(true)
  const [intrusUndercovers, setIntrusUndercovers] = useState<number | null>(null)
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

  // Mode Soirée lancé par l'hôte -> tout le monde bascule sur la platine partagée.
  useEffect(() => {
    if (partyGroup?.music) navigate('/soiree')
  }, [partyGroup?.music, navigate])

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
        <p className="text-chalk-soft text-sm">Chargement de la salle…</p>
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
    } else if (e.config === 'intrus') {
      startGame(e.id, {
        pack: intrusPack,
        turnSeconds: intrusTurnSeconds,
        mrWhite: intrusMrWhite,
        ...(intrusUndercovers !== null ? { undercoverCount: intrusUndercovers } : {}),
      })
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
        {/* ---- La table : les gens d'abord, l'interface ensuite ---- */}
        <PartyTable
          group={group}
          myId={identity.memberId}
          isHost={isHost}
          onlineIds={onlinePlayerIds}
          copied={copied}
          uploadingPhoto={uploadingPhoto}
          confirmingKickId={confirmingKickId}
          onCopyCode={copyCode}
          onPickPhoto={() => photoInputRef.current?.click()}
          onRequestKick={setConfirmingKickId}
          onKick={handleKick}
        />
        {photoError && <p className="text-xs text-blood text-center mt-2">{photoError}</p>}
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />

        {partyError && (
          <Surface className="mb-4 border-blood/50">
            <p className="text-sm text-chalk">{partyError}</p>
            <button onClick={clearError} className="text-xs text-chalk-soft mt-1">
              Fermer
            </button>
          </Surface>
        )}

        {/* ---- Le test de personnalité : mis en avant, mais plus "vitrine néon" ----
             Avant : dégradé fuchsia + emoji cerveau géant en filigrane. C'est le réflexe
             d'interface que l'audit pointait — le décor criait plus fort que le contenu.
             Ici la mise en avant passe par un liseré spark et la typo display, rien d'autre. */}
        <Surface level="raised" className="mb-5 border-spark-dim/50">
          <p className="kicker text-2xs mb-1">Le test MindMatch</p>
          <h3 className="font-display text-xl text-chalk mb-1">Découvre ton archétype</h3>
          <p className="text-xs text-chalk-soft mb-4">
            {quizDone
              ? 'Déjà fait. Tu peux revoir ton profil, ou refaire le test plus en détail.'
              : 'Le seul moment solo de la soirée — il nourrit ensuite les comparaisons de groupe.'}
          </p>
          {quizDone && (
            <Button variant="secondary" fullWidth onClick={() => navigate('/profile')} className="mb-3">
              Voir mon profil
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {QUIZ_LEVELS.map((l) => (
              <motion.button
                key={l.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/quiz?niveau=${l.key}`)}
                className="rounded-control bg-felt border border-line px-2 py-3 text-center active:bg-felt-raised transition-colors"
              >
                <p className="text-sm font-semibold text-chalk">{l.name}</p>
                <p className="text-2xs text-chalk-faint mt-0.5">{l.count} questions</p>
                <p className="text-2xs text-chalk-faint">{l.duration}</p>
              </motion.button>
            ))}
          </div>
        </Surface>

        {/* ---- Mode Soirée : la platine musicale partagée ---- */}
        <SoireeLaunchCard isHost={isHost} onLaunch={(source) => { play('start'); startMusic(source) }} />

        {/* ---- Bibliothèque de jeux ---- */}
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h3 className="kicker text-2xs">Jeux</h3>
          <p className="text-2xs text-chalk-faint">TV = mieux sur écran partagé</p>
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

        {/* ---- Réglages du salon : tout ce qui n'est PAS jouer ----
             L'administration (18+, écran TV, historique, sortie) passait avant les jeux et
             occupait la moitié de l'écran. Elle est maintenant repliée en bas : on ne l'ouvre
             qu'une fois par soirée, alors que la table et les jeux servent en permanence. */}
        <SalonSettings
          group={group}
          isHost={isHost}
          adultMode={adultMode}
          confirmingAdultMode={confirmingAdultMode}
          onRequestEnableAdult={() => setConfirmingAdultMode(true)}
          onCancelAdult={() => setConfirmingAdultMode(false)}
          onConfirmAdult={() => {
            setAdultMode(true)
            setConfirmingAdultMode(false)
          }}
          onDisableAdult={() => setAdultMode(false)}
          history={history}
          confirmingLeave={confirmingLeave}
          onRequestLeave={() => setConfirmingLeave(true)}
          onCancelLeave={() => setConfirmingLeave(false)}
          onLeave={handleLeave}
          onOpenScreen={() => navigate(`/screen/${group.code}`)}
        />
      </div>

      {/* ---- Fiche jeu (bottom sheet façon console) ---- */}
      <AnimatePresence>
        {selectedGame && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedGameId(null)}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(ev) => ev.stopPropagation()}
              className="relative w-full max-w-md rounded-t-sheet border-t border-x border-line bg-felt shadow-float px-6 pt-5 pb-8"
            >
              <div className="mx-auto w-10 h-1 rounded-chip bg-line-strong mb-4" />
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
                playerCount={group.members.length}
                intrusPack={intrusPack}
                setIntrusPack={setIntrusPack}
                intrusTurnSeconds={intrusTurnSeconds}
                setIntrusTurnSeconds={setIntrusTurnSeconds}
                intrusMrWhite={intrusMrWhite}
                setIntrusMrWhite={setIntrusMrWhite}
                intrusUndercovers={intrusUndercovers}
                setIntrusUndercovers={setIntrusUndercovers}
                onLaunch={() => launchGame(selectedGame)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}

/**
 * PartyTable — la table de jeu, en haut du salon.
 *
 * C'est le changement le plus important de l'écran. Avant, les joueurs étaient une liste compacte
 * coincée au-dessus d'un catalogue : l'interface dominait les gens. Or le salon est précisément
 * le moment social de la soirée — celui où l'on attend les retardataires — pas un menu.
 *
 * Le code de la salle est posé au CENTRE de la table, comme la mise au milieu d'un tapis : c'est
 * lui qui fait venir les autres, il est donc au cœur, pas relégué en légende.
 */
function PartyTable({
  group,
  myId,
  isHost,
  onlineIds,
  copied,
  uploadingPhoto,
  confirmingKickId,
  onCopyCode,
  onPickPhoto,
  onRequestKick,
  onKick,
}: {
  group: Group
  myId: string
  isHost: boolean
  onlineIds: string[]
  copied: boolean
  uploadingPhoto: boolean
  confirmingKickId: string | null
  onCopyCode: () => void
  onPickPhoto: () => void
  onRequestKick: (id: string | null) => void
  onKick: (id: string) => void
}) {
  const kickTarget = group.members.find((m) => m.id === confirmingKickId) ?? null

  return (
    <div className="mb-6">
      <p className="kicker text-2xs text-center mb-1">Salle</p>
      <h1 className="font-display text-2xl text-center text-chalk mb-4">{group.name}</h1>

      {/* Le tapis */}
      <div className="rounded-sheet bg-felt border border-line shadow-card px-4 py-6">
        {/* La mise au centre : le code, gravé façon jeton. */}
        <button onClick={onCopyCode} className="mx-auto block text-center mb-6" aria-label="Copier le code de la salle">
          <span className="kicker text-2xs block mb-1">{copied ? '✓ Copié' : 'Code de la salle'}</span>
          <span className="font-stage text-3xl text-brass tracking-[0.2em]">{group.code}</span>
        </button>

        {/* Les convives */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-4">
          {group.members.map((m) => {
            const isMe = m.id === myId
            const online = onlineIds.length === 0 || onlineIds.includes(m.id)
            return (
              <motion.button
                key={m.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                whileTap={{ scale: 0.94 }}
                // Sa propre photo se change en touchant son avatar ; l'hôte touche un autre
                // joueur pour l'exclure. Deux gestes, aucun bouton parasite sur la table.
                onClick={() => (isMe ? onPickPhoto() : isHost ? onRequestKick(m.id) : undefined)}
                disabled={isMe ? uploadingPhoto : !isHost}
                className="disabled:pointer-events-none"
              >
                <Player
                  member={m}
                  size="md"
                  host={m.id === group.party.hostMemberId}
                  offline={!online}
                  caption={isMe ? (uploadingPhoto ? '…' : 'toi · 📷') : undefined}
                />
              </motion.button>
            )
          })}
        </div>

        <p className="text-center text-xs text-chalk-faint mt-5">
          {group.members.length} à table · partage le code pour agrandir le cercle
        </p>
      </div>

      {/* Exclusion : confirmation sous la table, jamais un bouton posé sur chaque joueur. */}
      <AnimatePresence>
        {kickTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-center gap-2 pt-3">
              <span className="text-xs text-chalk-soft">Exclure {kickTarget.pseudo} ?</span>
              <Button variant="danger" onClick={() => onKick(kickTarget.id)} className="!min-h-0 !py-1.5 !px-3 text-xs">
                Exclure
              </Button>
              <Button variant="ghost" onClick={() => onRequestKick(null)} className="!min-h-0 !py-1.5 !px-3 text-xs">
                Annuler
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Réglages du salon — repliés par défaut : on les ouvre une fois par soirée, pas à chaque partie. */
function SalonSettings({
  group,
  isHost,
  adultMode,
  confirmingAdultMode,
  onRequestEnableAdult,
  onCancelAdult,
  onConfirmAdult,
  onDisableAdult,
  history,
  confirmingLeave,
  onRequestLeave,
  onCancelLeave,
  onLeave,
  onOpenScreen,
}: {
  group: Group
  isHost: boolean
  adultMode: boolean
  confirmingAdultMode: boolean
  onRequestEnableAdult: () => void
  onCancelAdult: () => void
  onConfirmAdult: () => void
  onDisableAdult: () => void
  history: GameHistoryEntry[]
  confirmingLeave: boolean
  onRequestLeave: () => void
  onCancelLeave: () => void
  onLeave: () => void
  onOpenScreen: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-chalk-soft"
      >
        Réglages du salon
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-1">
              <AdultModeCard
                adultMode={adultMode}
                isHost={isHost}
                confirming={confirmingAdultMode}
                onRequestEnable={onRequestEnableAdult}
                onCancel={onCancelAdult}
                onConfirm={onConfirmAdult}
                onDisable={onDisableAdult}
              />

              <Surface>
                <p className="text-sm font-semibold mb-1 text-chalk">Écran partagé</p>
                <p className="text-xs text-chalk-soft mb-3">
                  Sur une TV ou un ordinateur, entre le code <b className="text-chalk">{group.code}</b>. Fortement
                  conseillé, jamais obligatoire — tous les jeux restent jouables sur téléphone.
                </p>
                <Button variant="secondary" fullWidth onClick={onOpenScreen}>
                  Ouvrir l'écran ici
                </Button>
              </Surface>

              {history.length > 0 && (
                <Surface>
                  <p className="text-sm font-semibold mb-3 text-chalk">Parties récentes</p>
                  <div className="flex flex-col gap-2.5">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center gap-3">
                        <span className="text-xl shrink-0">{GAME_META[h.gameId]?.icon ?? '🎮'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate text-chalk">{h.gameName}</p>
                          <p className="text-2xs text-chalk-faint">
                            {h.roundsPlayed} manche{h.roundsPlayed !== 1 ? 's' : ''} · {relativeTime(h.endedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Surface>
              )}

              {confirmingLeave ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-chalk-soft">Quitter ce salon ?</span>
                  <Button variant="danger" onClick={onLeave} className="!min-h-0 !py-2 !px-4 text-xs">
                    Confirmer
                  </Button>
                  <Button variant="ghost" onClick={onCancelLeave} className="!min-h-0 !py-2 !px-4 text-xs">
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" fullWidth onClick={onRequestLeave} className="text-blood">
                  Quitter le salon
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Entrée "Mode Soirée" : une file musicale partagée (pas un jeu). L'hôte choisit la source
 * (YouTube prêt à l'emploi ; Spotify nécessite une configuration serveur) puis lance. */
function SoireeLaunchCard({ isHost, onLaunch }: { isHost: boolean; onLaunch: (source: 'youtube' | 'spotify') => void }) {
  const [picking, setPicking] = useState(false)

  return (
    <Surface level="raised" className="mb-5">
      <p className="kicker text-2xs mb-1">Mode Soirée</p>
      <h3 className="font-display text-xl text-chalk mb-1">La platine partagée</h3>
      <p className="text-xs text-chalk-soft mb-4">
        Fini le seul téléphone branché à l'enceinte : tout le monde ajoute des musiques dans une file{' '}
        <b className="text-chalk-muted">équitable</b> (chacun son tour), avec vote pour passer un morceau.
        L'appareil branché à l'enceinte ouvre la platine.
      </p>

      {!isHost ? (
        <p className="text-xs text-chalk-faint">Seul·e l'hôte peut lancer le Mode Soirée.</p>
      ) : !picking ? (
        <Button fullWidth onClick={() => setPicking(true)}>
          Lancer le Mode Soirée
        </Button>
      ) : (
        <div>
          <p className="text-xs text-chalk-soft mb-2">Choisis la source musicale :</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onLaunch('youtube')}
              className="rounded-control bg-felt border border-line px-3 py-3 text-center active:bg-felt-raised transition-colors"
            >
              <p className="text-sm font-semibold text-chalk">YouTube</p>
              <p className="text-2xs text-jade mt-0.5">Prêt · sans compte</p>
            </button>
            <button
              onClick={() => spotifyEnabled && onLaunch('spotify')}
              disabled={!spotifyEnabled}
              className={`rounded-control border px-3 py-3 text-center transition-colors ${
                spotifyEnabled ? 'bg-felt border-line active:bg-felt-raised' : 'bg-felt-sunken border-line opacity-50'
              }`}
            >
              <p className="text-sm font-semibold text-chalk">Spotify</p>
              <p className="text-2xs text-chalk-faint mt-0.5">{spotifyEnabled ? 'Compte Premium' : 'Bientôt'}</p>
            </button>
          </div>
          <button onClick={() => setPicking(false)} className="text-2xs text-chalk-faint mt-2">Annuler</button>
        </div>
      )}
    </Surface>
  )
}

/**
 * Jaquette de jeu.
 *
 * Avant : un dégradé teinté plein cadre + le même emoji répété en filigrane géant. Douze tuiles
 * comme ça, et la grille devenait un mur de couleur où plus rien ne ressortait.
 *
 * Maintenant : toutes les tuiles partagent le même feutre. La teinte du jeu ne subsiste qu'en
 * liseré haut et en halo bas — assez pour reconnaître un jeu d'un coup d'œil, jamais assez pour
 * concurrencer son titre.
 */
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
      className="relative overflow-hidden rounded-card border border-line bg-felt aspect-[4/5] text-left shadow-card"
    >
      {/* La couleur du jeu, réduite à deux traces : un liseré haut et un halo au sol. */}
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: entry.hue, opacity: locked ? 0.2 : 0.7 }} />
      <span
        className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
        style={{
          background: `radial-gradient(120% 90% at 50% 130%, ${entry.hue}40 0%, transparent 70%)`,
          opacity: locked ? 0.25 : 1,
        }}
      />

      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="flex flex-wrap gap-1">
          {entry.adult && <TileChip className="bg-blood/25 text-blood">18+</TileChip>}
          {entry.tvOptimized && <TileChip className="bg-chalk/8 text-chalk-muted">TV</TileChip>}
          {entry.badge && <TileChip className="bg-spark/20 text-spark">{entry.badge}</TileChip>}
        </div>

        <span className={`text-3xl mt-auto mb-1.5 ${locked ? 'grayscale opacity-50' : ''}`}>{entry.icon}</span>
        <p className="font-display text-sm text-chalk leading-tight mb-0.5">{entry.name}</p>
        <p className="text-2xs text-chalk-soft leading-snug line-clamp-2">{entry.tagline}</p>
        <p className="text-2xs text-chalk-faint mt-1">{entry.minPlayers}+ joueurs</p>
      </div>

      {locked && (
        <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
          <span className="rounded-chip bg-felt-raised border border-line-strong px-3 py-1.5 text-2xs font-semibold text-chalk-muted">
            Mode 18+
          </span>
        </div>
      )}
    </motion.button>
  )
}

function TileChip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded-chip px-1.5 py-0.5 text-2xs font-semibold tracking-wide ${className}`}>{children}</span>
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
  playerCount,
  intrusPack,
  setIntrusPack,
  intrusTurnSeconds,
  setIntrusTurnSeconds,
  intrusMrWhite,
  setIntrusMrWhite,
  intrusUndercovers,
  setIntrusUndercovers,
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
  playerCount: number
  intrusPack: PackChoice
  setIntrusPack: (p: PackChoice) => void
  intrusTurnSeconds: number
  setIntrusTurnSeconds: (n: number) => void
  intrusMrWhite: boolean
  setIntrusMrWhite: (b: boolean) => void
  intrusUndercovers: number | null
  setIntrusUndercovers: (n: number | null) => void
  onLaunch: () => void
}) {
  const pack = entry.id === 'dilemmas' ? dilemmaPack : partyCardsPack
  const setPack = entry.id === 'dilemmas' ? setDilemmaPack : setPartyCardsPack

  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <div
          className="w-16 h-16 rounded-card flex items-center justify-center text-4xl shrink-0 border border-line bg-felt-raised"
          style={{ boxShadow: `inset 0 1px 0 ${entry.hue}55` }}
        >
          {entry.icon}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl text-chalk leading-tight">{entry.name}</h2>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {entry.adult && <TileChip className="bg-blood/25 text-blood">18+</TileChip>}
            {entry.badge && <TileChip className="bg-spark/20 text-spark">{entry.badge}</TileChip>}
            <TileChip className="bg-chalk/8 text-chalk-muted">{entry.minPlayers}+ joueurs</TileChip>
          </div>
        </div>
      </div>

      <p className="text-sm text-chalk-muted mb-3">{entry.tagline}</p>

      {entry.tvOptimized && (
        <p className="text-xs text-chalk-soft bg-felt border border-line rounded-control px-3 py-2 mb-3">
          <b className="text-chalk-muted">Mieux sur écran partagé</b> — jouable sans TV, mais l'ambiance y gagne beaucoup.
        </p>
      )}

      {locked ? (
        <p className="text-xs text-chalk-soft bg-felt border border-line rounded-control px-3 py-2.5 mb-4">
          Ce jeu fait partie du contenu 18+. {isHost ? 'Active le mode 18+ dans les réglages du salon pour le débloquer.' : "Demande à l'hôte d'activer le mode 18+."}
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
                <span className="text-xs text-chalk-soft">Longueur de l'autoroute</span>
                <span className="text-xs font-semibold text-spark">
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
                className="w-full accent-spark"
                aria-label="Nombre de cycles de l'autoroute"
              />
            </div>
          )}

          {entry.config === 'crayon' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-chalk-soft">Nombre de manches</span>
                <span className="text-xs font-semibold text-spark">{crayonRounds} manche{crayonRounds > 1 ? 's' : ''}</span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={crayonRounds}
                onChange={(e) => setCrayonRounds(Number(e.target.value))}
                className="w-full accent-spark mb-3"
                aria-label="Nombre de manches"
              />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-chalk-soft">Tes mots custom (optionnel, séparés par des virgules)</span>
                <textarea
                  value={crayonWords}
                  onChange={(e) => setCrayonWords(e.target.value)}
                  placeholder="ex : le chien de Kevin, la voiture de tonton…"
                  rows={2}
                  className="rounded-control bg-felt border border-line px-3 py-2.5 text-sm text-chalk placeholder:text-chalk-faint resize-none"
                />
              </label>
            </div>
          )}

          {entry.config === 'intrus' && (
            <IntrusOptions
              playerCount={playerCount}
              adultMode={adultMode}
              pack={intrusPack}
              setPack={setIntrusPack}
              turnSeconds={intrusTurnSeconds}
              setTurnSeconds={setIntrusTurnSeconds}
              mrWhite={intrusMrWhite}
              setMrWhite={setIntrusMrWhite}
              undercovers={intrusUndercovers}
              setUndercovers={setIntrusUndercovers}
            />
          )}
        </>
      )}

      {isHost ? (
        <Button fullWidth disabled={locked || requirement !== null} onClick={onLaunch}>
          {locked ? 'Verrouillé (18+)' : requirement ?? 'Lancer la partie'}
        </Button>
      ) : (
        <p className="text-xs text-chalk-faint text-center py-2">Seul·e l'hôte peut lancer ce jeu</p>
      )}
    </div>
  )
}

/** Réglages de L'Intrus. Le nombre d'undercovers est « Auto » par défaut ; en manuel, il reste
 * plafonné par le même garde-fou que le serveur (les infiltrés doivent rester minoritaires). */
function IntrusOptions({
  playerCount,
  adultMode,
  pack,
  setPack,
  turnSeconds,
  setTurnSeconds,
  mrWhite,
  setMrWhite,
  undercovers,
  setUndercovers,
}: {
  playerCount: number
  adultMode: boolean
  pack: PackChoice
  setPack: (p: PackChoice) => void
  turnSeconds: number
  setTurnSeconds: (n: number) => void
  mrWhite: boolean
  setMrWhite: (b: boolean) => void
  undercovers: number | null
  setUndercovers: (n: number | null) => void
}) {
  const cap = Math.max(1, Math.floor((playerCount - 1) / 2))
  const auto = playerCount <= 6 ? 1 : playerCount <= 9 ? 2 : 3
  const effective = Math.min(undercovers ?? auto, cap)
  // Mr. White ne rentre que s'il reste de la place sous le plafond (impossible à 4 joueurs).
  const mrWhiteFits = effective < cap
  const options = Array.from({ length: cap }, (_, i) => i + 1)

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex gap-1.5">
        <PackPill label="Classique" active={pack === 'classic'} onClick={() => setPack('classic')} />
        <PackPill label="Trash 18+" active={pack === 'trash'} locked={!adultMode} onClick={() => adultMode && setPack('trash')} />
        <PackPill label="Mixte" active={pack === 'mixed'} locked={!adultMode} onClick={() => adultMode && setPack('mixed')} />
      </div>

      <div>
        <span className="text-xs text-chalk-soft block mb-1">Temps de parole (indicatif)</span>
        <div className="flex gap-1.5">
          {[15, 30, 45].map((s) => (
            <button
              key={s}
              onClick={() => setTurnSeconds(s)}
              className={`flex-1 rounded-chip py-2 text-xs font-semibold border transition-colors ${
                turnSeconds === s
                  ? 'bg-spark/20 text-chalk border-spark-dim'
                  : 'bg-felt text-chalk-soft border-line'
              }`}
            >
              {s} s
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-chalk-soft">Nombre d'intrus</span>
          <span className="text-xs font-semibold text-spark">
            {undercovers === null ? `Auto (${auto})` : effective}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setUndercovers(null)}
            className={`flex-1 rounded-chip py-2 text-xs font-semibold border transition-colors ${
              undercovers === null
                ? 'bg-spark/20 text-chalk border-spark-dim'
                : 'bg-felt text-chalk-soft border-line'
            }`}
          >
            Auto
          </button>
          {options.map((n) => (
            <button
              key={n}
              onClick={() => setUndercovers(n)}
              className={`flex-1 rounded-chip py-2 text-xs font-semibold border transition-colors ${
                undercovers === n
                  ? 'bg-spark/20 text-chalk border-spark-dim'
                  : 'bg-felt text-chalk-soft border-line'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => mrWhiteFits && setMrWhite(!mrWhite)}
        disabled={!mrWhiteFits}
        className={`flex items-center gap-2 w-full rounded-2xl border px-3 py-2.5 text-left transition-colors ${
          mrWhiteFits ? 'bg-felt border-line active:bg-felt-raised' : 'bg-felt-sunken border-line opacity-50'
        }`}
      >
        <span className="text-lg">🃏</span>
        <span className="flex-1">
          <span className="text-sm font-semibold block">Mr. White</span>
          <span className="text-2xs text-chalk-soft">
            {mrWhiteFits ? "Aucun mot — il improvise, et peut voler la partie" : `Impossible à ${playerCount} joueurs (trop d'intrus)`}
          </span>
        </span>
        <span
          className={`w-9 h-5 rounded-chip relative shrink-0 transition-colors ${mrWhite && mrWhiteFits ? 'bg-spark' : 'bg-line-strong'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-chip bg-chalk transition-transform ${mrWhite && mrWhiteFits ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </span>
      </button>
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
      className={`flex-1 rounded-chip py-2 text-xs font-semibold transition-colors ${
        active ? 'bg-spark/20 text-chalk border border-spark-dim' : 'bg-felt text-chalk-soft border border-line'
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
      <Surface className="border-blood/40">
        <p className="font-display text-lg text-chalk mb-2">Activer le contenu 18+ ?</p>
        <p className="text-xs text-chalk-soft leading-relaxed mb-4">
          Cette salle va inclure de l'humour cru et des jeux à boire (Pyramide, Palmier, Autoroute). Buvez avec
          modération, restez maîtres de votre soirée, ne prenez jamais le volant après avoir bu, et remplacez
          l'alcool par de l'eau ou une boisson sans alcool si vous préférez. L'objectif reste de s'amuser ensemble.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" fullWidth onClick={onCancel}>
            Annuler
          </Button>
          <Button fullWidth onClick={onConfirm}>
            J'ai compris, activer
          </Button>
        </div>
      </Surface>
    )
  }

  return (
    <Surface className="flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-chalk">Mode 18+</p>
        <p className="text-xs text-chalk-soft">
          {adultMode ? 'Activé — contenu trash et jeu à boire débloqués' : 'Débloque les packs trash et le jeu à boire'}
        </p>
      </div>
      {isHost ? (
        adultMode ? (
          <Button variant="ghost" onClick={onDisable} className="!min-h-0 !py-2 !px-3 text-xs shrink-0">
            Désactiver
          </Button>
        ) : (
          <Button onClick={onRequestEnable} className="!min-h-0 !py-2.5 !px-4 text-sm shrink-0">
            Activer
          </Button>
        )
      ) : (
        <span className={`text-xs shrink-0 ${adultMode ? 'text-jade' : 'text-chalk-faint'}`}>
          {adultMode ? 'actif' : '—'}
        </span>
      )}
    </Surface>
  )
}
