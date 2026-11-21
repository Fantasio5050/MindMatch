import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../../store/usePartyStore'
import { AVERAGE_TRACK_MS, formatSpan, orderedQueue, peekNext, reactionTotal } from '../../lib/jukebox'
import { joinUrl } from '../../lib/joinUrl'
import { QRCode } from '../../components/QRCode'
import { Avatar } from '../../components/Avatar'
import { IconMusic } from '../../components/icons'
import type { MusicTrack } from '../../types'
import { Vinyl, TrackArt, MusicProgress } from '../ui'
import { Equalizer } from '../Equalizer'
import { feedText, FEED_FRESH_MS } from '../feed'
import { useMemberLookup, useNow, useTrackClock } from '../hooks'

/** Avant la fin d'un morceau, la platine annonce le suivant (au moins pendant le fondu enchaîné). */
const ANNOUNCE_MS = 12_000

/**
 * La scène « En cours » du Mode Soirée, composée pour une surface FIXE de 1280 × 720 (voir
 * TvViewport) : la même image sur la platine d'un portable et sur une TV 4K, juste plus ou moins
 * fine. Lue de loin, donc échelle `text-tv-*`.
 *
 *   ┌────────────────────────────────┬──────────────┐
 *   │  (vinyle | vidéo)   titre       │  À suivre    │
 *   │                     artiste     │  …           │
 *   │                     dédicace    │              │
 *   │  ───────── progression ──────── │  [QR] code   │
 *   │  ▁▃▅▇▅▃ égaliseur                │  fil         │
 *   └────────────────────────────────┴──────────────┘
 *
 * `media` (les decks YouTube) est TOUJOURS rendu au même endroit de l'arbre, visible ou non : le
 * déplacer dans le DOM rechargerait les vidéos.
 */
export function SoireeStage({
  code,
  media,
  mediaVisible = false,
  crossfadeNext = null,
}: {
  code: string
  media?: ReactNode
  mediaVisible?: boolean
  crossfadeNext?: MusicTrack | null
}) {
  const music = usePartyStore((s) => s.group?.music)
  const platine = usePartyStore((s) => s.platine)
  const { byId } = useMemberLookup()
  if (!music) return null
  const current = music.current
  const adder = current ? byId(current.addedById) : undefined
  const spinning = !!current && music.isPlaying && !!music.anchor?.playing && !!platine?.online

  return (
    <div className="relative w-[1280px] h-[720px] overflow-hidden" style={{ padding: '84px 56px 34px' }}>
      <div className="grid h-full gap-12" style={{ gridTemplateColumns: '1fr 372px' }}>
        {/* ---- Ce qui tourne ---- */}
        <section className="relative flex flex-col min-w-0 min-h-0">
          <div className={clsx('flex-1 min-h-0 flex', mediaVisible ? 'flex-col gap-4' : 'items-center gap-10')}>
            <div className={clsx('relative shrink-0', mediaVisible ? 'w-[640px]' : '')}>
              {media}
              {/* Entrée seule, sans phase de sortie : pendant un fondu enchaîné le morceau change en
                  pleine transition, et une sortie « en attente » pouvait laisser la scène vide. */}
              {!mediaVisible && (
                <motion.div
                  key={current?.id ?? 'idle'}
                  initial={{ scale: 0.9, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Vinyl cover={current?.thumbnail} size={318} spinning={spinning} className={current ? '' : 'opacity-50'} />
                </motion.div>
              )}
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-center">
              {current ? (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className={clsx('kicker text-tv-xs', mediaVisible ? 'mb-1.5' : 'mb-3')}>
                    {!platine?.online ? 'Platine hors ligne' : !music.isPlaying ? 'En pause' : current.auto ? 'En cours · mode continu' : 'En cours'}
                  </p>
                  {mediaVisible ? (
                    // Sous la vidéo, tout tient en deux lignes : la scène est déjà occupée par l'image.
                    <>
                      <div className="flex items-baseline gap-3 min-w-0">
                        <h1 className="font-stage text-tv-xl text-chalk truncate">{current.title}</h1>
                        {current.artist && <span className="text-tv-base text-chalk-soft truncate shrink">{current.artist}</span>}
                      </div>
                      <div className="text-tv-sm text-chalk-muted mt-1.5 truncate">
                        {current.auto ? 'Repioché · ajouté par ' : 'Ajouté par '}
                        <b className="text-chalk font-semibold">{adder?.pseudo ?? 'quelqu’un'}</b>
                        {current.dedication && <span className="text-chalk-soft"> · « {current.dedication} »</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <h1 className="font-stage text-tv-2xl text-chalk line-clamp-3 [overflow-wrap:anywhere]">{current.title}</h1>
                      {current.artist && <p className="text-tv-lg text-chalk-soft mt-2 truncate">{current.artist}</p>}
                      <div className="flex items-center gap-3 mt-6">
                        {adder && <Avatar pseudo={adder.pseudo} color={adder.color} size={30} photoUrl={adder.photoUrl} />}
                        <div className="text-tv-sm text-chalk-muted truncate">
                          {current.auto ? 'Repioché · ajouté par ' : 'Ajouté par '}
                          <b className="text-chalk font-semibold">{adder?.pseudo ?? 'quelqu’un'}</b>
                          {reactionTotal(current) > 0 && <span className="text-chalk-soft"> · {reactionTotal(current)} réactions</span>}
                        </div>
                      </div>
                    </>
                  )}
                  {current.dedication && !mediaVisible && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      className="mt-5 rounded-card border border-spark/40 bg-felt/80 px-5 py-3.5 text-tv-base text-chalk leading-snug line-clamp-2 [overflow-wrap:anywhere]"
                    >
                      « {current.dedication} »
                    </motion.p>
                  )}
                </motion.div>
              ) : (
                <div>
                  <p className="kicker text-tv-xs mb-3">La platine attend</p>
                  <h1 className="font-stage text-tv-2xl text-chalk">Le premier morceau, c’est vous</h1>
                  <p className="text-tv-base text-chalk-soft mt-4 max-w-[26rem]">Scannez le code, cherchez un titre : il part tout de suite.</p>
                </div>
              )}
            </div>
          </div>

          {current && (
            <div className="shrink-0 pt-5">
              <MusicProgress tv />
              <Equalizer playing={spinning} bars={44} className={clsx('mt-3', mediaVisible ? 'h-8' : 'h-14')} />
            </div>
          )}

          <NextAnnouncement crossfadeNext={crossfadeNext} />
        </section>

        {/* ---- La salle : la suite, rejoindre, le fil ---- */}
        <aside className="flex flex-col min-h-0 gap-5">
          <UpNext />
          <div className="flex-1" />
          <JoinCard code={code} />
          <FeedLines />
        </aside>
      </div>
    </div>
  )
}

function UpNext() {
  const music = usePartyStore((s) => s.group?.music)
  const { byId } = useMemberLookup()
  if (!music) return null
  const queue = orderedQueue(music)
  const auto = queue.length === 0 && music.settings.continuous ? music.autoNext : null
  const list = auto ? [auto] : queue.slice(0, 5)
  const totalMs = queue.reduce((sum, t) => sum + (t.durationMs ?? AVERAGE_TRACK_MS), 0)
  return (
    <div className="min-h-0">
      <p className="kicker text-tv-xs mb-3 flex justify-between">
        <span>À suivre</span>
        {queue.length > 0 && (
          <span>
            {queue.length} · ~{formatSpan(totalMs)}
          </span>
        )}
      </p>
      {list.length === 0 ? (
        <p className="text-tv-sm text-chalk-faint">Rien pour l’instant — à vous de jouer.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {list.map((t, i) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ layout: { type: 'spring', stiffness: 300, damping: 32 } }}
                className="flex items-center gap-3"
              >
                <span className="w-4 text-tv-xs text-chalk-faint tabular-nums text-right">{i + 1}</span>
                <TrackArt src={t.thumbnail} size={46} />
                <div className="min-w-0 flex-1">
                  <p className="text-tv-sm text-chalk truncate">{t.title}</p>
                  <p className="text-tv-xs text-chalk-faint truncate">
                    {t.auto ? 'Mode continu · ' : ''}
                    {byId(t.addedById)?.pseudo ?? 'Quelqu’un'}
                    {t.pinnedAt ? ' · ensuite' : ''}
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}

/** Le coin « ajoutez votre musique » : c'est l'action que la pièce doit faire, il est généreux. */
export function JoinCard({ code, size = 112 }: { code: string; size?: number }) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-line bg-felt/85 p-3.5">
      <QRCode value={joinUrl(code)} size={size} />
      <div className="min-w-0">
        <p className="kicker text-tv-xs mb-1.5">Ajoute ta musique</p>
        <p className="font-stage text-tv-xl text-brass tracking-[0.14em] leading-none">{code}</p>
        <p className="text-tv-xs text-chalk-soft mt-2 leading-snug">Scanne, cherche un titre : il entre dans la file, chacun son tour.</p>
      </div>
    </div>
  )
}

/** Les trois derniers faits de la soirée, les plus récents en bas, qui pâlissent avec l'âge. */
function FeedLines() {
  const feed = usePartyStore((s) => s.group?.music?.feed)
  const serverNow = usePartyStore((s) => s.serverNow)
  const { name } = useMemberLookup()
  useNow(5000)
  const now = serverNow()
  const recent = (feed ?? []).filter((e) => now - e.at < FEED_FRESH_MS * 3).slice(-3)
  if (recent.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5 min-h-[4.2rem] justify-end">
      <AnimatePresence initial={false}>
        {recent.map((e, i) => (
          <motion.li
            key={e.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: i === recent.length - 1 ? 1 : 0.55, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-tv-xs text-chalk-muted truncate flex items-center gap-2"
          >
            <span
              className={clsx('w-1.5 h-1.5 rounded-full shrink-0', e.kind === 'platineOff' || e.kind === 'unplayable' ? 'bg-blood' : 'bg-spark')}
            />
            {feedText(e, name)}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

/**
 * L'annonce du suivant : elle glisse en bas de la scène pendant le fondu enchaîné, ou dans les
 * dernières secondes d'un morceau. Le public sait ce qui arrive — et qui l'a choisi.
 */
function NextAnnouncement({ crossfadeNext }: { crossfadeNext: MusicTrack | null }) {
  const music = usePartyStore((s) => s.group?.music)
  const { remainingMs } = useTrackClock(500)
  const { byId } = useMemberLookup()
  const upcoming = crossfadeNext ?? (music && music.isPlaying && remainingMs !== null && remainingMs < ANNOUNCE_MS ? peekNext(music) : null)
  const by = upcoming ? byId(upcoming.addedById) : undefined
  return (
    <AnimatePresence>
      {upcoming && (
        <motion.div
          key={upcoming.id}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.55, ease: [0.16, 1.02, 0.3, 1] }}
          className="absolute left-0 right-0 bottom-0 flex items-center gap-4 rounded-card border border-spark/50 bg-felt-raised/95 shadow-float px-4 py-3"
        >
          <TrackArt src={upcoming.thumbnail} size={56} />
          <div className="min-w-0 flex-1">
            <p className="kicker text-tv-xs text-spark">{crossfadeNext ? 'Ça enchaîne sur' : 'Ensuite'}</p>
            <p className="text-tv-lg text-chalk font-semibold truncate">{upcoming.title}</p>
          </div>
          <div className="text-tv-sm text-chalk-soft shrink-0 flex items-center gap-2">
            {upcoming.auto ? <IconMusic size={18} /> : by && <Avatar pseudo={by.pseudo} color={by.color} size={26} photoUrl={by.photoUrl} />}
            {upcoming.auto ? 'Mode continu' : (by?.pseudo ?? '')}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
