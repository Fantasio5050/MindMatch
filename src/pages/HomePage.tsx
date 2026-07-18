import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { useSound } from '../hooks/useSound'
import { useAppStore } from '../store/useAppStore'
import { usePartyStore } from '../store/usePartyStore'

type Mode = 'landing' | 'create' | 'join'

const FLOATING_EMOJIS = [
  { emoji: '🎉', top: '8%', left: '10%', duration: 7, delay: 0 },
  { emoji: '🍻', top: '14%', left: '82%', duration: 8.5, delay: 0.6 },
  { emoji: '🎲', top: '78%', left: '86%', duration: 6.5, delay: 1.2 },
  { emoji: '🃏', top: '82%', left: '8%', duration: 9, delay: 0.3 },
  { emoji: '✨', top: '46%', left: '92%', duration: 7.5, delay: 1.8 },
]

export function HomePage() {
  const navigate = useNavigate()
  const { code: prefillCode } = useParams<{ code?: string }>()
  const createGroup = useAppStore((s) => s.createGroup)
  const joinGroup = useAppStore((s) => s.joinGroup)
  const leaveGroup = useAppStore((s) => s.leaveGroup)
  const resumeGroup = useAppStore((s) => s.currentGroup())
  const resumeMember = useAppStore((s) => s.currentMember())
  const { play } = useSound()

  const [mode, setMode] = useState<Mode>(prefillCode ? 'join' : 'landing')
  const [pseudo, setPseudo] = useState('')
  const [groupName, setGroupName] = useState('')
  const [code, setCode] = useState(prefillCode ? prefillCode.toUpperCase() : '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const kicked = usePartyStore((s) => s.kicked)
  const clearKicked = usePartyStore((s) => s.clearKicked)
  const [showKickedNotice, setShowKickedNotice] = useState(false)
  useEffect(() => {
    if (!kicked) return
    setShowKickedNotice(true)
    clearKicked()
  }, [kicked, clearKicked])

  // Reconnexion : si on revient sur le site avec une adhésion encore valide (identité persistée +
  // membre toujours présent dans le salon), on propose de REPRENDRE en tant que le même membre —
  // au lieu de re-rejoindre avec un nouveau pseudo, ce qui laissait un doublon fantôme en jeu.
  const canResume = !!resumeGroup && !!resumeMember
  const handleResume = () => {
    if (!resumeGroup) return
    play('win')
    navigate(resumeGroup.party.status === 'playing' ? '/play' : '/lobby')
  }
  const handleLeaveFromHome = () => {
    play('pop')
    leaveGroup()
  }

  const goTo = (next: Mode) => {
    play('tick')
    setError('')
    setMode(next)
  }

  const handleCreate = async () => {
    if (!pseudo.trim()) return setError('Choisis un pseudo pour continuer.')
    if (!groupName.trim()) return setError('Donne un nom à ton groupe.')
    setError('')
    setSubmitting(true)
    try {
      await createGroup(groupName, pseudo)
      play('win')
      navigate('/lobby')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoin = async () => {
    if (!pseudo.trim()) return setError('Choisis un pseudo pour continuer.')
    if (!code.trim()) return setError('Entre le code du groupe.')
    setError('')
    setSubmitting(true)
    try {
      await joinGroup(code, pseudo)
      play('win')
      navigate('/lobby')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <div className="min-h-svh flex flex-col justify-between px-6 pt-14 pb-10 safe-top relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {FLOATING_EMOJIS.map((f, i) => (
            <span
              key={i}
              className="absolute text-2xl opacity-30 select-none float-bob"
              style={{ top: f.top, left: f.left, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s` }}
            >
              {f.emoji}
            </span>
          ))}
        </div>

        {showKickedNotice && (
          <Card className="relative mb-2 border-pink-500/40 text-center">
            <p className="text-sm text-pink-300">🚪 L'hôte t'a exclu·e du salon.</p>
            <button onClick={() => setShowKickedNotice(false)} className="text-xs text-white/40 mt-1 underline">
              Fermer
            </button>
          </Card>
        )}

        {canResume && !showKickedNotice && (
          <Card className="relative mb-2 border-fuchsia-500/40">
            <p className="text-sm text-white/80 text-center leading-snug">
              Tu es déjà dans le salon <b>{resumeGroup!.name}</b>
              <br />
              en tant que <b>{resumeMember!.pseudo}</b>.
            </p>
            <Button fullWidth onClick={handleResume} className="!py-2.5 text-sm mt-3">
              {resumeGroup!.party.status === 'playing' ? '🎮 Revenir dans la partie' : '↩️ Revenir au salon'}
            </Button>
            <button onClick={handleLeaveFromHome} className="text-xs text-white/40 mt-2 underline w-full text-center">
              Quitter ce salon
            </button>
          </Card>
        )}

        <div className="flex flex-col items-center text-center gap-3 mt-6 relative">
          <motion.div
            initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8, bounce: 0.5 }}
          >
            <span
              className="text-7xl block drop-shadow-[0_0_36px_rgba(217,70,239,0.55)] float-bob"
              style={{ animationDuration: '3.2s' }}
            >
              🧠
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-4xl font-extrabold tracking-tight shimmer-text leading-tight"
          >
            MindMatch Party
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="text-white/60 text-base max-w-xs"
          >
            Ton profil de personnalité + des jeux de soirée synchronisés entre amis, en direct.
          </motion.p>
        </div>

        <div className="w-full max-w-md mx-auto mt-10 relative">
          <AnimatePresence mode="wait">
            {mode === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-3"
              >
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="rounded-2xl relative"
                >
                  {/* Halo pulsé en CSS (opacity sur une ombre statique) : animer box-shadow via JS
                      forçait un repaint complet du bouton à chaque frame, en continu. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl glow-pulse pointer-events-none"
                    style={{ boxShadow: '0 0 28px rgba(217,70,239,0.45)' }}
                  />
                  <Button fullWidth onClick={() => goTo('create')}>
                    ✨ Créer un groupe
                  </Button>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                  <Button fullWidth variant="secondary" onClick={() => goTo('join')}>
                    🔑 Rejoindre avec un code
                  </Button>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
                  <Button fullWidth variant="ghost" onClick={() => navigate('/screen')}>
                    📺 Afficher sur un écran (TV)
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {mode === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <h2 className="text-lg font-bold mb-4">Nouveau groupe</h2>
                  <div className="flex flex-col gap-3">
                    <Field label="Nom du groupe" value={groupName} onChange={setGroupName} placeholder="Les Inséparables" />
                    <Field label="Ton pseudo" value={pseudo} onChange={setPseudo} placeholder="Alex" />
                    {error && <p className="text-sm text-pink-400">{error}</p>}
                    <Button fullWidth onClick={handleCreate} disabled={submitting} className="mt-1">
                      {submitting ? 'Création…' : 'Créer et commencer'}
                    </Button>
                    <Button fullWidth variant="ghost" onClick={() => goTo('landing')} disabled={submitting}>
                      ← Retour
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {mode === 'join' && (
              <motion.div
                key="join"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <h2 className="text-lg font-bold mb-4">Rejoindre un groupe</h2>
                  <div className="flex flex-col gap-3">
                    <Field
                      label="Code du groupe"
                      value={code}
                      onChange={(v) => setCode(v.toUpperCase())}
                      placeholder="AB3XZ"
                      uppercase
                    />
                    <Field label="Ton pseudo" value={pseudo} onChange={setPseudo} placeholder="Sam" />
                    {error && <p className="text-sm text-pink-400">{error}</p>}
                    <Button fullWidth onClick={handleJoin} disabled={submitting} className="mt-1">
                      {submitting ? 'Connexion…' : 'Rejoindre et commencer'}
                    </Button>
                    <Button fullWidth variant="ghost" onClick={() => goTo('landing')} disabled={submitting}>
                      ← Retour
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-white/30 mt-10 relative">
          Quiz de personnalité · jeux de soirée · XP & badges entre amis
        </p>
      </div>
    </PageTransition>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  uppercase,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  uppercase?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-xs font-medium text-white/50 pl-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={24}
        className={`rounded-2xl bg-white/8 border border-white/10 px-4 py-3.5 text-base text-white placeholder-white/30 outline-none focus:border-fuchsia-400/60 transition-colors ${uppercase ? 'uppercase tracking-widest' : ''}`}
      />
    </label>
  )
}
