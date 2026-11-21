import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { formatSpan, youtubePlaylistUrl, YOUTUBE_PLAYLIST_MAX } from '../lib/jukebox'
import { beginSpotifyAuth, createSpotifyPlaylist, isSpotifyConnected, spotifyCanCreatePlaylists } from '../lib/spotify'
import { Surface } from '../components/Card'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { QRCode } from '../components/QRCode'
import { TvViewport } from '../party/primitives/TvViewport'
import { IconArrowLeft, IconCheck, IconCopy, IconCrown, IconExternal } from '../components/icons'
import type { Member, MusicRecap } from '../types'
import { CoverBackdrop, TrackArt, Vinyl } from './ui'
import { useIsMusicHost, useMemberLookup } from './hooks'

/**
 * Fin de soirée : le récap. Trois choses, dans l'ordre où la pièce les regarde — ce qu'on a vécu
 * (durée, morceaux, réactions), qui a fait danser (les plus applaudis, les meilleurs DJ), et de quoi
 * garder la soirée (la playlist, YouTube sans compte ou Spotify sur le compte de la platine).
 */

/** Compteur qui monte (une fois), coupé net si l'utilisateur demande moins de mouvement. */
function CountUp({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{n}</>
}

const deal = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.35 + i * 0.09, duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
})

function reactionsLabel(n: number): string {
  return `${n} réaction${n > 1 ? 's' : ''}`
}

/** Les trois chiffres de la soirée. */
function Stats({ recap, tv = false }: { recap: MusicRecap; tv?: boolean }) {
  const items: { value: ReactNode; label: string }[] = [
    { value: recap.endedAt - recap.startedAt < 60_000 ? '< 1 min' : formatSpan(recap.endedAt - recap.startedAt), label: 'de musique' },
    { value: <CountUp value={recap.tracksPlayed} />, label: recap.tracksPlayed > 1 ? 'morceaux' : 'morceau' },
    { value: <CountUp value={recap.totalReactions} />, label: recap.totalReactions > 1 ? 'réactions' : 'réaction' },
  ]
  return (
    <div className={clsx('grid grid-cols-3', tv ? 'gap-5' : 'gap-2')}>
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          {...deal(i)}
          className={clsx('rounded-card border border-line bg-felt/80 text-center', tv ? 'px-4 py-5' : 'px-2 py-3')}
        >
          <p className={clsx('font-stage text-brass tabular-nums leading-none', tv ? 'text-tv-2xl' : 'text-2xl')}>{it.value}</p>
          <p className={clsx('text-chalk-soft mt-1.5', tv ? 'text-tv-xs' : 'text-2xs')}>{it.label}</p>
        </motion.div>
      ))}
    </div>
  )
}

function TopTracks({ recap, limit, tv = false }: { recap: MusicRecap; limit: number; tv?: boolean }) {
  const { byId } = useMemberLookup()
  const applauded = recap.topTracks.some((t) => t.reactions > 0)
  return (
    <div>
      <p className={clsx('kicker mb-3', tv ? 'text-tv-xs' : 'text-2xs')}>{applauded ? 'Les plus applaudis' : 'Les plus joués'}</p>
      <ol className={clsx('flex flex-col', tv ? 'gap-3' : 'gap-2')}>
        {recap.topTracks.slice(0, limit).map((t, i) => (
          <motion.li
            key={t.sourceId}
            {...deal(i + 3)}
            className={clsx(
              'flex items-center rounded-card border bg-felt/80',
              i === 0 ? 'border-brass/60' : 'border-line',
              tv ? 'gap-4 px-3.5 py-2.5' : 'gap-3 px-2.5 py-2',
            )}
          >
            <span
              className={clsx('w-5 text-center font-stage tabular-nums', i === 0 ? 'text-brass' : 'text-chalk-faint', tv ? 'text-tv-lg' : 'text-lg')}
            >
              {i + 1}
            </span>
            <TrackArt src={t.thumbnail} size={tv ? 54 : 46} />
            <div className="min-w-0 flex-1">
              <p className={clsx('text-chalk truncate', tv ? 'text-tv-base' : 'text-sm')}>{t.title}</p>
              <p className={clsx('text-chalk-faint truncate', tv ? 'text-tv-xs' : 'text-2xs')}>
                {byId(t.addedById)?.pseudo ?? 'Quelqu’un'}
                {t.plays > 1 ? ` · joué ${t.plays} fois` : ''}
              </p>
            </div>
            {t.reactions > 0 && (
              <span className={clsx('shrink-0 tabular-nums text-chalk-muted', tv ? 'text-tv-sm' : 'text-xs')}>{reactionsLabel(t.reactions)}</span>
            )}
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

/** Le podium des DJ : le premier au centre, plus grand, couronné. */
function Djs({ recap, tv = false }: { recap: MusicRecap; tv?: boolean }) {
  const { byId } = useMemberLookup()
  const top = recap.djs
    .slice(0, 3)
    .map((d) => ({ ...d, member: byId(d.memberId) }))
    .filter((d): d is typeof d & { member: Member } => !!d.member)
  if (top.length === 0) return null
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top
  return (
    <div>
      <p className={clsx('kicker mb-4', tv ? 'text-tv-xs' : 'text-2xs')}>Meilleurs DJ</p>
      <div className={clsx('flex items-end justify-center', tv ? 'gap-10' : 'gap-5')}>
        {order.map((d, i) => {
          const first = d === top[0]
          const size = tv ? (first ? 96 : 72) : first ? 60 : 46
          return (
            <motion.div
              key={d.memberId}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.9 + (first ? 0.3 : i * 0.12), duration: 0.6, ease: [0.16, 1.02, 0.3, 1] }}
              className="flex flex-col items-center text-center min-w-0"
            >
              {first && <IconCrown size={tv ? 30 : 20} className="text-brass mb-1" />}
              <Avatar pseudo={d.member.pseudo} color={d.member.color} size={size} photoUrl={d.member.photoUrl} />
              <p className={clsx('text-chalk font-semibold mt-2 truncate max-w-[8rem]', tv ? 'text-tv-base' : 'text-sm')}>{d.member.pseudo}</p>
              <p className={clsx('text-chalk-soft leading-snug', tv ? 'text-tv-xs' : 'text-2xs')}>
                {d.plays} morceau{d.plays > 1 ? 'x' : ''}
                <br />
                {reactionsLabel(d.reactions)}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/** Garder la soirée : la playlist YouTube en un lien (sans compte), ou les liens Spotify. */
function Export({ recap, onPlatine = false }: { recap: MusicRecap; onPlatine?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [spotify, setSpotify] = useState<{ state: 'idle' | 'busy' | 'done' | 'failed'; url?: string; reason?: string }>({ state: 'idle' })
  const groupName = usePartyStore((s) => s.group?.name ?? 'MindMatch')
  if (recap.playlist.length === 0) return null
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* presse-papiers indisponible */
    }
  }

  if (recap.source === 'youtube') {
    const url = youtubePlaylistUrl(recap.playlist.map((p) => p.sourceId))
    return (
      <Surface className="!p-4">
        <p className="kicker text-2xs mb-1">Garder la playlist</p>
        <p className="text-sm text-chalk-soft mb-3">
          Les {recap.playlist.length} morceaux de la soirée, dans l’ordre, sur YouTube — sans compte.
          {recap.playlist.length >= YOUTUBE_PLAYLIST_MAX && ' (Les 50 premiers : la limite d’une playlist sans compte.)'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-control min-h-[48px] bg-spark text-ink font-bold text-sm flex items-center justify-center gap-1.5 shadow-spark"
          >
            <IconExternal size={16} />
            Ouvrir sur YouTube
          </a>
          <Button variant="secondary" className="!min-h-[48px] text-sm !px-3 flex items-center justify-center gap-1.5" onClick={() => void copy(url)}>
            {copied ? <IconCheck size={16} className="text-jade" /> : <IconCopy size={16} />}
            {copied ? 'Copié' : 'Copier le lien'}
          </Button>
        </div>
      </Surface>
    )
  }

  const links = recap.playlist.map((p) => `${p.title}${p.artist ? ` — ${p.artist}` : ''} : https://open.spotify.com/track/${p.sourceId}`).join('\n')
  const create = async () => {
    setSpotify({ state: 'busy' })
    const r = await createSpotifyPlaylist(
      `${groupName} — soirée du ${new Date(recap.endedAt).toLocaleDateString('fr-FR')}`,
      'La playlist de la soirée, créée par la platine MindMatch.',
      recap.playlist.map((p) => p.sourceId),
    )
    setSpotify(r.ok ? { state: 'done', url: r.url } : { state: 'failed', reason: r.reason })
  }
  const canCreate = onPlatine && isSpotifyConnected()
  return (
    <Surface className="!p-4">
      <p className="kicker text-2xs mb-1">Garder la playlist</p>
      {spotify.state === 'done' ? (
        <a href={spotify.url} target="_blank" rel="noreferrer" className="text-sm text-jade flex items-center gap-1.5 mb-3">
          <IconCheck size={16} />
          Playlist créée sur ce compte Spotify — l’ouvrir
        </a>
      ) : canCreate ? (
        <>
          <p className="text-sm text-chalk-soft mb-3">
            Enregistre les {recap.playlist.length} morceaux de la soirée sur le compte Spotify de cette platine.
          </p>
          {spotifyCanCreatePlaylists() || spotify.state === 'failed' ? (
            <Button fullWidth disabled={spotify.state === 'busy'} onClick={() => void create()} className="mb-2">
              {spotify.state === 'busy' ? 'Création…' : 'Créer la playlist Spotify'}
            </Button>
          ) : (
            <Button fullWidth onClick={() => void beginSpotifyAuth(window.location.hash)} className="mb-2">
              Autoriser les playlists (reconnexion Spotify)
            </Button>
          )}
          {spotify.state === 'failed' && (
            <p className="text-2xs text-chalk-soft mb-2">
              {spotify.reason === 'scope'
                ? 'Ce compte n’autorise pas la création de playlists. Les liens ci-dessous marchent toujours.'
                : 'Spotify refuse pour le moment. Les liens ci-dessous marchent toujours.'}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-chalk-soft mb-3">
          La playlist Spotify se crée depuis la platine, sur le compte qui y est connecté. Ici : les liens de chaque morceau.
        </p>
      )}
      <details className="text-xs text-chalk-soft">
        <summary className="cursor-pointer py-1">Les {recap.playlist.length} liens Spotify</summary>
        <ul className="mt-2 flex flex-col gap-1.5 max-h-56 overflow-y-auto">
          {recap.playlist.map((p) => (
            <li key={p.sourceId} className="truncate">
              <a
                href={`https://open.spotify.com/track/${p.sourceId}`}
                target="_blank"
                rel="noreferrer"
                className="text-chalk-muted underline-offset-2 hover:underline"
              >
                {p.title}
                {p.artist ? ` — ${p.artist}` : ''}
              </a>
            </li>
          ))}
        </ul>
      </details>
      <Button variant="ghost" className="!min-h-[40px] text-xs mt-1 flex items-center gap-1.5" onClick={() => void copy(links)}>
        {copied ? <IconCheck size={14} className="text-jade" /> : <IconCopy size={14} />}
        {copied ? 'Copié' : 'Copier tous les liens'}
      </Button>
    </Surface>
  )
}

/** Le corps du récap, à l'échelle téléphone (téléphones et platine en portrait). */
function RecapBody({ recap, onPlatine = false }: { recap: MusicRecap; onPlatine?: boolean }) {
  return (
    <>
      <motion.div
        initial={{ scale: 0.85, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-center"
      >
        <Vinyl cover={recap.topTracks[0]?.thumbnail} size={132} spinning={false} />
      </motion.div>
      <p className="kicker text-2xs text-center mt-5">Fin de soirée</p>
      <h1 className="font-display text-3xl text-chalk text-center mt-1 mb-5">Merci pour la musique</h1>
      {recap.tracksPlayed === 0 ? (
        <p className="text-sm text-chalk-soft text-center">Aucun morceau n’a tourné ce soir. La prochaine fois, la platine vous attend.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <Stats recap={recap} />
          <TopTracks recap={recap} limit={3} />
          <Djs recap={recap} />
          <motion.div {...deal(8)}>
            <Export recap={recap} onPlatine={onPlatine} />
          </motion.div>
        </div>
      )}
    </>
  )
}

/** Fin de soirée, côté téléphone. */
export function SoireeRecap() {
  const navigate = useNavigate()
  const recap = usePartyStore((s) => s.group?.music?.recap)
  const musicAction = usePartyStore((s) => s.musicAction)
  const isHost = useIsMusicHost()
  const { play } = useSound()
  if (!recap) return null
  return (
    <>
      <CoverBackdrop cover={recap.topTracks[0]?.thumbnail} />
      <div className="relative z-10 min-h-svh px-5 pt-16 pb-12 max-w-lg mx-auto safe-top">
        <button
          onClick={() => {
            play('pop')
            navigate('/lobby')
          }}
          className="fixed top-4 left-4 z-40 flex items-center gap-1.5 rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-muted text-sm"
        >
          <IconArrowLeft size={15} />
          Salon
        </button>
        <RecapBody recap={recap} />
        {isHost && (
          <div className="mt-6">
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                play('pop')
                void musicAction('dismiss')
              }}
            >
              Refermer la soirée
            </Button>
            <p className="text-2xs text-chalk-faint text-center -mt-1">
              Le récap disparaît pour tout le monde ; une nouvelle soirée pourra commencer.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

/** Fin de soirée, sur la TV (scène 1280 × 720) : grand, lisible de loin, et la playlist à scanner. */
export function SoireeTvRecap() {
  const recap = usePartyStore((s) => s.group?.music?.recap)
  if (!recap) return null
  const url = recap.source === 'youtube' && recap.playlist.length > 0 ? youtubePlaylistUrl(recap.playlist.map((p) => p.sourceId)) : null
  return (
    <div className="relative w-[1280px] h-[720px] overflow-hidden" style={{ padding: '84px 56px 40px' }}>
      <div className="grid h-full gap-12" style={{ gridTemplateColumns: '1fr 420px' }}>
        <section className="flex flex-col min-h-0">
          <p className="kicker text-tv-xs mb-3">Fin de soirée</p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-stage text-tv-3xl text-chalk"
          >
            Merci pour la musique
          </motion.h1>
          <div className="mt-8">
            <Stats recap={recap} tv />
          </div>
          <div className="flex-1" />
          <Djs recap={recap} tv />
        </section>
        <aside className="flex flex-col min-h-0 gap-6">
          {recap.tracksPlayed > 0 ? (
            <TopTracks recap={recap} limit={5} tv />
          ) : (
            <p className="text-tv-base text-chalk-soft">Aucun morceau n’a tourné ce soir.</p>
          )}
          <div className="flex-1" />
          {url && (
            <motion.div {...deal(9)} className="flex items-center gap-4 rounded-card border border-line bg-felt/85 p-3.5">
              <QRCode value={url} size={104} />
              <div className="min-w-0">
                <p className="kicker text-tv-xs mb-1.5">Emportez la playlist</p>
                <p className="text-tv-sm text-chalk leading-snug">Scannez : les morceaux de la soirée sur YouTube, sans compte.</p>
              </div>
            </motion.div>
          )}
        </aside>
      </div>
    </div>
  )
}

/** Fin de soirée, côté platine : la scène TV en paysage (avec l'export Spotify sur ce compte), le
 * récap téléphone en portrait. */
export function PlatineRecap({ onQuit }: { onQuit: () => void }) {
  const recap = usePartyStore((s) => s.group?.music?.recap)
  const [landscape] = useState(() => window.innerWidth >= 720 && window.innerWidth > window.innerHeight * 1.15)
  if (!recap) return null
  return (
    <div className="fixed inset-0 bg-ink overflow-hidden">
      <CoverBackdrop cover={recap.topTracks[0]?.thumbnail} strength="stage" />
      {landscape ? (
        <TvViewport>
          <SoireeTvRecap />
        </TvViewport>
      ) : (
        <div className="relative z-10 h-full overflow-y-auto">
          <div className="px-5 pt-16 pb-12 max-w-lg mx-auto">
            <RecapBody recap={recap} onPlatine />
          </div>
        </div>
      )}
      <div className="fixed top-4 right-4 z-40">
        <button onClick={onQuit} className="rounded-chip bg-felt-raised border border-line px-3 h-9 text-chalk-soft text-xs">
          Quitter la platine
        </button>
      </div>
      {landscape && recap.source === 'spotify' && recap.playlist.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,22rem)]">
          <Export recap={recap} onPlatine />
        </div>
      )}
    </div>
  )
}
