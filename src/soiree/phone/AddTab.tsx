import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../../store/usePartyStore'
import { useAppStore } from '../../store/useAppStore'
import { useSound } from '../../hooks/useSound'
import {
  formatDuration,
  looksLikeUrl,
  parseSpotifyTrackId,
  parseYouTubeId,
  youtubeThumb,
  MAX_DEDICATION,
  MAX_QUEUE_PER_PLAYER,
} from '../../lib/jukebox'
import { fetchYouTubeMeta, searchYouTube } from '../../lib/youtube'
import { searchSpotify, fetchAlbumTracks, fetchArtistTracks, fetchSpotifyTrack } from '../../lib/spotify'
import { Surface } from '../../components/Card'
import { IconAlert, IconArrowLeft, IconChat, IconCheck, IconClose, IconLink, IconPlus, IconSearch } from '../../components/icons'
import { TrackArt } from '../ui'

/** Un résultat de recherche, toutes sources confondues. */
interface Candidate {
  id: string
  title: string
  artist: string
  thumbnail: string | null
  durationMs: number | null
  /** Spotify : un album ou un artiste s'ouvre sur ses titres au lieu de s'ajouter. */
  kind?: 'track' | 'album' | 'artist'
}

const IDEAS = ['Années 80', 'Rap français', 'Disco', 'Chanson française', 'Dancefloor', 'Rock']

/**
 * « Ajouter » : on tape, les résultats arrivent au fil de la frappe ; on colle un lien, il est
 * reconnu tout seul. Chaque résultat dit où il en est (« dans la file », « ajouté »), et l'ajout
 * peut porter une dédicace.
 */
export function AddTab({ onAdded }: { onAdded: (trackId: string) => void }) {
  const music = usePartyStore((s) => s.group?.music)
  const musicAction = usePartyStore((s) => s.musicAction)
  const myId = useAppStore((s) => s.identity?.memberId)
  const { play } = useSound()
  const source = music?.source ?? 'youtube'

  const [query, setQuery] = useState('')
  const [dedication, setDedication] = useState('')
  const [withDedication, setWithDedication] = useState(false)
  const [results, setResults] = useState<Candidate[]>([])
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [link, setLink] = useState<Candidate | null>(null)
  const [expanded, setExpanded] = useState<Candidate | null>(null)
  const [expandedTracks, setExpandedTracks] = useState<Candidate[] | null>(null)

  const trimmed = query.trim()
  const isLink = looksLikeUrl(trimmed)
  const linkId = isLink ? (source === 'youtube' ? parseYouTubeId(trimmed) : parseSpotifyTrackId(trimmed)) : null

  // Lien collé : on retrouve le titre (sans attendre pour proposer l'ajout).
  useEffect(() => {
    setLink(null)
    if (!linkId) return
    let cancelled = false
    const base: Candidate = { id: linkId, title: '', artist: '', thumbnail: source === 'youtube' ? youtubeThumb(linkId) : null, durationMs: null }
    setLink(base)
    const load =
      source === 'youtube'
        ? fetchYouTubeMeta(linkId).then((m) => (m ? { ...base, title: m.title, artist: m.artist } : base))
        : fetchSpotifyTrack(linkId).then((t) =>
            t ? { ...base, title: t.title, artist: t.artist, thumbnail: t.thumbnail, durationMs: t.durationMs } : base,
          )
    void load.then((c) => {
      if (!cancelled) setLink({ ...c, title: c.title || (source === 'youtube' ? 'Vidéo YouTube' : 'Titre Spotify') })
    })
    return () => {
      cancelled = true
    }
  }, [linkId, source])

  // Recherche au fil de la frappe : on attend une courte pause, et la frappe suivante annule la
  // requête en cours (pas de résultats d'une ancienne recherche qui arrivent après la nouvelle).
  useEffect(() => {
    setExpanded(null)
    if (isLink || trimmed.length < 2) {
      setResults([])
      setPhase('idle')
      return
    }
    const ctrl = new AbortController()
    setPhase('loading')
    const timer = window.setTimeout(async () => {
      try {
        const list: Candidate[] =
          source === 'youtube'
            ? (await searchYouTube(trimmed, ctrl.signal)).map((r) => ({
                id: r.videoId,
                title: r.title,
                artist: r.artist,
                thumbnail: r.thumbnail,
                durationMs: r.durationMs,
              }))
            : (await searchSpotify(trimmed, ctrl.signal)).map((r) => ({
                id: r.id,
                title: r.title,
                artist: r.subtitle ?? r.artist,
                thumbnail: r.thumbnail,
                durationMs: r.durationMs,
                kind: r.kind ?? 'track',
              }))
        if (ctrl.signal.aborted) return
        setResults(list)
        setPhase('done')
      } catch (e) {
        if (ctrl.signal.aborted) return
        setResults([])
        setPhase('error')
        setErrorText(
          source === 'youtube'
            ? 'Recherche indisponible pour le moment. Colle un lien YouTube : ça marche toujours.'
            : e instanceof Error
              ? e.message
              : 'Recherche Spotify indisponible pour le moment.',
        )
      }
    }, 380)
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [trimmed, isLink, source])

  if (!music) return null
  const mine = music.queue.filter((t) => t.addedById === myId).length
  const full = mine >= MAX_QUEUE_PER_PLAYER

  const stateOf = (id: string): 'playing' | 'mine' | 'queued' | 'free' => {
    if (music.current?.sourceId === id) return 'playing'
    const queued = music.queue.find((t) => t.sourceId === id)
    if (!queued) return 'free'
    return queued.addedById === myId ? 'mine' : 'queued'
  }

  const add = async (c: Candidate) => {
    if (sending || full) return
    setSending(c.id)
    const ack = await musicAction('add', {
      source,
      sourceId: c.id,
      title: c.title || (source === 'youtube' ? 'Vidéo YouTube' : 'Titre Spotify'),
      artist: c.artist,
      thumbnail: c.thumbnail ?? (source === 'youtube' ? youtubeThumb(c.id) : null),
      durationMs: c.durationMs,
      dedication: withDedication ? dedication : null,
    })
    setSending(null)
    if (!ack.ok || !ack.trackId) return
    play('pop')
    if (withDedication) {
      setDedication('')
      setWithDedication(false)
    }
    if (isLink) setQuery('')
    onAdded(ack.trackId)
  }

  const open = async (c: Candidate) => {
    if (!c.kind || c.kind === 'track') return add(c)
    setExpanded(c)
    setExpandedTracks(null)
    try {
      const tracks = c.kind === 'album' ? await fetchAlbumTracks(c.id) : await fetchArtistTracks(c.title)
      // Les titres d'un album arrivent sans pochette : on leur donne celle de l'album.
      setExpandedTracks(
        tracks.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          thumbnail: t.thumbnail ?? c.thumbnail,
          durationMs: t.durationMs,
          kind: 'track',
        })),
      )
    } catch {
      setExpandedTracks([])
    }
  }

  const rows = (list: Candidate[]) => (
    <ul className="flex flex-col">
      {list.map((c, i) => (
        <motion.li
          key={`${c.kind ?? 'track'}-${c.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 8) * 0.025, duration: 0.2 }}
          className="flex items-center gap-3 py-2 border-b border-line last:border-b-0"
        >
          <TrackArt src={c.thumbnail} size={48} round={c.kind === 'artist'} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-chalk leading-snug line-clamp-2 [overflow-wrap:anywhere]">{c.title}</p>
            <p className="text-2xs text-chalk-faint truncate mt-0.5">
              {c.kind === 'album' ? 'Album · ' : ''}
              {c.artist}
              {c.durationMs ? ` · ${formatDuration(c.durationMs)}` : ''}
            </p>
          </div>
          {c.kind && c.kind !== 'track' ? (
            <button onClick={() => void open(c)} className="shrink-0 h-9 px-3 rounded-chip border border-line text-xs text-chalk-soft">
              Voir les titres
            </button>
          ) : (
            <AddState state={stateOf(c.id)} busy={sending === c.id} disabled={full || !!sending} onAdd={() => void add(c)} />
          )}
        </motion.li>
      ))}
    </ul>
  )

  return (
    <div>
      {/* Champ unique : une recherche OU un lien. */}
      <label className="relative block">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chalk-faint">
          {isLink ? <IconLink size={18} /> : <IconSearch size={18} />}
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={source === 'youtube' ? 'Titre, artiste ou lien YouTube' : 'Titre, artiste ou lien Spotify'}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full h-12 rounded-control bg-felt border border-line-strong pl-11 pr-11 text-base text-chalk placeholder:text-chalk-faint outline-none focus:border-spark"
          aria-label="Rechercher un morceau ou coller un lien"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-chip text-chalk-soft"
            aria-label="Effacer"
          >
            <IconClose size={16} />
          </button>
        )}
      </label>

      {/* Dédicace : facultative, jointe au prochain ajout. */}
      <div className="mt-2.5">
        {withDedication ? (
          <div className="rounded-control bg-felt/80 border border-line px-3 py-2">
            <div className="flex items-center gap-2">
              <IconChat size={16} className="text-spark shrink-0" />
              <input
                autoFocus
                value={dedication}
                maxLength={MAX_DEDICATION}
                onChange={(e) => setDedication(e.target.value)}
                placeholder="Pour qui, pourquoi ?"
                className="flex-1 min-w-0 bg-transparent text-sm text-chalk placeholder:text-chalk-faint outline-none h-8"
                aria-label="Dédicace"
              />
              <button
                onClick={() => {
                  setDedication('')
                  setWithDedication(false)
                }}
                className="w-7 h-7 flex items-center justify-center text-chalk-faint"
                aria-label="Retirer la dédicace"
              >
                <IconClose size={14} />
              </button>
            </div>
            <p className="text-2xs text-chalk-faint mt-1">
              Jointe à ton prochain ajout, affichée sur la platine · {dedication.length}/{MAX_DEDICATION}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setWithDedication(true)} className="flex items-center gap-1.5 text-xs text-chalk-soft py-1.5">
              <IconChat size={15} />
              Ajouter une dédicace
            </button>
            <span className={clsx('text-2xs tabular-nums', full ? 'text-blood' : 'text-chalk-faint')}>
              {mine}/{MAX_QUEUE_PER_PLAYER} en attente
            </span>
          </div>
        )}
      </div>

      {full && (
        <p className="text-xs text-chalk-soft mt-2">Tu as {MAX_QUEUE_PER_PLAYER} morceaux en attente : laisse passer les autres, puis reviens.</p>
      )}

      <div className="mt-3">
        {/* Lien collé. */}
        {isLink &&
          (link ? (
            <Surface className="!p-3 flex items-center gap-3">
              <TrackArt src={link.thumbnail} size={56} />
              <div className="min-w-0 flex-1">
                <p className="kicker text-2xs">Lien reconnu</p>
                <p className="text-sm text-chalk leading-snug line-clamp-2 [overflow-wrap:anywhere]">{link.title || '…'}</p>
                {link.artist && <p className="text-2xs text-chalk-faint truncate">{link.artist}</p>}
              </div>
              <AddState state={stateOf(link.id)} busy={sending === link.id} disabled={full || !!sending} onAdd={() => void add(link)} />
            </Surface>
          ) : (
            <p className="flex items-center gap-2 text-xs text-chalk-soft">
              <IconAlert size={15} className="text-blood" />
              {source === 'youtube' ? 'Ce lien n’est pas une vidéo YouTube.' : 'Ce lien n’est pas un titre Spotify.'}
            </p>
          ))}

        {/* Album / artiste Spotify ouvert. */}
        {!isLink && expanded && (
          <div>
            <button onClick={() => setExpanded(null)} className="flex items-center gap-2 text-xs text-chalk-soft mb-2 py-1">
              <IconArrowLeft size={15} />
              {expanded.title}
            </button>
            {expandedTracks === null ? (
              <Skeleton />
            ) : expandedTracks.length ? (
              rows(expandedTracks)
            ) : (
              <p className="text-xs text-chalk-faint py-3">Aucun titre trouvé.</p>
            )}
          </div>
        )}

        {!isLink && !expanded && phase === 'loading' && <Skeleton />}
        {!isLink &&
          !expanded &&
          phase === 'done' &&
          (results.length ? rows(results) : <p className="text-xs text-chalk-faint py-3">Aucun résultat pour « {trimmed} ».</p>)}
        {!isLink && !expanded && phase === 'error' && (
          <Surface className="!p-3.5 flex items-start gap-2.5">
            <IconAlert size={17} className="text-blood shrink-0 mt-0.5" />
            <p className="text-xs text-chalk-soft leading-relaxed">{errorText}</p>
          </Surface>
        )}
        {!isLink && phase === 'idle' && (
          <div>
            <p className="kicker text-2xs mb-2">Idées</p>
            <div className="flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  onClick={() => setQuery(idea)}
                  className="h-9 px-3.5 rounded-chip bg-felt/80 border border-line text-xs text-chalk-muted active:bg-felt-raised"
                >
                  {idea}
                </button>
              ))}
            </div>
            <p className="text-2xs text-chalk-faint mt-4 leading-relaxed">
              {source === 'youtube'
                ? 'Astuce : depuis l’appli YouTube, « Partager › Copier le lien », puis colle-le ici.'
                : 'Astuce : depuis Spotify, « Partager › Copier le lien du titre », puis colle-le ici.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** L'état d'un résultat : déjà en cours, déjà dans la file (le mien ou celui d'un autre), ou à ajouter. */
function AddState({
  state,
  busy,
  disabled,
  onAdd,
}: {
  state: 'playing' | 'mine' | 'queued' | 'free'
  busy: boolean
  disabled: boolean
  onAdd: () => void
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {state === 'free' ? (
        <motion.button
          key="add"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          whileTap={{ scale: 0.88 }}
          onClick={onAdd}
          disabled={disabled}
          className={clsx(
            'shrink-0 w-10 h-10 rounded-chip border flex items-center justify-center disabled:opacity-40',
            busy ? 'border-spark/40 text-spark/60 animate-pulse' : 'border-spark text-spark',
          )}
          aria-label="Ajouter à la file"
        >
          <IconPlus size={18} />
        </motion.button>
      ) : (
        <motion.span
          key={state}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          className={clsx(
            'shrink-0 h-8 px-2.5 rounded-chip flex items-center gap-1 text-2xs font-semibold whitespace-nowrap',
            state === 'mine' ? 'bg-jade/15 text-jade' : 'bg-felt-raised text-chalk-soft',
          )}
        >
          {state === 'mine' && <IconCheck size={13} />}
          {state === 'mine' ? 'Ajouté' : state === 'playing' ? 'En cours' : 'Dans la file'}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-[0.6rem] bg-felt-raised animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-3/4 rounded-chip bg-felt-raised animate-pulse" />
            <div className="h-2.5 w-1/3 rounded-chip bg-felt-raised animate-pulse mt-2" />
          </div>
        </div>
      ))}
    </div>
  )
}
