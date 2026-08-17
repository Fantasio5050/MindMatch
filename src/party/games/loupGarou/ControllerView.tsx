import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../../../store/usePartyStore'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { ROLE_NAMES, ROLE_ICONS, ROLE_DESCRIPTIONS } from './types'
import type { LoupGarouClientState } from './types'
import type { Member } from '../../../types'

export function LoupGarouController() {
  const navigate = useNavigate()
  const group = usePartyStore((s) => s.group)
  const currentMember = usePartyStore((s) => s.currentMember())
  const isHost = usePartyStore((s) => s.isHost())
  const hostAdvance = usePartyStore((s) => s.hostAdvance)
  const sendAction = usePartyStore((s) => s.sendAction)
  const state = (group?.party.roundData as LoupGarouClientState | null) ?? null

  if (!group || !currentMember || !state) {
    return (
      <div className="min-h-svh flex items-center justify-center px-6">
        <p className="text-chalk-soft text-sm">Chargement…</p>
      </div>
    )
  }

  if (state.winner) {
    return <FinalScreen winner={state.winner} onExit={() => navigate('/lobby')} />
  }

  const { party } = group
  const members = group.members
  const yourRole = state.yourRole

  // Phase: role-reveal
  if (party.phase === 'role-reveal') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-6">
          Découvre ton rôle
        </p>
        {yourRole && (
          <Card className="text-center mb-6">
            <span className="text-6xl mb-4 block">{ROLE_ICONS[yourRole]}</span>
            <p className="text-2xl font-bold mb-2">{ROLE_NAMES[yourRole]}</p>
            <p className="text-sm text-chalk-soft">{ROLE_DESCRIPTIONS[yourRole]}</p>
          </Card>
        )}
        {state.loupsMembers && state.loupsMembers.length > 1 && yourRole === 'loup-garou' && (
          <Card className="mb-6">
            <p className="text-xs text-chalk-faint mb-2">Tes complices loups :</p>
            {state.loupsMembers.filter(id => id !== currentMember.id).map(id => {
              const m = members.find(mm => mm.id === id)
              return m ? (
                <div key={id} className="flex items-center gap-2 mb-1">
                  <Avatar pseudo={m.pseudo} color={m.color} size={28} />
                  <span className="text-sm">{m.pseudo}</span>
                </div>
              ) : null
            })}
          </Card>
        )}
        {state.yourLover && (
          <Card className="mb-6 text-center">
            <p className="text-xs text-chalk-faint mb-1">💘 Tu es amoureux·se de</p>
            <p className="text-lg font-bold">{state.yourLover.pseudo}</p>
            <p className="text-xs text-chalk-faint mt-1">Si l'un de vous meurt, l'autre se suicide.</p>
          </Card>
        )}
        {isHost ? (
          <Button fullWidth onClick={() => sendAction('start', {})}>
            🌙 Lancer la première nuit
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">L'hôte va lancer la partie…</p>
        )}
      </div>
    )
  }

  // Phase: night
  if (party.phase === 'night') {
    return <NightPhase state={state} members={members} currentMember={currentMember} sendAction={sendAction} />
  }

  // Phase: day
  if (party.phase === 'day') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">Jour {state.dayNumber}</p>
        <Card className="text-center mb-6">
          <p className="text-2xl font-bold mb-2">☀️ Le village se réveille</p>
          {state.dead.filter(d => !state.dead.find(dd => dd.memberId === d.memberId && dd.cause.includes('vote'))).length > 0 ? (
            <>
              <p className="text-sm text-chalk-soft mb-2">Cette nuit, il y a eu des morts :</p>
              {state.dead.filter(d => d.cause.includes('nuit')).map(d => {
                const m = members.find(mm => mm.id === d.memberId)
                return (
                  <div key={d.memberId} className="flex items-center justify-center gap-2 mb-1">
                    <Avatar pseudo={m?.pseudo ?? '?'} color={m?.color ?? '#fff'} size={28} />
                    <span className="text-sm">{m?.pseudo}</span>
                    <span className="text-xs text-chalk-faint">{ROLE_ICONS[d.role]}</span>
                  </div>
                )
              })}
            </>
          ) : (
            <p className="text-sm text-emerald-300">Personne n'est mort cette nuit ! 🎉</p>
          )}
        </Card>
        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>
            🗳️ Passer au vote
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">Discussion libre… L'hôte lancera le vote.</p>
        )}
      </div>
    )
  }

  // Phase: vote
  if (party.phase === 'vote') {
    return <VotePhase state={state} members={members} currentMember={currentMember} sendAction={sendAction} />
  }

  // Phase: reveal
  if (party.phase === 'reveal') {
    const lastDeath = state.dead[state.dead.length - 1]
    const lastMember = members.find(m => m.id === lastDeath?.memberId)
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-4">Révélation</p>
        <Card className="text-center mb-6">
          {lastDeath && lastMember ? (
            <>
              <p className="text-lg font-bold mb-2">{lastMember.pseudo} a été éliminé·e</p>
              <p className="text-4xl mb-2">{ROLE_ICONS[lastDeath.role]}</p>
              <p className="text-sm text-chalk-soft">{ROLE_NAMES[lastDeath.role]}</p>
            </>
          ) : (
            <p className="text-lg font-bold">Personne n'a été éliminé·e</p>
          )}
        </Card>
        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>
            🌙 Nuit suivante
          </Button>
        ) : (
          <p className="text-center text-chalk-faint text-sm">En attente de l'hôte…</p>
        )}
      </div>
    )
  }

  // Phase: hunter-shot
  if (party.phase === 'hunter-shot') {
    return <HunterShotPhase state={state} members={members} currentMember={currentMember} sendAction={sendAction} />
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Chargement…</p>
    </div>
  )
}

function NightPhase({ state, members, currentMember, sendAction }: {
  state: LoupGarouClientState
  members: Member[]
  currentMember: { id: string; pseudo: string; color: string }
  sendAction: (type: string, payload: unknown) => void
}) {
  const yourRole = state.yourRole
  const isYourStep = state.currentVoter === currentMember.id
  const step = state.currentNightStep

  if (!isYourStep) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 gap-4">
        <span className="text-5xl">🌙</span>
        <p className="text-xl font-bold">Nuit {state.dayNumber}</p>
        <p className="text-chalk-soft text-sm text-center">
          {step ? `${ROLE_NAMES[yourRole ?? 'villageois']}, ce n'est pas ton tour…` : 'La nuit se déroule…'}
        </p>
        <p className="text-chalk-faint text-xs">Garde ton téléphone éteint si ce n'est pas ton rôle.</p>
      </div>
    )
  }

  // Your turn based on role
  const aliveMembers = members.filter(m => state.alive.includes(m.id) && m.id !== currentMember.id)

  if (step === 'cupidon') {
    const [target1, setTarget1] = useState<string | null>(null)
    const [target2, setTarget2] = useState<string | null>(null)
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">🏹 Cupidon</p>
        <p className="text-lg font-bold text-center mb-4">Choisis 2 amoureux</p>
        <div className="flex flex-col gap-2 mb-4">
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => target1 === m.id ? setTarget1(null) : target2 === m.id ? setTarget2(null) : !target1 ? setTarget1(m.id) : setTarget2(m.id)}
              className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${
                target1 === m.id || target2 === m.id ? 'border-rose-400/40 bg-rose-500/10' : 'border-line bg-felt-raised'
              }`}
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={32} />
              <span className="text-sm">{m.pseudo}</span>
              {target1 === m.id && <span className="text-xs text-rose-300">💘 1</span>}
              {target2 === m.id && <span className="text-xs text-rose-300">💘 2</span>}
            </button>
          ))}
        </div>
        <Button fullWidth disabled={!target1 || !target2} onClick={() => sendAction('cupidon-link', { target1, target2 })}>
          Valider
        </Button>
      </div>
    )
  }

  if (step === 'voyante') {
    const [target, setTarget] = useState<string | null>(null)
    const result = state.voyanteResult
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">🔮 Voyante</p>
        {result ? (
          <Card className="text-center mb-6">
            <p className="text-sm text-chalk-soft mb-2">Tu as examiné :</p>
            <p className="text-lg font-bold mb-2">{members.find(m => m.id === result.memberId)?.pseudo}</p>
            <p className="text-3xl mb-1">{ROLE_ICONS[result.role]}</p>
            <p className="text-sm font-bold">{ROLE_NAMES[result.role]}</p>
          </Card>
        ) : (
          <>
            <p className="text-lg font-bold text-center mb-4">Choisis un joueur à examiner</p>
            <div className="flex flex-col gap-2 mb-4">
              {aliveMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => setTarget(m.id)}
                  className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${
                    target === m.id ? 'border-sky-400/40 bg-sky-500/10' : 'border-line bg-felt-raised'
                  }`}
                >
                  <Avatar pseudo={m.pseudo} color={m.color} size={32} />
                  <span className="text-sm">{m.pseudo}</span>
                </button>
              ))}
            </div>
            <Button fullWidth disabled={!target} onClick={() => sendAction('voyante-check', { targetId: target })}>
              Examiner
            </Button>
          </>
        )}
      </div>
    )
  }

  if (step === 'salvateur') {
    const [target, setTarget] = useState<string | null>(null)
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">🛡️ Salvateur</p>
        <p className="text-lg font-bold text-center mb-4">Choisis qui protéger</p>
        <div className="flex flex-col gap-2 mb-4">
          {members.filter(m => state.alive.includes(m.id)).map(m => (
            <button
              key={m.id}
              onClick={() => setTarget(m.id)}
              className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${
                target === m.id ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-line bg-felt-raised'
              }`}
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={32} />
              <span className="text-sm">{m.pseudo}</span>
              {m.id === currentMember.id && <span className="text-xs text-chalk-faint">(toi)</span>}
            </button>
          ))}
        </div>
        <Button fullWidth disabled={!target} onClick={() => sendAction('salvateur-protect', { targetId: target })}>
          Protéger
        </Button>
      </div>
    )
  }

  if (step === 'loups') {
    const [target, setTarget] = useState<string | null>(null)
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">🐺 Loups-Garous</p>
        {state.loupsMembers && state.loupsMembers.length > 1 && (
          <Card className="mb-4">
            <p className="text-xs text-chalk-faint mb-1">Tes complices :</p>
            {state.loupsMembers.filter(id => id !== currentMember.id).map(id => {
              const m = members.find(mm => mm.id === id)
              return m ? (
                <div key={id} className="flex items-center gap-2">
                  <Avatar pseudo={m.pseudo} color={m.color} size={24} />
                  <span className="text-xs">{m.pseudo}</span>
                </div>
              ) : null
            })}
          </Card>
        )}
        <p className="text-lg font-bold text-center mb-4">Choisis une victime</p>
        <div className="flex flex-col gap-2 mb-4">
          {aliveMembers.map(m => (
            <button
              key={m.id}
              onClick={() => setTarget(m.id)}
              className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${
                target === m.id ? 'border-red-400/40 bg-red-500/10' : 'border-line bg-felt-raised'
              }`}
            >
              <Avatar pseudo={m.pseudo} color={m.color} size={32} />
              <span className="text-sm">{m.pseudo}</span>
            </button>
          ))}
        </div>
        <Button fullWidth disabled={!target} onClick={() => sendAction('loup-vote', { targetId: target })}>
          Dévorer
        </Button>
      </div>
    )
  }

  if (step === 'sorciere') {
    const [killTarget, setKillTarget] = useState<string | null>(null)
    const [showKill, setShowKill] = useState(false)
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">🧪 Sorcière</p>
        <Card className="text-center mb-4">
          <p className="text-sm text-chalk-soft mb-2">Les loups ont attaqué :</p>
          <p className="text-lg font-bold">{state.killTarget ? members.find(m => m.id === state.killTarget)?.pseudo : 'Personne'}</p>
        </Card>
        <div className="flex flex-col gap-3">
          {!state.sorciereHealUsed && state.killTarget && (
            <Button fullWidth onClick={() => sendAction('sorciere-heal', {})}>
              💚 Sauver la victime (1 seule fois)
            </Button>
          )}
          {!state.sorciereKillUsed && (
            <>
              {!showKill ? (
                <Button fullWidth variant="secondary" onClick={() => setShowKill(true)}>
                  💀 Empoisonner quelqu'un (1 seule fois)
                </Button>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {aliveMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setKillTarget(m.id)}
                        className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${
                          killTarget === m.id ? 'border-red-400/40 bg-red-500/10' : 'border-line bg-felt-raised'
                        }`}
                      >
                        <Avatar pseudo={m.pseudo} color={m.color} size={32} />
                        <span className="text-sm">{m.pseudo}</span>
                      </button>
                    ))}
                  </div>
                  <Button fullWidth disabled={!killTarget} onClick={() => sendAction('sorciere-kill', { targetId: killTarget })}>
                    Empoisonner
                  </Button>
                </>
              )}
            </>
          )}
          <Button fullWidth variant="secondary" onClick={() => sendAction('sorciere-pass', {})}>
            Passer
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'petite-fille') {
    return (
      <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
        <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">👀 Petite Fille</p>
        <Card className="text-center mb-6">
          <p className="text-sm text-chalk-soft mb-4">Tu espionnes les loups…</p>
          {state.petiteFilleInfo && state.petiteFilleInfo.length > 0 ? (
            <>
              <p className="text-xs text-chalk-faint mb-2">Les loups-garous sont :</p>
              {state.petiteFilleInfo.map(id => {
                const m = members.find(mm => mm.id === id)
                return m ? (
                  <div key={id} className="flex items-center justify-center gap-2 mb-1">
                    <Avatar pseudo={m.pseudo} color={m.color} size={28} />
                    <span className="text-sm font-bold">{m.pseudo}</span>
                  </div>
                ) : null
              })}
            </>
          ) : (
            <p className="text-sm text-chalk-faint">Tu n'as rien vu cette nuit…</p>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Nuit en cours…</p>
    </div>
  )
}

function VotePhase({ state, members, currentMember, sendAction }: {
  state: LoupGarouClientState
  members: Member[]
  currentMember: { id: string; pseudo: string; color: string }
  sendAction: (type: string, payload: unknown) => void
}) {
  const [target, setTarget] = useState<string | null>(null)
  const hasVoted = currentMember.id in (state.dayVotes ?? {})
  const aliveMembers = members.filter(m => state.alive.includes(m.id) && m.id !== currentMember.id)

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">Jour {state.dayNumber} — Vote</p>
      <p className="text-lg font-bold text-center mb-4">Qui est un loup-garou ?</p>
      {hasVoted ? (
        <Card className="text-center">
          <p className="text-sm text-chalk-soft">Tu as voté. En attente des autres…</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-4">
            {aliveMembers.map(m => (
              <button
                key={m.id}
                onClick={() => setTarget(m.id)}
                className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${
                  target === m.id ? 'border-red-400/40 bg-red-500/10' : 'border-line bg-felt-raised'
                }`}
              >
                <Avatar pseudo={m.pseudo} color={m.color} size={32} />
                <span className="text-sm">{m.pseudo}</span>
              </button>
            ))}
          </div>
          <Button fullWidth disabled={!target} onClick={() => sendAction('day-vote', { targetId: target })}>
            Voter contre
          </Button>
        </>
      )}
    </div>
  )
}

function HunterShotPhase({ state, members, currentMember, sendAction }: {
  state: LoupGarouClientState
  members: Member[]
  currentMember: { id: string; pseudo: string; color: string }
  sendAction: (type: string, payload: unknown) => void
}) {
  const [target, setTarget] = useState<string | null>(null)
  // The hunter is the last dead person
  const lastDeath = state.dead[state.dead.length - 1]
  const isHunter = lastDeath?.memberId === currentMember.id
  const aliveMembers = members.filter(m => state.alive.includes(m.id))

  if (!isHunter) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 gap-4">
        <span className="text-5xl">🔫</span>
        <p className="text-lg font-bold">Le chasseur va tirer…</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="text-xs uppercase tracking-widest text-chalk-faint text-center mb-2">🔫 Chasseur</p>
      <p className="text-lg font-bold text-center mb-4">Tu meurs… mais tu emportes quelqu'un !</p>
      <div className="flex flex-col gap-2 mb-4">
        {aliveMembers.map(m => (
          <button
            key={m.id}
            onClick={() => setTarget(m.id)}
            className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${
              target === m.id ? 'border-red-400/40 bg-red-500/10' : 'border-line bg-felt-raised'
            }`}
          >
            <Avatar pseudo={m.pseudo} color={m.color} size={32} />
            <span className="text-sm">{m.pseudo}</span>
          </button>
        ))}
      </div>
      <Button fullWidth disabled={!target} onClick={() => sendAction('hunter-shoot', { targetId: target })}>
        Tirer
      </Button>
    </div>
  )
}

function FinalScreen({ winner, onExit }: { winner: 'village' | 'loups' | 'lovers'; onExit: () => void }) {
  const message = winner === 'village' ? '🛡️ Le village a gagné !' : winner === 'loups' ? '🐺 Les loups ont gagné !' : '💘 Les amoureux ont gagné !'
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 gap-6">
      <span className="text-6xl">{winner === 'village' ? '🛡️' : winner === 'loups' ? '🐺' : '💘'}</span>
      <p className="text-3xl font-extrabold text-center">{message}</p>
      <Button onClick={onExit}>Retour au salon</Button>
    </div>
  )
}