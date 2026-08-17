import { motion, AnimatePresence } from 'framer-motion'
import { usePartyStore } from '../../../store/usePartyStore'
import { Avatar } from '../../../components/Avatar'
import { ROLE_NAMES, ROLE_ICONS } from './types'
import type { LoupGarouClientState } from './types'

export function LoupGarouScreen() {
  const group = usePartyStore((s) => s.group)

  if (!group) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-xl">Connexion à la salle…</p>
      </div>
    )
  }

  const { party, members } = group
  const state = party.roundData as LoupGarouClientState | null

  if (!state) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-chalk-faint text-2xl">Préparation…</p>
      </div>
    )
  }

  if (state.winner) {
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-8">
        <span className="text-8xl">{state.winner === 'village' ? '🛡️' : state.winner === 'loups' ? '🐺' : '💘'}</span>
        <p className="text-5xl font-extrabold shimmer-text">
          {state.winner === 'village' ? 'Le village a gagné !' : state.winner === 'loups' ? 'Les loups ont gagné !' : 'Les amoureux ont gagné !'}
        </p>
      </div>
    )
  }

  if (party.phase === 'role-reveal') {
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6">
        <p className="text-3xl font-extrabold shimmer-text">Les Loups-Garous</p>
        <p className="text-xl text-chalk-soft">de Thiercelieux</p>
        <p className="text-chalk-faint text-lg mt-4">Regardez secrètement votre rôle sur votre téléphone</p>
        <div className="grid grid-cols-4 gap-4 mt-8">
          {members.map(m => (
            <div key={m.id} className="flex flex-col items-center gap-2">
              <Avatar pseudo={m.pseudo} color={m.color} size={56} photoUrl={m.photoUrl} />
              <span className="text-sm">{m.pseudo}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (party.phase === 'night') {
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6" style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%)' }}>
        <motion.span
          className="text-7xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          🌙
        </motion.span>
        <p className="text-3xl font-extrabold">Nuit {state.dayNumber}</p>
        {state.currentNightStep && (
          <p className="text-xl text-chalk-soft">
            {state.currentNightStep === 'cupidon' && '🏹 Cupidon se réveille…'}
            {state.currentNightStep === 'voyante' && '🔮 La voyante se réveille…'}
            {state.currentNightStep === 'salvateur' && '🛡️ Le salvateur se réveille…'}
            {state.currentNightStep === 'loups' && '🐺 Les loups se réveillent…'}
            {state.currentNightStep === 'sorciere' && '🧪 La sorcière se réveille…'}
            {state.currentNightStep === 'petite-fille' && '👀 La petite fille espionne…'}
          </p>
        )}
        <div className="grid grid-cols-4 gap-3 mt-6">
          {members.map(m => {
            const isDead = !state.alive.includes(m.id)
            return (
              <motion.div
                key={m.id}
                className={`flex flex-col items-center gap-1 ${isDead ? 'opacity-30 grayscale' : ''}`}
                animate={isDead ? { rotateX: 90 } : { rotateX: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
                <span className="text-xs">{m.pseudo}</span>
                {isDead && <span className="text-xs text-red-400">💀</span>}
              </motion.div>
            )
          })}
        </div>
      </div>
    )
  }

  if (party.phase === 'day') {
    const nightDeaths = state.dead.filter(d => d.cause.includes('nuit'))
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6">
        <motion.span
          className="text-7xl"
          animate={{ scale: [0.8, 1.2, 1], rotate: [0, 10, 0] }}
          transition={{ duration: 1 }}
        >
          ☀️
        </motion.span>
        <p className="text-3xl font-extrabold">Jour {state.dayNumber}</p>
        {nightDeaths.length > 0 ? (
          <div className="text-center">
            <p className="text-xl text-chalk-soft mb-4">Cette nuit, il y a eu des morts :</p>
            <div className="flex flex-col gap-3 items-center">
              {nightDeaths.map(d => {
                const m = members.find(mm => mm.id === d.memberId)
                return (
                  <motion.div
                    key={d.memberId}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3"
                  >
                    <Avatar pseudo={m?.pseudo ?? '?'} color={m?.color ?? '#fff'} size={48} photoUrl={m?.photoUrl} />
                    <div className="text-left">
                      <p className="text-lg font-bold">{m?.pseudo}</p>
                      <p className="text-sm text-chalk-faint">{ROLE_ICONS[d.role]} {ROLE_NAMES[d.role]}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-2xl text-emerald-300">Personne n'est mort cette nuit ! 🎉</p>
        )}
        <p className="text-chalk-faint text-lg mt-4">Discutez et trouvez les loups…</p>
      </div>
    )
  }

  if (party.phase === 'vote') {
    const voteCount = Object.keys(state.dayVotes ?? {}).length
    const totalVoters = state.alive.length
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6">
        <p className="text-3xl font-extrabold shimmer-text">🗳️ Vote du village</p>
        <p className="text-xl text-chalk-soft">Jour {state.dayNumber}</p>

        {/* Progress bar */}
        <div className="w-96 max-w-full">
          <div className="flex justify-between text-sm text-chalk-faint mb-2">
            <span>{voteCount} / {totalVoters} voté</span>
          </div>
          <div className="h-4 rounded-full bg-felt-raised overflow-hidden">
            <motion.div
              className="h-full bg-amber-400"
              animate={{ width: `${totalVoters > 0 ? (voteCount / totalVoters) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Alive members grid */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          {members.map(m => {
            const isDead = !state.alive.includes(m.id)
            const voteCount = Object.values(state.dayVotes ?? {}).filter(v => v === m.id).length
            return (
              <div key={m.id} className={`flex flex-col items-center gap-1 ${isDead ? 'opacity-30 grayscale' : ''}`}>
                <Avatar pseudo={m.pseudo} color={m.color} size={48} photoUrl={m.photoUrl} />
                <span className="text-xs">{m.pseudo}</span>
                {voteCount > 0 && <span className="text-xs text-amber-300 font-bold">{voteCount} vote{voteCount > 1 ? 's' : ''}</span>}
                {isDead && <span className="text-xs text-red-400">💀</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (party.phase === 'reveal') {
    const lastDeath = state.dead[state.dead.length - 1]
    const lastMember = members.find(m => m.id === lastDeath?.memberId)
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`reveal-${state.dead.length}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="tv-frame flex flex-col items-center justify-center gap-6"
        >
          <p className="text-3xl font-extrabold">Révélation</p>
          {lastDeath && lastMember ? (
            <>
              <Avatar pseudo={lastMember.pseudo} color={lastMember.color} size={80} photoUrl={lastMember.photoUrl} />
              <p className="text-2xl font-bold">{lastMember.pseudo}</p>
              <p className="text-5xl">{ROLE_ICONS[lastDeath.role]}</p>
              <p className="text-xl font-bold shimmer-text">{ROLE_NAMES[lastDeath.role]}</p>
            </>
          ) : (
            <p className="text-2xl text-chalk-soft">Personne n'a été éliminé·e</p>
          )}
        </motion.div>
      </AnimatePresence>
    )
  }

  if (party.phase === 'hunter-shot') {
    return (
      <div className="tv-frame flex flex-col items-center justify-center gap-6">
        <motion.span className="text-7xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
          🔫
        </motion.span>
        <p className="text-3xl font-extrabold">Le chasseur tire !</p>
        <p className="text-xl text-chalk-soft">Il emporte quelqu'un dans la tombe…</p>
      </div>
    )
  }

  return (
    <div className="tv-frame flex items-center justify-center">
      <p className="text-chalk-faint text-2xl">Chargement…</p>
    </div>
  )
}