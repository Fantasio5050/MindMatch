import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../store/usePartyStore'
import { useAppStore } from '../store/useAppStore'
import { useSound } from '../hooks/useSound'
import { skipStatus } from '../lib/jukebox'
import { GAME_META } from '../data/gameMeta'
import { Surface } from '../components/Card'
import { Button } from '../components/Button'
import {
  GameIcon,
  IconAlert,
  IconPlus,
  IconSkip,
  IconPlayNext,
  IconTrash,
  IconReplay,
  IconTurntable,
  IconScreen,
  IconMusic,
  type IconProps,
} from '../components/icons'
import { feedText, FEED_FRESH_MS } from './feed'
import { useMemberLookup, useNow } from './hooks'
import type { MusicFeedKind } from '../types'

/**
 * Jauge du vote pour passer : la barre se remplit à chaque voix, le seuil suit la salle connectée.
 * Un second appui retire sa voix.
 */
export function SkipGauge({ className, compact = false }: { className?: string; compact?: boolean }) {
  const music = usePartyStore((s) => s.group?.music)
  const memberCount = usePartyStore((s) => s.group?.members.length ?? 0)
  const onlineIds = usePartyStore((s) => s.onlinePlayerIds)
  const musicAction = usePartyStore((s) => s.musicAction)
  const myId = useAppStore((s) => s.identity?.memberId)
  const { play } = useSound()
  if (!music?.current || !myId) return null
  const { votes, needed } = skipStatus(music, onlineIds, memberCount)
  const voted = music.skipVotes.includes(myId)
  const p = Math.min(1, votes / needed)
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        play('pop')
        void musicAction('voteSkip')
      }}
      aria-pressed={voted}
      className={clsx(
        'relative w-full overflow-hidden rounded-control border text-left transition-colors',
        compact ? 'h-11' : 'h-12',
        voted ? 'border-spark bg-felt-raised' : 'border-line-strong bg-felt/80',
        className,
      )}
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-spark/25"
        initial={false}
        animate={{ width: `${p * 100}%` }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
      />
      <span className="relative h-full flex items-center justify-between gap-3 px-4">
        <span className="flex items-center gap-2 min-w-0 text-sm font-semibold text-chalk">
          <IconSkip size={17} className={voted ? 'text-spark' : 'text-chalk-soft'} />
          <span className="truncate">{voted ? 'Tu veux passer · annuler' : needed === 1 ? 'Passer ce morceau' : 'Voter pour passer'}</span>
        </span>
        <span className="shrink-0 tabular-nums text-sm text-chalk-muted">
          {votes}/{needed}
        </span>
      </span>
    </motion.button>
  )
}

const FEED_ICON: Record<MusicFeedKind, (p: IconProps) => ReactElement> = {
  add: IconPlus,
  replay: IconReplay,
  skipVote: IconSkip,
  skip: IconSkip,
  hostSkip: IconSkip,
  playNext: IconPlayNext,
  remove: IconTrash,
  auto: IconReplay,
  unplayable: IconAlert,
  platineOn: IconTurntable,
  platineOff: IconAlert,
  output: IconScreen,
}

/**
 * Le fil d'activité, un fait à la fois (règle du socle : jamais un flux qui défile). Le dernier fait
 * reste affiché tant qu'il est frais, puis laisse place à une ligne d'ambiance — l'écran n'est
 * jamais vide, jamais « en attente ».
 */
export function FeedTicker({ idle, className }: { idle: string; className?: string }) {
  const feed = usePartyStore((s) => s.group?.music?.feed)
  const serverNow = usePartyStore((s) => s.serverNow)
  const { name } = useMemberLookup()
  useNow(5000)
  const latest = feed?.at(-1)
  const fresh = !!latest && serverNow() - latest.at < FEED_FRESH_MS
  const Mark = fresh && latest ? FEED_ICON[latest.kind] : IconMusic
  const text = fresh && latest ? feedText(latest, name) : idle
  return (
    <div className={clsx('relative h-9 overflow-hidden', className)} aria-live="polite">
      <AnimatePresence initial={false}>
        <motion.p
          key={fresh && latest ? latest.id : 'idle'}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className={clsx('absolute inset-0 flex items-center gap-2 text-xs', fresh ? 'text-chalk-muted' : 'text-chalk-faint')}
        >
          <Mark size={15} className={clsx('shrink-0', fresh && latest?.kind === 'platineOff' ? 'text-blood' : fresh ? 'text-spark' : '')} />
          <span className="truncate">{text}</span>
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

/**
 * La platine ne répond plus (ou n'a jamais été ouverte) : la musique ne sort nulle part. On le dit
 * franchement, avec la marche à suivre — et à l'hôte, les deux boutons qui règlent le problème.
 */
export function PlatineAlert({ code, onOpenPlatine, onSoundOnTv, onSoundOnPlatine }: {
  code: string
  onOpenPlatine?: () => void
  onSoundOnTv?: () => void
  onSoundOnPlatine?: () => void
}) {
  const platine = usePartyStore((s) => s.platine)
  const music = usePartyStore((s) => s.group?.music)
  if (!music || music.endedAt || !platine || platine.online) return null
  const tv = music.settings.output === 'tv'
  const seen = music.feed.some((e) => e.kind === 'platineOn' || e.kind === 'platineOff')
  const isHost = !!onOpenPlatine
  return (
    <Surface className="!p-4 border-blood/45 mb-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-chalk mb-1">
        <IconAlert size={17} className="text-blood shrink-0" />
        {tv ? 'La TV attend le signal' : seen ? 'La platine est hors ligne' : 'Aucune platine pour l’instant'}
      </p>
      <p className="text-xs text-chalk-soft leading-relaxed">
        {tv ? (
          <>Sur l’écran partagé, touche « Démarrer le son ». La musique repart d’elle-même.</>
        ) : (
          <>
            Sur l’appareil branché à l’enceinte, ouvre MindMatch, rubrique Platine, code{' '}
            <b className="text-chalk tracking-widest">{code}</b>. La musique repart d’elle-même.
          </>
        )}
        {!isHost && ' Sinon, préviens l’hôte.'}
      </p>
      {isHost && (
        <div className="flex gap-2 mt-3">
          {tv ? (
            <Button variant="secondary" className="flex-1 !min-h-[44px] text-sm" onClick={onSoundOnPlatine}>
              Revenir à la platine
            </Button>
          ) : (
            <>
              <Button variant="secondary" className="flex-1 !min-h-[44px] text-sm !px-3" onClick={onOpenPlatine}>
                Platine ici
              </Button>
              {music.source === 'youtube' && (
                <Button variant="secondary" className="flex-1 !min-h-[44px] text-sm !px-3" onClick={onSoundOnTv}>
                  Son sur la TV
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Surface>
  )
}

/** Une partie tourne pendant la soirée : un rappel, et le chemin du retour vers la manette. */
export function GameBanner() {
  const navigate = useNavigate()
  const party = usePartyStore((s) => s.group?.party)
  if (!party || party.status !== 'playing' || !party.currentGameId) return null
  return (
    <Surface className="!p-3 mb-3 flex items-center gap-3">
      <GameIcon gameId={party.currentGameId} size={26} className="text-spark shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="kicker text-2xs">Partie en cours</p>
        <p className="text-sm text-chalk truncate">{GAME_META[party.currentGameId]?.name ?? 'Un jeu'}</p>
      </div>
      <Button className="!min-h-[40px] !px-4 text-sm" onClick={() => navigate('/play')}>
        Rejoindre
      </Button>
    </Surface>
  )
}
