import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Avatar } from '../components/Avatar'
import { useAppStore } from '../store/useAppStore'
import { usePartyStore } from '../store/usePartyStore'
import { useSound } from '../hooks/useSound'
import { orderedQueue, skipThreshold, parseYouTubeId, youtubeThumb, formatDuration, totalDurationMs } from '../lib/jukebox'
import { fetchYouTubeMeta, searchYouTubeHybrid, type YouTubeSearchResult } from '../lib/youtube'
import type { Member, MusicSession, MusicTrack } from '../types'

export function SoireePage() {
  const navigate = useNavigate()
  const identity = useAppStore((s) => s.identity)
  const leaveGroup = useAppStore((s) => s.leaveGroup)
  const connectAsPlayer = usePartyStore((s) => s.connectAsPlayer)
  const disconnect = usePartyStore((s) => s.disconnect)
  const stopMusic = usePartyStore((s) => s.stopMusic)
  const musicAction = usePartyStore((s) => s.musicAction)
  const isHost = usePartyStore((s) => s.isHost())
  const group = usePartyStore((s) => s.group)
  const music = usePartyStore((s) => s.group?.music ?? null)
  const partyError = usePartyStore((s) => s.error)
  const clearError = usePartyStore((s) => s.clearError)
  const { play } = useSound()

  useEffect(() => {
    connectAsPlayer()
  }, [connectAsPlayer])

  // Le mode soirée s'est terminé (l'hôte a coupé) -> retour au salon.
  useEffect(() => {
    if (group && !music) navigate('/lobby')
  }, [group, music, navigate])

  if (!identity || !group || !music) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-white/40 text-sm">Connexion au mode soirée…</p>
      </div>
    )
  }

  const memberById = (id: string): Member | undefined => group.members.find((m) => m.id === id)
  const queue = orderedQueue(music)
  const threshold = skipThreshold(group.members.length)
  const myId = identity.memberId

  const handleEnd = () => {
    play('pop')
    stopMusic()
  }
  const handleLeaveRoom = () => {
    play('pop')
    disconnect()
    leaveGroup()
    navigate('/')
  }
  const openPlatine = () => {
    const url = `${window.location.origin}${window.location.pathname}#/platine/${group.code}`
    window.open(url, '_blank')
  }

  return (
    <PageTransition>
      <div className="px-5 pt-8 pb-16 safe-top max-w-lg mx-auto">
        <div className="text-center mb-5">
          <p className="text-xs uppercase tracking-widest text-white/40">Mode Soirée</p>
          <h1 className="text-3xl font-extrabold shimmer-text mb-1">🎶 La platine partagée</h1>
          <p className="text-sm text-white/50">
            Salle <span className="font-bold tracking-widest text-white/80">{group.code}</span> · file équitable
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            {isHost ? (
              <button
                onClick={handleEnd}
                className="rounded-full bg-pink-500/12 border border-pink-400/30 px-4 py-2 text-xs font-semibold text-pink-200/90 active:bg-pink-500/25"
              >
                ⏹ Terminer la soirée
              </button>
            ) : (
              <span className="text-xs text-white/40">L'hôte gère la platine</span>
            )}
            <button
              onClick={handleLeaveRoom}
              className="rounded-full bg-white/8 border border-white/12 px-4 py-2 text-xs font-semibold text-white/55 active:bg-white/15"
            >
              🚪 Quitter
            </button>
          </div>
        </div>

        {partyError && (
          <Card className="mb-4 border-pink-500/40">
            <p className="text-sm text-pink-300">{partyError}</p>
            <button onClick={clearError} className="text-xs text-white/40 mt-1">Fermer</button>
          </Card>
        )}

        <NowPlaying
          music={music}
          isHost={isHost}
          myId={myId}
          threshold={threshold}
          addedBy={music.current ? memberById(music.current.addedById) : undefined}
          onTogglePlay={() => musicAction('setPlayback', { isPlaying: !music.isPlaying })}
          onHostSkip={() => { play('pop'); musicAction('hostSkip') }}
          onVoteSkip={() => { play('pop'); musicAction('voteSkip') }}
        />

        <AddSong source={music.source} onAdd={musicAction} />

        {/* File d'attente */}
        <div className="flex items-baseline justify-between mt-6 mb-2 px-1">
          <h3 className="text-sm font-bold text-white/70">
            À suivre ({queue.length}{totalDurationMs(queue) > 0 ? ` · ${formatDuration(totalDurationMs(queue))}` : ''})
          </h3>
          <span className="text-[10px] text-white/30">▲ = fais monter dans la file</span>
        </div>
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {queue.map((track, i) => (
              <QueueRow
                key={track.id}
                track={track}
                rank={i + 1}
                addedBy={memberById(track.addedById)}
                myId={myId}
                isHost={isHost}
                onBump={() => { play('tick'); musicAction('bump', { trackId: track.id }) }}
                onRemove={() => { play('pop'); musicAction('remove', { trackId: track.id }) }}
              />
            ))}
          </AnimatePresence>
          {queue.length === 0 && (
            <p className="text-center text-white/30 text-sm py-6">
              File vide — ajoute une musique, elle passera juste après. 🎵
            </p>
          )}
        </div>

        {/* Rappel platine */}
        <Card className="mt-6 text-center" delay={0.1}>
          <p className="text-sm font-semibold mb-1">🔊 La platine (lecture du son)</p>
          <p className="text-xs text-white/50 mb-3">
            Sur l'appareil branché à l'enceinte, ouvre la <b>platine</b> avec le code <b>{group.code}</b>.
            C'est elle qui joue la musique — les téléphones ne font qu'alimenter la file.
          </p>
          <Button variant="secondary" fullWidth onClick={openPlatine} className="!py-2.5 text-sm">
            Ouvrir la platine (nouvel onglet)
          </Button>
        </Card>
      </div>
    </PageTransition>
  )
}

function NowPlaying({
  music,
  isHost,
  myId,
  threshold,
  addedBy,
  onTogglePlay,
  onHostSkip,
  onVoteSkip,
}: {
  music: MusicSession
  isHost: boolean
  myId: string
  threshold: number
  addedBy: Member | undefined
  onTogglePlay: () => void
  onHostSkip: () => void
  onVoteSkip: () => void
}) {
  const musicPosition = usePartyStore((s) => s.musicPosition)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const current = music.current
  if (!current) {
    return (
      <Card className="text-center py-8">
        <span className="text-4xl">🎵</span>
        <p className="text-white/60 text-sm mt-2">Aucune musique en lecture — ajoute la première !</p>
      </Card>
    )
  }

  const durationMs = musicPosition?.durationMs ?? current.durationMs ?? null
  const baseMs = musicPosition?.positionMs ?? 0
  const elapsedMs = musicPosition?.isPlaying ? baseMs + (now - musicPosition.at) : baseMs
  const progress = durationMs ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 0

  const iVoted = music.skipVotes.includes(myId)

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3">
        {current.thumbnail ? (
          <img src={current.thumbnail} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">🎵</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-emerald-300/80 mb-0.5">● En lecture</p>
          <p className="font-bold leading-tight line-clamp-2">{current.title}</p>
          {current.artist && <p className="text-white/50 text-xs truncate">{current.artist}</p>}
          {addedBy && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Avatar pseudo={addedBy.pseudo} color={addedBy.color} size={18} photoUrl={addedBy.photoUrl} />
              <span className="text-[11px] text-white/40">ajoutée par {addedBy.pseudo}</span>
            </div>
          )}
        </div>
      </div>

      {durationMs != null && (
        <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-fuchsia-400/80" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        {isHost && (
          <>
            <button
              onClick={onTogglePlay}
              className="rounded-full bg-white/10 border border-white/15 h-10 px-4 text-sm font-semibold active:bg-white/20"
            >
              {music.isPlaying ? '⏸ Pause' : '▶ Lecture'}
            </button>
            <button
              onClick={onHostSkip}
              className="rounded-full bg-white/10 border border-white/15 h-10 px-4 text-sm font-semibold active:bg-white/20"
            >
              ⏭ Passer
            </button>
          </>
        )}
        <button
          onClick={onVoteSkip}
          className={`flex-1 rounded-full h-10 px-4 text-sm font-semibold border transition-colors ${
            iVoted
              ? 'bg-pink-500/25 border-pink-400/50 text-pink-100'
              : 'bg-white/8 border-white/12 text-white/70 active:bg-white/15'
          }`}
        >
          🚫 Passer ({music.skipVotes.length}/{threshold})
        </button>
      </div>
    </Card>
  )
}

function AddSong({ source, onAdd }: { source: MusicTrack['source']; onAdd: (type: string, payload?: unknown) => void }) {
  const { play } = useSound()
  const [mode, setMode] = useState<'search' | 'link'>('search')
  const [link, setLink] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  if (source === 'spotify') {
    return (
      <Card className="mt-4 text-center">
        <span className="text-3xl">🎧</span>
        <p className="text-sm font-semibold mt-1 mb-1">Source Spotify</p>
        <p className="text-xs text-white/50">
          Relance le Mode Soirée en choisissant <b>YouTube</b> pour une file qui marche tout de suite.
        </p>
      </Card>
    )
  }

  const addYouTube = async (
    videoId: string,
    title?: string,
    artist?: string,
    thumbnail?: string,
    durationMs?: number | null,
  ) => {
    setBusy(true)
    setLocalError(null)
    let finalTitle = title ?? ''
    let finalArtist = artist ?? ''
    if (!finalTitle) {
      const meta = await fetchYouTubeMeta(videoId)
      if (meta) {
        finalTitle = meta.title
        finalArtist = meta.artist
      }
    }
    onAdd('add', {
      source: 'youtube',
      sourceId: videoId,
      title: finalTitle || 'Vidéo YouTube',
      artist: finalArtist,
      thumbnail: thumbnail ?? youtubeThumb(videoId),
      durationMs: durationMs ?? null,
    })
    play('pop')
    setBusy(false)
  }

  const submitLink = async () => {
    const id = parseYouTubeId(link)
    if (!id) {
      setLocalError('Lien YouTube non reconnu. Colle une URL youtube.com ou youtu.be.')
      return
    }
    await addYouTube(id)
    setLink('')
  }

  const submitSearch = async () => {
    if (!query.trim()) return
    setBusy(true)
    setSearched(true)
    setLocalError(null)
    try {
      setResults(await searchYouTubeHybrid(query.trim()))
    } catch {
      setResults([])
      setLocalError('Recherche indisponible pour le moment — bascule sur « Lien » et colle une URL YouTube.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white/70">➕ Ajouter une musique</h3>
        <div className="flex gap-1 text-xs">
          <TabPill active={mode === 'search'} onClick={() => setMode('search')}>Rechercher</TabPill>
          <TabPill active={mode === 'link'} onClick={() => setMode('link')}>Lien</TabPill>
        </div>
      </div>

      {mode === 'link' ? (
        <div className="flex gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitLink()}
            placeholder="Colle un lien YouTube…"
            className="flex-1 rounded-2xl bg-white/8 border border-white/10 px-3.5 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-400/60"
          />
          <button
            onClick={submitLink}
            disabled={busy || !link.trim()}
            className="rounded-2xl bg-fuchsia-500/80 px-4 text-sm font-bold disabled:opacity-40 active:bg-fuchsia-500"
          >
            {busy ? '…' : 'Ajouter'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder="Titre, artiste…"
              className="flex-1 rounded-2xl bg-white/8 border border-white/10 px-3.5 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-400/60"
            />
            <button
              onClick={submitSearch}
              disabled={busy || !query.trim()}
              className="rounded-2xl bg-fuchsia-500/80 px-4 text-sm font-bold disabled:opacity-40 active:bg-fuchsia-500"
            >
              {busy ? '…' : '🔍'}
            </button>
          </div>
          {results.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-3 max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.videoId}
                  onClick={() => addYouTube(r.videoId, r.title, r.artist, r.thumbnail, r.durationMs)}
                  className="flex items-center gap-2.5 text-left rounded-xl p-1.5 active:bg-white/10"
                >
                  <img src={r.thumbnail} alt="" className="w-12 h-9 rounded object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{r.title}</p>
                    <p className="text-[11px] text-white/40 truncate">
                      {r.artist}{r.durationMs ? ` · ${formatDuration(r.durationMs)}` : ''}
                    </p>
                  </div>
                  <span className="text-fuchsia-300 text-lg shrink-0">＋</span>
                </button>
              ))}
            </div>
          )}
          {searched && !busy && results.length === 0 && !localError && (
            <p className="text-[11px] text-white/30 mt-2">Aucun résultat.</p>
          )}
        </>
      )}

      {localError && <p className="text-xs text-pink-300 mt-2">{localError}</p>}
    </Card>
  )
}

function QueueRow({
  track,
  rank,
  addedBy,
  myId,
  isHost,
  onBump,
  onRemove,
}: {
  track: MusicTrack
  rank: number
  addedBy: Member | undefined
  myId: string
  isHost: boolean
  onBump: () => void
  onRemove: () => void
}) {
  const isMine = track.addedById === myId
  const iBumped = track.bumpVotes.includes(myId)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-2.5 rounded-2xl bg-white/5 border border-white/8 p-2"
    >
      <span className="text-xs text-white/30 w-4 text-center shrink-0">{rank}</span>
      {track.thumbnail ? (
        <img src={track.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center shrink-0">🎵</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{track.title}</p>
        <div className="flex items-center gap-1.5">
          {addedBy && <Avatar pseudo={addedBy.pseudo} color={addedBy.color} size={14} photoUrl={addedBy.photoUrl} />}
          <span className="text-[11px] text-white/40 truncate">
            {addedBy?.pseudo ?? '?'}{track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ''}
          </span>
        </div>
      </div>
      <button
        onClick={onBump}
        disabled={isMine}
        className={`shrink-0 rounded-full h-8 px-2.5 text-xs font-bold border transition-colors ${
          iBumped
            ? 'bg-fuchsia-500/30 border-fuchsia-400/50 text-fuchsia-100'
            : 'bg-white/8 border-white/12 text-white/60 active:bg-white/15'
        } ${isMine ? 'opacity-30' : ''}`}
        aria-label="Faire monter dans la file"
      >
        ▲ {track.bumpVotes.length}
      </button>
      {(isMine || isHost) && (
        <button
          onClick={onRemove}
          className="shrink-0 rounded-full h-8 w-8 text-white/40 bg-white/5 border border-white/10 active:bg-white/15"
          aria-label="Retirer de la file"
        >
          ✕
        </button>
      )}
    </motion.div>
  )
}

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 font-semibold ${active ? 'bg-fuchsia-500/30 text-white' : 'bg-white/6 text-white/50'}`}
    >
      {children}
    </button>
  )
}
