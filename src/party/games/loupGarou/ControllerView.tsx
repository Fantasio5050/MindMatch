import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePartyStore } from '../../../store/usePartyStore'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Avatar } from '../../../components/Avatar'
import { ROLE_NAMES, ROLE_ICONS, ROLE_DESCRIPTIONS } from './types'
import type { LoupGarouClientState } from './types'
import type { Member } from '../../../types'

type Send = (type: string, payload: unknown) => void

/**
 * Téléphone du Loup-Garou.
 *
 * Chaque étape de nuit est un composant à part. L'ancienne version appelait `useState` à
 * l'intérieur de `if (step === …)` : le composant passait de zéro à deux hooks au moment où venait
 * le tour du joueur, et React plantait (« Rendered more hooks than during the previous render »)
 * — précisément quand un rôle de nuit devait agir.
 */
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
        <p className="text-chalk-soft text-sm">Le village s'installe…</p>
      </div>
    )
  }

  const members = group.members
  const me = currentMember.id
  const byId = (id: string | null | undefined) => members.find((m) => m.id === id)

  if (state.winner) {
    return <FinalScreen state={state} members={members} onExit={() => navigate('/lobby')} />
  }

  const iAmDead = state.players.includes(me) && !state.alive.includes(me)
  const role = state.yourRole

  if (state.phase === 'role-reveal') {
    return (
      <Screen kicker="Ton rôle — garde-le pour toi">
        {role ? <RoleCard role={role} /> : <Card className="text-center mb-6"><p className="text-chalk-soft">Tu regardes cette partie.</p></Card>}
        {role === 'loup-garou' && <Pack ids={state.loupsMembers ?? []} me={me} members={members} />}
        {isHost ? (
          <Button fullWidth onClick={() => sendAction('start', {})}>Lancer la première nuit</Button>
        ) : (
          <p className="text-center text-chalk-soft text-sm">L'hôte lance la première nuit</p>
        )}
      </Screen>
    )
  }

  if (state.phase === 'night') {
    if (!state.yourStep) {
      return (
        <Screen kicker={`Nuit ${state.dayNumber}`}>
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <p className="font-display text-2xl text-chalk">Le village dort</p>
            <p className="text-sm text-chalk-soft">
              {iAmDead ? 'Tu observes la partie depuis l’au-delà.' : 'Pose ton téléphone écran contre la table : ton tour viendra peut-être.'}
            </p>
            {role && !iAmDead && <p className="text-xs text-chalk-faint">{ROLE_ICONS[role]} {ROLE_NAMES[role]}</p>}
          </div>
          {isHost && <HostSkip onSkip={hostAdvance} label="Passer l’étape en cours (joueur absent)" />}
        </Screen>
      )
    }
    const step = state.currentNightStep
    if (step === 'cupidon') return <CupidonStep state={state} members={members} send={sendAction} />
    if (step === 'voyante') return <VoyanteStep state={state} members={members} me={me} send={sendAction} />
    if (step === 'salvateur') return <SalvateurStep state={state} members={members} me={me} send={sendAction} />
    if (step === 'loups') return <LoupsStep state={state} members={members} me={me} send={sendAction} />
    if (step === 'sorciere') return <SorciereStep state={state} members={members} me={me} send={sendAction} />
    if (step === 'petite-fille') return <PetiteFilleStep state={state} members={members} send={sendAction} />
  }

  if (state.phase === 'day') {
    const deaths = state.lastNightDeaths
    return (
      <Screen kicker={`Jour ${state.dayNumber}`}>
        <Card className="text-center mb-4">
          <p className="font-display text-xl text-chalk mb-3">Le village se réveille</p>
          {deaths.length > 0 ? (
            deaths.map((id) => {
              const d = state.dead.find((x) => x.memberId === id)
              const m = byId(id)
              return (
                <div key={id} className="flex items-center justify-center gap-2 mb-1">
                  <Avatar pseudo={m?.pseudo ?? '?'} color={m?.color ?? '#888'} size={28} photoUrl={m?.photoUrl} />
                  <span className="text-sm text-chalk">{m?.pseudo}</span>
                  {d && <span className="text-xs text-chalk-soft">{ROLE_ICONS[d.role]} {ROLE_NAMES[d.role]} · {d.cause}</span>}
                </div>
              )
            })
          ) : (
            <p className="text-sm text-jade">Personne n'est mort cette nuit.</p>
          )}
        </Card>
        <PrivateNotes state={state} members={members} />
        <p className="text-center text-sm text-chalk-soft mb-4">Débattez : qui est loup ?</p>
        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>Ouvrir le vote</Button>
        ) : (
          <p className="text-center text-chalk-faint text-xs">L'hôte ouvrira le vote</p>
        )}
      </Screen>
    )
  }

  if (state.phase === 'vote') {
    return <VoteStep state={state} members={members} me={me} dead={iAmDead} send={sendAction} isHost={isHost} onClose={hostAdvance} />
  }

  if (state.phase === 'reveal') {
    const eliminated = state.dayDeaths
    return (
      <Screen kicker={`Jour ${state.dayNumber} — verdict`}>
        <Card className="text-center mb-6">
          {eliminated.length > 0 ? (
            eliminated.map((d) => (
              <div key={d.memberId} className="mb-2">
                <p className="font-display text-lg text-chalk">{byId(d.memberId)?.pseudo} · {d.cause}</p>
                <p className="text-sm text-chalk-soft">{ROLE_ICONS[d.role]} {ROLE_NAMES[d.role]}</p>
              </div>
            ))
          ) : (
            <p className="font-display text-lg text-chalk">Égalité : personne n'est éliminé</p>
          )}
        </Card>
        {isHost ? (
          <Button fullWidth onClick={() => hostAdvance()}>La nuit tombe</Button>
        ) : (
          <p className="text-center text-chalk-soft text-sm">L'hôte fait tomber la nuit</p>
        )}
      </Screen>
    )
  }

  if (state.phase === 'hunter-shot') {
    return <HunterStep state={state} members={members} me={me} send={sendAction} isHost={isHost} onSkip={hostAdvance} />
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <p className="text-chalk-soft text-sm">Le village s'installe…</p>
    </div>
  )
}

// ─── Mise en page commune ─────────────────────────────────────────────────

function Screen({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col px-6 pt-[4.5rem] pb-10 safe-top">
      <p className="kicker text-2xs text-center mb-4">{kicker}</p>
      {children}
    </div>
  )
}

function RoleCard({ role }: { role: NonNullable<LoupGarouClientState['yourRole']> }) {
  return (
    <Card className="text-center mb-4">
      <span className="text-6xl mb-3 block">{ROLE_ICONS[role]}</span>
      <p className="font-display text-2xl text-chalk mb-2">{ROLE_NAMES[role]}</p>
      <p className="text-sm text-chalk-soft">{ROLE_DESCRIPTIONS[role]}</p>
    </Card>
  )
}

function Pack({ ids, me, members }: { ids: string[]; me: string; members: Member[] }) {
  const mates = ids.filter((id) => id !== me)
  if (mates.length === 0) return null
  return (
    <Card className="mb-4">
      <p className="text-xs text-chalk-faint mb-2">Ta meute</p>
      {mates.map((id) => {
        const m = members.find((x) => x.id === id)
        return m ? (
          <div key={id} className="flex items-center gap-2 mb-1">
            <Avatar pseudo={m.pseudo} color={m.color} size={24} photoUrl={m.photoUrl} />
            <span className="text-sm text-chalk">{m.pseudo}</span>
          </div>
        ) : null
      })}
    </Card>
  )
}

/** Ce que ce joueur sait et que les autres ignorent : amour, dernière vision, espionnage. */
function PrivateNotes({ state, members }: { state: LoupGarouClientState; members: Member[] }) {
  const name = (id: string) => members.find((m) => m.id === id)?.pseudo ?? '?'
  const notes: string[] = []
  if (state.yourLover) notes.push(`Tu es amoureux·se de ${state.yourLover.pseudo}. Si l'un meurt, l'autre aussi.`)
  if (state.voyanteResult) notes.push(`Ta dernière vision : ${name(state.voyanteResult.memberId)} est ${ROLE_NAMES[state.voyanteResult.role]}.`)
  if (state.petiteFilleInfo?.length) notes.push(`Tu as aperçu un loup : ${name(state.petiteFilleInfo[0])}.`)
  if (state.spiedBy) notes.push(`La petite fille vous a vus : c'est ${name(state.spiedBy)}.`)
  if (notes.length === 0) return null
  return (
    <Card className="mb-4 border-brass/30">
      <p className="kicker text-2xs mb-2">Rien que pour toi</p>
      {notes.map((n) => <p key={n} className="text-sm text-chalk-soft mb-1">{n}</p>)}
    </Card>
  )
}

function PlayerPicker({
  members,
  ids,
  selected,
  onSelect,
  tone = 'spark',
  note,
}: {
  members: Member[]
  ids: string[]
  selected: string[]
  onSelect: (id: string) => void
  tone?: 'spark' | 'jade' | 'blood'
  note?: (id: string) => string | null
}) {
  const border = { spark: 'border-spark/50 bg-spark/10', jade: 'border-jade/50 bg-jade/10', blood: 'border-blood/50 bg-blood/10' }[tone]
  return (
    <div className="flex flex-col gap-2 mb-4">
      {ids.map((id) => {
        const m = members.find((x) => x.id === id)
        if (!m) return null
        const on = selected.includes(id)
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex items-center gap-2 rounded-control p-2.5 border transition-colors ${on ? border : 'border-line bg-felt-raised'}`}
          >
            <Avatar pseudo={m.pseudo} color={m.color} size={32} photoUrl={m.photoUrl} />
            <span className="text-sm text-chalk flex-1 text-left">{m.pseudo}</span>
            {note?.(id) && <span className="text-2xs text-chalk-soft">{note(id)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function HostSkip({ onSkip, label }: { onSkip: () => void; label: string }) {
  return (
    <Button fullWidth variant="ghost" onClick={onSkip} className="mt-4">
      {label}
    </Button>
  )
}

// ─── Étapes de nuit ───────────────────────────────────────────────────────

function CupidonStep({ state, members, send }: { state: LoupGarouClientState; members: Member[]; send: Send }) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 2 ? [...p, id] : [p[1], id]))
  return (
    <Screen kicker="🏹 Cupidon">
      <p className="font-display text-lg text-chalk text-center mb-4">Choisis deux amoureux</p>
      <PlayerPicker members={members} ids={state.alive} selected={picked} onSelect={toggle} />
      <Button fullWidth disabled={picked.length !== 2} onClick={() => send('cupidon-link', { target1: picked[0], target2: picked[1] })}>
        Unir ces deux-là
      </Button>
    </Screen>
  )
}

function VoyanteStep({ state, members, me, send }: { state: LoupGarouClientState; members: Member[]; me: string; send: Send }) {
  const [target, setTarget] = useState<string | null>(null)
  const result = state.voyanteCheckedTonight ? state.voyanteResult : null
  return (
    <Screen kicker="🔮 Voyante">
      {result ? (
        <>
          <Card className="text-center mb-6">
            <p className="text-sm text-chalk-soft mb-2">{members.find((m) => m.id === result.memberId)?.pseudo} est…</p>
            <p className="text-4xl mb-1">{ROLE_ICONS[result.role]}</p>
            <p className="font-display text-xl text-chalk">{ROLE_NAMES[result.role]}</p>
          </Card>
          <Button fullWidth onClick={() => send('voyante-done', {})}>Refermer les yeux</Button>
        </>
      ) : (
        <>
          <p className="font-display text-lg text-chalk text-center mb-4">Qui veux-tu sonder ?</p>
          <PlayerPicker members={members} ids={state.alive.filter((id) => id !== me)} selected={target ? [target] : []} onSelect={setTarget} />
          <Button fullWidth disabled={!target} onClick={() => send('voyante-check', { targetId: target })}>Voir son rôle</Button>
        </>
      )}
    </Screen>
  )
}

function SalvateurStep({ state, members, me, send }: { state: LoupGarouClientState; members: Member[]; me: string; send: Send }) {
  const [target, setTarget] = useState<string | null>(null)
  const ids = state.alive.filter((id) => id !== state.salvateurLast)
  return (
    <Screen kicker="🛡️ Salvateur">
      <p className="font-display text-lg text-chalk text-center mb-1">Qui protèges-tu cette nuit ?</p>
      <p className="text-xs text-chalk-faint text-center mb-4">Jamais deux nuits de suite la même personne.</p>
      <PlayerPicker members={members} ids={ids} selected={target ? [target] : []} onSelect={setTarget} tone="jade" note={(id) => (id === me ? 'toi' : null)} />
      <Button fullWidth disabled={!target} onClick={() => send('salvateur-protect', { targetId: target })}>Protéger</Button>
    </Screen>
  )
}

function LoupsStep({ state, members, me, send }: { state: LoupGarouClientState; members: Member[]; me: string; send: Send }) {
  const [target, setTarget] = useState<string | null>(null)
  const pack = (state.loupsMembers ?? []).filter((id) => state.alive.includes(id))
  const prey = state.alive.filter((id) => !pack.includes(id))
  const votes = state.nightVotes ?? {}
  const name = (id: string) => members.find((m) => m.id === id)?.pseudo ?? '?'
  return (
    <Screen kicker="🐺 Les loups">
      <Pack ids={pack} me={me} members={members} />
      {state.spiedBy && <p className="text-xs text-blood text-center mb-3">La petite fille vous a vus : c'est {name(state.spiedBy)}.</p>}
      <p className="font-display text-lg text-chalk text-center mb-1">Qui dévorez-vous ?</p>
      <p className="text-xs text-chalk-faint text-center mb-4">La meute doit voter ; en cas d'égalité, le sort tranche.</p>
      <PlayerPicker
        members={members}
        ids={prey}
        selected={target ? [target] : votes[me] ? [votes[me]] : []}
        onSelect={setTarget}
        tone="blood"
        note={(id) => {
          const n = Object.values(votes).filter((v) => v === id).length
          return n ? `${n} loup${n > 1 ? 's' : ''}` : null
        }}
      />
      <Button fullWidth disabled={!target} onClick={() => send('loup-vote', { targetId: target })}>
        {votes[me] ? 'Changer ma cible' : 'Dévorer'}
      </Button>
    </Screen>
  )
}

function SorciereStep({ state, members, me, send }: { state: LoupGarouClientState; members: Member[]; me: string; send: Send }) {
  const [poisoning, setPoisoning] = useState(false)
  const [target, setTarget] = useState<string | null>(null)
  const victim = members.find((m) => m.id === state.killTarget)
  return (
    <Screen kicker="🧪 Sorcière">
      <Card className="text-center mb-4">
        <p className="text-sm text-chalk-soft mb-1">Les loups ont attaqué</p>
        <p className="font-display text-lg text-chalk">{victim ? victim.pseudo : 'personne'}</p>
        {state.healedThisNight && <p className="text-xs text-jade mt-1">Tu l'as sauvé·e.</p>}
        {state.poisonTarget && <p className="text-xs text-blood mt-1">Tu as empoisonné {members.find((m) => m.id === state.poisonTarget)?.pseudo}.</p>}
      </Card>
      <div className="flex flex-col gap-3">
        {!state.sorciereHealUsed && victim && (
          <Button fullWidth onClick={() => send('sorciere-heal', {})}>Potion de vie : sauver {victim.pseudo}</Button>
        )}
        {!state.sorciereKillUsed && !poisoning && (
          <Button fullWidth variant="secondary" onClick={() => setPoisoning(true)}>Potion de mort…</Button>
        )}
        {!state.sorciereKillUsed && poisoning && (
          <>
            <PlayerPicker members={members} ids={state.alive.filter((id) => id !== me)} selected={target ? [target] : []} onSelect={setTarget} tone="blood" />
            <Button fullWidth disabled={!target} onClick={() => send('sorciere-kill', { targetId: target })}>Empoisonner</Button>
          </>
        )}
        <Button fullWidth variant="ghost" onClick={() => send('sorciere-done', {})}>Refermer les yeux</Button>
      </div>
    </Screen>
  )
}

function PetiteFilleStep({ state, members, send }: { state: LoupGarouClientState; members: Member[]; send: Send }) {
  const seen = state.petiteFilleInfo?.[0]
  const wolf = members.find((m) => m.id === seen)
  return (
    <Screen kicker="👀 Petite fille">
      {wolf ? (
        <>
          <Card className="text-center mb-6">
            <p className="text-sm text-chalk-soft mb-2">Entre tes doigts, tu aperçois un loup :</p>
            <p className="font-display text-xl text-chalk">{wolf.pseudo}</p>
            <p className="text-xs text-blood mt-2">Les loups sauront la nuit prochaine que tu les as vus.</p>
          </Card>
          <Button fullWidth onClick={() => send('petite-fille-done', {})}>Refermer les yeux</Button>
        </>
      ) : (
        <>
          <Card className="text-center mb-6">
            <p className="text-sm text-chalk-soft">
              Espionner te montre un loup au hasard — mais les loups sauront la nuit prochaine que c'était toi.
            </p>
          </Card>
          <div className="flex flex-col gap-3">
            <Button fullWidth onClick={() => send('petite-fille-spy', {})}>Espionner</Button>
            <Button fullWidth variant="secondary" onClick={() => send('petite-fille-sleep', {})}>Garder les yeux fermés</Button>
          </div>
        </>
      )}
    </Screen>
  )
}

// ─── Jour ─────────────────────────────────────────────────────────────────

function VoteStep({
  state, members, me, dead, send, isHost, onClose,
}: { state: LoupGarouClientState; members: Member[]; me: string; dead: boolean; send: Send; isHost: boolean; onClose: () => void }) {
  const [target, setTarget] = useState<string | null>(null)
  const votes = state.dayVotes ?? {}
  const mine = votes[me]
  const voted = Object.keys(votes).length
  return (
    <Screen kicker={`Jour ${state.dayNumber} — le conseil vote`}>
      <p className="font-display text-lg text-chalk text-center mb-1">Qui est un loup ?</p>
      <p className="text-xs text-chalk-faint text-center mb-4">
        {voted} / {state.alive.length} ont voté · vote public, modifiable jusqu'au dernier bulletin
      </p>
      {dead ? (
        <p className="text-center text-chalk-soft text-sm">Les morts ne votent pas.</p>
      ) : (
        <>
          <PlayerPicker
            members={members}
            ids={state.alive.filter((id) => id !== me)}
            selected={target ? [target] : mine ? [mine] : []}
            onSelect={setTarget}
            tone="blood"
            note={(id) => {
              const n = Object.values(votes).filter((v) => v === id).length
              return n ? `${n} voix` : null
            }}
          />
          <Button fullWidth disabled={!target || target === mine} onClick={() => send('day-vote', { targetId: target })}>
            {mine ? 'Changer mon vote' : 'Voter contre'}
          </Button>
        </>
      )}
      {isHost && <HostSkip onSkip={onClose} label="Clore le vote maintenant" />}
    </Screen>
  )
}

function HunterStep({
  state, members, me, send, isHost, onSkip,
}: { state: LoupGarouClientState; members: Member[]; me: string; send: Send; isHost: boolean; onSkip: () => void }) {
  const [target, setTarget] = useState<string | null>(null)
  const hunter = members.find((m) => m.id === state.hunterId)
  if (state.hunterId !== me) {
    return (
      <Screen kicker="🔫 Chasseur">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <p className="font-display text-xl text-chalk">{hunter?.pseudo} était chasseur</p>
          <p className="text-sm text-chalk-soft">Il emporte quelqu'un avec lui…</p>
        </div>
        {isHost && <HostSkip onSkip={onSkip} label="Le chasseur ne tire pas" />}
      </Screen>
    )
  }
  return (
    <Screen kicker="🔫 Chasseur">
      <p className="font-display text-lg text-chalk text-center mb-4">Tu meurs — qui emportes-tu ?</p>
      <PlayerPicker members={members} ids={state.alive} selected={target ? [target] : []} onSelect={setTarget} tone="blood" />
      <Button fullWidth disabled={!target} onClick={() => send('hunter-shoot', { targetId: target })}>Tirer</Button>
    </Screen>
  )
}

function FinalScreen({ state, members, onExit }: { state: LoupGarouClientState; members: Member[]; onExit: () => void }) {
  const title = state.winner === 'village' ? 'Le village a gagné' : state.winner === 'loups' ? 'Les loups ont gagné' : 'Les amoureux ont gagné'
  const roles = state.allRoles ?? {}
  return (
    <Screen kicker="Fin de la partie">
      <p className="font-display text-2xl text-chalk text-center mb-6">{title}</p>
      <div className="flex flex-col gap-2 mb-6">
        {state.players.map((id) => {
          const m = members.find((x) => x.id === id)
          const r = roles[id]
          const alive = state.alive.includes(id)
          return (
            <div key={id} className={`flex items-center gap-2.5 rounded-card bg-felt-raised p-2.5 ${alive ? '' : 'opacity-60'}`}>
              <Avatar pseudo={m?.pseudo ?? '?'} color={m?.color ?? '#888'} size={28} photoUrl={m?.photoUrl} />
              <span className="flex-1 text-sm text-chalk">{m?.pseudo}{state.lovers?.includes(id) ? ' 💘' : ''}</span>
              {r && <span className="text-xs text-chalk-soft">{ROLE_ICONS[r]} {ROLE_NAMES[r]}</span>}
            </div>
          )
        })}
      </div>
      <Button fullWidth onClick={onExit}>Retour au salon</Button>
    </Screen>
  )
}
