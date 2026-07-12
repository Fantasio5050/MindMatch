import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { useAppStore } from '../store/useAppStore'
import { usePartyStore } from '../store/usePartyStore'
import { levelProgress } from '../lib/xp'
import { BADGE_MAP } from '../data/badges'

const UPCOMING_GAMES = [
  { icon: '🕵️', name: 'Devine ma réponse' },
  { icon: '⚖️', name: 'Dilemmes & Débats' },
  { icon: '🃏', name: 'Cartes de soirée' },
  { icon: '✍️', name: 'Qui a écrit ça ?' },
  { icon: '🔍', name: 'Profil secret' },
]

export function LobbyPage() {
  const navigate = useNavigate()
  const identity = useAppStore((s) => s.identity)
  const appGroup = useAppStore((s) => s.currentGroup())
  const refreshGroup = useAppStore((s) => s.refreshGroup)

  const connectAsPlayer = usePartyStore((s) => s.connectAsPlayer)
  const startGame = usePartyStore((s) => s.startGame)
  const partyGroup = usePartyStore((s) => s.group)
  const onlinePlayerIds = usePartyStore((s) => s.onlinePlayerIds)
  const isHost = usePartyStore((s) => s.isHost())
  const partyError = usePartyStore((s) => s.error)
  const clearError = usePartyStore((s) => s.clearError)

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!identity) return
    refreshGroup()
    connectAsPlayer()
  }, [identity, refreshGroup, connectAsPlayer])

  useEffect(() => {
    if (partyGroup?.party.status === 'playing') navigate('/play')
  }, [partyGroup?.party.status, navigate])

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
  const canPlayMostLikely = group.members.length >= 3

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(group.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable, ignore silently
    }
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

          {UPCOMING_GAMES.map((g, i) => (
            <motion.div
              key={g.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 * i }}
              className="glass-card rounded-3xl p-5 opacity-40"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl grayscale">{g.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{g.name}</p>
                  <p className="text-xs text-white/40">Bientôt disponible</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <Card delay={0.2} className="text-center">
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
