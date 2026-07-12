import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { usePartyStore } from '../store/usePartyStore'
import { PartyGameShell } from '../party/PartyGameShell'

export function ScreenPage() {
  const { code } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const connectAsSpectator = usePartyStore((s) => s.connectAsSpectator)
  const partyError = usePartyStore((s) => s.error)
  const [input, setInput] = useState('')

  useEffect(() => {
    if (code) connectAsSpectator(code.toUpperCase())
  }, [code, connectAsSpectator])

  if (!code) {
    return (
      <PageTransition>
        <div className="min-h-svh flex flex-col items-center justify-center px-6">
          <span className="text-5xl mb-4">📺</span>
          <h1 className="text-2xl font-extrabold mb-6">Écran partagé</h1>
          <Card className="w-full max-w-sm">
            <label className="flex flex-col gap-1.5 text-left mb-4">
              <span className="text-xs font-medium text-white/50 pl-1">Code de la salle</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="AB3XZ"
                maxLength={5}
                className="rounded-2xl bg-white/8 border border-white/10 px-4 py-3.5 text-base uppercase tracking-widest text-white placeholder-white/30 outline-none focus:border-fuchsia-400/60"
              />
            </label>
            <Button fullWidth disabled={!input.trim()} onClick={() => navigate(`/screen/${input.trim()}`)}>
              Afficher
            </Button>
          </Card>
        </div>
      </PageTransition>
    )
  }

  if (partyError) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6 text-center">
        <p className="text-pink-300">{partyError}</p>
      </div>
    )
  }

  return <PartyGameShell mode="screen" />
}
