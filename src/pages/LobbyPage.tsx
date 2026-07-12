import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { useAppStore } from '../store/useAppStore'
import { usePartyStore } from '../store/usePartyStore'
import { levelProgress } from '../lib/xp'
import { BADGE_MAP } from '../data/badges'
import { apiGetGameHistory } from '../lib/api'
import { GAME_META } from '../data/gameMeta'
import type { Group, GameHistoryEntry } from '../types'

type DilemmaPackChoice = 'classic' | 'trash' | 'mixed'
type PartyCardsPackChoice = 'classic' | 'trash' | 'mixed'

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
  const partyGroup = usePartyStore((s) => s.group)
  const onlinePlayerIds = usePartyStore((s) => s.onlinePlayerIds)
  const isHost = usePartyStore((s) => s.isHost())
  const partyError = usePartyStore((s) => s.error)
  const clearError = usePartyStore((s) => s.clearError)
  const leaveGroup = useAppStore((s) => s.leaveGroup)

  const [copied, setCopied] = useState(false)
  const [confirmingAdultMode, setConfirmingAdultMode] = useState(false)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [dilemmaPack, setDilemmaPack] = useState<DilemmaPackChoice>('classic')
  const [partyCardsPack, setPartyCardsPack] = useState<PartyCardsPackChoice>('classic')
  const [history, setHistory] = useState<GameHistoryEntry[]>([])

  useEffect(() => {
    if (!identity) return
    refreshGroup()
    connectAsPlayer()
  }, [identity, refreshGroup, connectAsPlayer])

  useEffect(() => {
    if (partyGroup?.party.status === 'playing') navigate('/play')
  }, [partyGroup?.party.status, navigate])

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
  const canPlayMostLikely = group.members.length >= 3
  const canPlayPyramid = group.members.length >= 2
  const canPlayPartyCards = group.members.length >= 2
  const canPlaySecretProfile = group.members.length >= 3 && finishedCount >= 2
  const canPlayWhoWroteIt = group.members.length >= 3
  const canPlayGuessMyAnswer = group.members.length >= 3 && finishedCount >= 1
  const canPlayPalmier = group.members.length >= 2
  const canPlayAutoroute = group.members.length >= 2
  const adultMode = group.adultModeEnabled

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(group.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable, ignore silently
    }
  }

  const handleLeave = () => {
    disconnect()
    leaveGroup()
    navigate('/')
  }

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
              <button onClick={handleLeave} className="text-xs font-semibold text-pink-300 underline">
                Confirmer
              </button>
              <button onClick={() => setConfirmingLeave(false)} className="text-xs text-white/40 underline">
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingLeave(true)}
              className="text-xs text-white/30 mt-3 underline underline-offset-2"
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
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar pseudo={m.pseudo} color={m.color} size={40} />
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
                </div>
              )
            })}
          </div>
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

        <h3 className="text-sm font-bold text-white/70 mb-3 px-1">Activités</h3>
        <div className="flex flex-col gap-3 mb-4">
          <Card delay={0.1}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧠</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Test de personnalité MindMatch</p>
                <p className="text-xs text-white/40">
                  {quizDone ? 'Terminé — voir ton profil' : '36 questions, ~5 minutes'}
                </p>
              </div>
              <Button
                variant={quizDone ? 'secondary' : 'primary'}
                onClick={() => navigate(quizDone ? '/profile' : '/quiz')}
                className="!px-4 !py-2 text-sm"
              >
                {quizDone ? 'Voir' : 'Jouer'}
              </Button>
            </div>
          </Card>

          <Card delay={0.15}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🎯</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Qui est le plus ?</p>
                <p className="text-xs text-white/40">Votes anonymes, révélations en direct</p>
              </div>
            </div>
            {isHost ? (
              <Button
                fullWidth
                disabled={!canPlayMostLikely}
                onClick={() => startGame('who-is-most-likely')}
                className="!py-2.5 text-sm"
              >
                {canPlayMostLikely ? 'Lancer la partie' : 'Il faut au moins 3 joueurs'}
              </Button>
            ) : (
              <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
            )}
          </Card>

          <Card delay={0.2}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">⚖️</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Dilemmes & Débats</p>
                <p className="text-xs text-white/40">Le groupe vote, on regarde qui penche où</p>
              </div>
            </div>
            <div className="flex gap-1.5 mb-3">
              <PackPill label="Classique" active={dilemmaPack === 'classic'} onClick={() => setDilemmaPack('classic')} />
              <PackPill
                label="Trash 18+"
                active={dilemmaPack === 'trash'}
                locked={!adultMode}
                onClick={() => adultMode && setDilemmaPack('trash')}
              />
              <PackPill
                label="Mixte"
                active={dilemmaPack === 'mixed'}
                locked={!adultMode}
                onClick={() => adultMode && setDilemmaPack('mixed')}
              />
            </div>
            {isHost ? (
              <Button fullWidth onClick={() => startGame('dilemmas', { pack: dilemmaPack })} className="!py-2.5 text-sm">
                Lancer la partie
              </Button>
            ) : (
              <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
            )}
          </Card>

          {adultMode ? (
            <Card delay={0.25}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🍻</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Pyramide</p>
                  <p className="text-xs text-white/40">Cartes, gorgées et cul sec au sommet 🥃</p>
                </div>
              </div>
              {isHost ? (
                <Button
                  fullWidth
                  disabled={!canPlayPyramid}
                  onClick={() => startGame('pyramid')}
                  className="!py-2.5 text-sm"
                >
                  {canPlayPyramid ? 'Lancer la partie' : 'Il faut au moins 2 joueurs'}
                </Button>
              ) : (
                <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
              )}
            </Card>
          ) : (
            <LockedGameCard icon="🍻" name="Pyramide" note="Jeu à boire — active le mode 18+" />
          )}

          {adultMode ? (
            <Card delay={0.26}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🌴</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Palmier</p>
                  <p className="text-xs text-white/40">Le Cercle — 52 cartes, cul sec au centre 🥃</p>
                </div>
              </div>
              {isHost ? (
                <Button
                  fullWidth
                  disabled={!canPlayPalmier}
                  onClick={() => startGame('palmier')}
                  className="!py-2.5 text-sm"
                >
                  {canPlayPalmier ? 'Lancer la partie' : 'Il faut au moins 2 joueurs'}
                </Button>
              ) : (
                <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
              )}
            </Card>
          ) : (
            <LockedGameCard icon="🌴" name="Palmier" note="Jeu à boire — active le mode 18+" />
          )}

          {adultMode ? (
            <Card delay={0.27}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🛣️</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Autoroute</p>
                  <p className="text-xs text-white/40">Plus haut ou plus bas — rate et tu bois</p>
                </div>
              </div>
              {isHost ? (
                <Button
                  fullWidth
                  disabled={!canPlayAutoroute}
                  onClick={() => startGame('autoroute')}
                  className="!py-2.5 text-sm"
                >
                  {canPlayAutoroute ? 'Lancer la partie' : 'Il faut au moins 2 joueurs'}
                </Button>
              ) : (
                <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
              )}
            </Card>
          ) : (
            <LockedGameCard icon="🛣️" name="Autoroute" note="Jeu à boire — active le mode 18+" />
          )}

          <Card delay={0.28}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔍</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Profil secret</p>
                <p className="text-xs text-white/40">Des indices sur les traits, devinez qui c'est</p>
              </div>
            </div>
            {isHost ? (
              <Button
                fullWidth
                disabled={!canPlaySecretProfile}
                onClick={() => startGame('secret-profile')}
                className="!py-2.5 text-sm"
              >
                {canPlaySecretProfile
                  ? 'Lancer la partie'
                  : 'Il faut 3 joueurs, dont 2 ayant fini le test'}
              </Button>
            ) : (
              <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
            )}
          </Card>

          <Card delay={0.3}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🕵️</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Devine ma réponse</p>
                <p className="text-xs text-white/40">Devinez ce qu'un·e ami·e a répondu au quiz</p>
              </div>
            </div>
            {isHost ? (
              <Button
                fullWidth
                disabled={!canPlayGuessMyAnswer}
                onClick={() => startGame('guess-my-answer')}
                className="!py-2.5 text-sm"
              >
                {canPlayGuessMyAnswer ? 'Lancer la partie' : 'Il faut 3 joueurs, dont 1 ayant fini le test'}
              </Button>
            ) : (
              <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
            )}
          </Card>

          <Card delay={0.32}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">✍️</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Qui a écrit ça ?</p>
                <p className="text-xs text-white/40">Écrivez, mélangez, devinez les auteur·rice·s</p>
              </div>
            </div>
            {isHost ? (
              <Button
                fullWidth
                disabled={!canPlayWhoWroteIt}
                onClick={() => startGame('who-wrote-it')}
                className="!py-2.5 text-sm"
              >
                {canPlayWhoWroteIt ? 'Lancer la partie' : 'Il faut au moins 3 joueurs'}
              </Button>
            ) : (
              <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
            )}
          </Card>

          <Card delay={0.34}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🃏</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Cartes de soirée</p>
                <p className="text-xs text-white/40">Action, vérité, défi — à tour de rôle</p>
              </div>
            </div>
            <div className="flex gap-1.5 mb-3">
              <PackPill label="Classique" active={partyCardsPack === 'classic'} onClick={() => setPartyCardsPack('classic')} />
              <PackPill
                label="Trash 18+"
                active={partyCardsPack === 'trash'}
                locked={!adultMode}
                onClick={() => adultMode && setPartyCardsPack('trash')}
              />
              <PackPill
                label="Mixte"
                active={partyCardsPack === 'mixed'}
                locked={!adultMode}
                onClick={() => adultMode && setPartyCardsPack('mixed')}
              />
            </div>
            {isHost ? (
              <Button
                fullWidth
                disabled={!canPlayPartyCards}
                onClick={() => startGame('party-cards', { pack: partyCardsPack })}
                className="!py-2.5 text-sm"
              >
                {canPlayPartyCards ? 'Lancer la partie' : 'Il faut au moins 2 joueurs'}
              </Button>
            ) : (
              <p className="text-xs text-white/40 text-center">Seul·e l'hôte peut lancer ce jeu</p>
            )}
          </Card>
        </div>

        <Card delay={0.3} className="text-center">
          <p className="text-sm font-semibold mb-1">📺 Mode écran partagé</p>
          <p className="text-xs text-white/40 mb-3">
            Sur une TV ou un ordinateur, ouvre l'appli et entre le code <b>{group.code}</b> dans "Afficher sur un
            écran".
          </p>
          <Button variant="secondary" fullWidth onClick={() => navigate(`/screen/${group.code}`)} className="!py-2.5 text-sm">
            Ouvrir l'écran ici
          </Button>
        </Card>
      </div>
    </PageTransition>
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

function LockedGameCard({ icon, name, note }: { icon: string; name: string; note: string }) {
  return (
    <div className="glass-card rounded-3xl p-5 opacity-50">
      <div className="flex items-center gap-3">
        <span className="text-3xl grayscale">{icon}</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-white/40">{note}</p>
        </div>
      </div>
    </div>
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
