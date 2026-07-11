import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { useAppStore } from '../store/useAppStore'

type Mode = 'landing' | 'create' | 'join'

export function HomePage() {
  const navigate = useNavigate()
  const createGroup = useAppStore((s) => s.createGroup)
  const joinGroup = useAppStore((s) => s.joinGroup)

  const [mode, setMode] = useState<Mode>('landing')
  const [pseudo, setPseudo] = useState('')
  const [groupName, setGroupName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!pseudo.trim()) return setError('Choisis un pseudo pour continuer.')
    if (!groupName.trim()) return setError('Donne un nom à ton groupe.')
    setError('')
    setSubmitting(true)
    try {
      await createGroup(groupName, pseudo)
      navigate('/quiz')
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
      navigate('/quiz')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <div className="min-h-svh flex flex-col justify-between px-6 pt-14 pb-10 safe-top">
        <div className="flex flex-col items-center text-center gap-3 mt-6">
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.7 }}
            className="text-6xl mb-2"
          >
            🧠
          </motion.div>
          <h1 className="text-4xl font-extrabold tracking-tight shimmer-text">MindMatch</h1>
          <p className="text-white/60 text-base max-w-xs">
            Découvre ta personnalité et compare-toi à tes amis, en quelques minutes.
          </p>
        </div>

        <div className="w-full max-w-md mx-auto mt-10">
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
                <Button
                  fullWidth
                  onClick={() => {
                    setError('')
                    setMode('create')
                  }}
                >
                  ✨ Créer un groupe
                </Button>
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => {
                    setError('')
                    setMode('join')
                  }}
                >
                  🔑 Rejoindre avec un code
                </Button>
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
                    <Button fullWidth variant="ghost" onClick={() => setMode('landing')} disabled={submitting}>
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
                    <Button fullWidth variant="ghost" onClick={() => setMode('landing')} disabled={submitting}>
                      ← Retour
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-white/30 mt-10">
          30 questions · 5 minutes · résultats instantanés
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
