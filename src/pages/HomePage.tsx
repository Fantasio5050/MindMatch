import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { Surface } from '../components/Card'
import { Button } from '../components/Button'
import { useSound } from '../hooks/useSound'
import { useAppStore } from '../store/useAppStore'
import { usePartyStore } from '../store/usePartyStore'
import { GAME_LIBRARY } from '../data/gameLibrary'

type Mode = 'landing' | 'create' | 'join'

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
        {showKickedNotice && (
          <Surface className="relative mb-2 border-blood/50 text-center">
            <p className="text-sm text-chalk">L'hôte t'a exclu·e du salon.</p>
            <button onClick={() => setShowKickedNotice(false)} className="text-xs text-chalk-soft mt-1 underline">
              Fermer
            </button>
          </Surface>
        )}

        {canResume && !showKickedNotice && (
          <Surface className="relative mb-2 border-spark-dim/60">
            <p className="text-sm text-chalk-muted text-center leading-snug">
              Tu es déjà dans le salon <b className="text-chalk">{resumeGroup!.name}</b>
              <br />
              en tant que <b className="text-chalk">{resumeMember!.pseudo}</b>.
            </p>
            <Button fullWidth onClick={handleResume} className="mt-3">
              {resumeGroup!.party.status === 'playing' ? 'Revenir dans la partie' : 'Revenir au salon'}
            </Button>
            <button onClick={handleLeaveFromHome} className="text-xs text-chalk-soft mt-2 underline w-full text-center">
              Quitter ce salon
            </button>
          </Surface>
        )}

        {/* ---- Premier contact ----
             Avant : un cerveau emoji flottant, cinq emojis à la dérive, un titre chatoyant et
             « Ton profil de personnalité + des jeux de soirée synchronisés ». On annonçait des
             fonctionnalités — donc une application. Ici on annonce une soirée : le nom en grand,
             une promesse qui parle de la pièce, et rien d'autre à regarder. */}
        <div className="flex flex-col items-center text-center mt-8 relative">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="kicker text-2xs mb-3"
          >
            Le jeu de la table
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1.02, 0.3, 1] }}
            className="font-stage text-chalk leading-[0.86]"
            style={{ fontSize: 'clamp(3.25rem, 17vw, 4.75rem)' }}
          >
            MindMatch
            <br />
            <span className="text-spark">Party</span>
          </motion.h1>

          {/* Le liseré laiton : le bord de la table, sous le nom. */}
          <motion.span
            aria-hidden
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="block h-px w-32 bg-brass-dim mt-5 mb-4 origin-center"
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42, duration: 0.4 }}
            className="text-chalk-muted text-base leading-snug"
          >
            Vos téléphones deviennent des manettes.
            <br />
            La soirée devient un jeu.
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
                {/* Trois entrées, une seule mise en avant : on ouvre la table, ou on s'y assied.
                    L'écran TV vient après — c'est un geste d'hôte, pas un premier réflexe. */}
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
                  <Button fullWidth onClick={() => goTo('create')}>
                    Créer un groupe
                  </Button>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                  <Button fullWidth variant="secondary" onClick={() => goTo('join')}>
                    Rejoindre avec un code
                  </Button>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
                  <Button fullWidth variant="ghost" onClick={() => navigate('/screen')}>
                    Afficher sur un écran (TV)
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
                <Surface level="raised">
                  <h2 className="font-display text-xl text-chalk mb-4">Nouveau groupe</h2>
                  <div className="flex flex-col gap-3">
                    <Field label="Nom du groupe" value={groupName} onChange={setGroupName} placeholder="Les Inséparables" />
                    <Field label="Ton pseudo" value={pseudo} onChange={setPseudo} placeholder="Alex" />
                    {error && <p className="text-sm text-blood">{error}</p>}
                    <Button fullWidth onClick={handleCreate} disabled={submitting} className="mt-1">
                      {submitting ? 'Création…' : 'Créer et commencer'}
                    </Button>
                    <Button fullWidth variant="ghost" onClick={() => goTo('landing')} disabled={submitting}>
                      Retour
                    </Button>
                  </div>
                </Surface>
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
                <Surface level="raised">
                  <h2 className="font-display text-xl text-chalk mb-4">Rejoindre un groupe</h2>
                  <div className="flex flex-col gap-3">
                    <Field
                      label="Code du groupe"
                      value={code}
                      onChange={(v) => setCode(v.toUpperCase())}
                      placeholder="AB3XZ"
                      uppercase
                    />
                    <Field label="Ton pseudo" value={pseudo} onChange={setPseudo} placeholder="Sam" />
                    {error && <p className="text-sm text-blood">{error}</p>}
                    <Button fullWidth onClick={handleJoin} disabled={submitting} className="mt-1">
                      {submitting ? 'Connexion…' : 'Rejoindre et commencer'}
                    </Button>
                    <Button fullWidth variant="ghost" onClick={() => goTo('landing')} disabled={submitting}>
                      Retour
                    </Button>
                  </div>
                </Surface>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Le pied de page dit ce qu'il faut pour jouer ce soir, pas ce que l'app sait faire. */}
        <p className="text-center text-xs text-chalk-faint mt-10 relative">
          {GAME_LIBRARY.length} jeux · 2 à 12 joueurs · un téléphone chacun
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
      <span className="text-xs font-medium text-chalk-soft pl-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={24}
        className={`rounded-control bg-felt border border-line px-4 py-3.5 text-base text-chalk placeholder:text-chalk-faint outline-none focus:border-spark transition-colors ${uppercase ? 'uppercase tracking-widest' : ''}`}
      />
    </label>
  )
}
