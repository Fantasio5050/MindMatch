export type TraitKey =
  | 'creativity'
  | 'logic'
  | 'ambition'
  | 'empathy'
  | 'independence'
  | 'sociability'
  | 'organization'

export type TraitScores = Record<TraitKey, number>

export interface QuestionOption {
  id: string
  label: string
  emoji?: string
  weights: Partial<Record<TraitKey, number>>
}

export type QuestionCategory = 'personality' | 'values' | 'dilemma' | 'preference'

export interface Question {
  id: string
  category: QuestionCategory
  prompt: string
  options: QuestionOption[]
}

export interface Archetype {
  id: string
  name: string
  emoji: string
  tagline: string
  description: string
}

export interface Member {
  id: string
  pseudo: string
  color: string
  answers: Record<string, string>
  scores: TraitScores | null
  archetypeId: string | null
  finishedAt: number | null
  /** Numéro du passage au test, incrémenté à chaque « Refaire le test ». Il sert de graine au
   * tirage des questions : c'est lui qui garantit qu'un second passage ne repose pas les mêmes. */
  quizAttempt: number
  xp: number
  badges: string[]
  gameStats: Record<string, number>
  /** Data URL (small, client-compressed) of a user-chosen profile photo, or null for the default
   * initials avatar. */
  photoUrl: string | null
}

export type PartyStatus = 'lobby' | 'playing' | 'ended'

export interface PartySession {
  status: PartyStatus
  hostMemberId: string
  currentGameId: string | null
  phase: string | null
  round: number
  roundData: unknown
  /** Snapshot of member ids present when the current game started. Anyone who joins the group
   * while this list is non-empty (i.e. a game is active) is not in it, and the client shows them
   * a waiting screen instead of the live game UI — cleaner than teaching every game module how to
   * cope with a player appearing mid-round. Reset to the full roster on each new game start. */
  participantIds: string[]
}

/** Mode Soirée (jukebox) — a shared music queue that runs alongside the party, independent of the
 * mini-games. Everyone submits songs from their phone; a single "platine" device (connected to the
 * Bluetooth speaker) actually plays them. Sources are pluggable; the host picks one at launch. */
export type MusicSource = 'youtube' | 'spotify'

export interface MusicTrack {
  /** Internal queue id (unique per submission), distinct from the platform id. */
  id: string
  source: MusicSource
  /** Platform id: a YouTube videoId, or a Spotify track id/uri. */
  sourceId: string
  title: string
  artist: string
  thumbnail: string | null
  durationMs: number | null
  addedById: string
  bumpVotes: string[]
  addedAt: number
}

export interface MusicSession {
  source: MusicSource
  hostMemberId: string
  /** Upcoming tracks in raw insertion order — the fair (round-robin) play order is derived from
   * this on the fly by `orderedQueue` (src/lib/jukebox.ts), shared by client and server. */
  queue: MusicTrack[]
  current: MusicTrack | null
  /** Most-recent-first, capped — powers an "already played" strip and round-robin fairness. */
  history: MusicTrack[]
  isPlaying: boolean
  /** Member ids currently voting to skip the now-playing track. */
  skipVotes: string[]
  /** memberId -> how many of their songs have already been given airtime this session. Drives the
   * round-robin scheduler so nobody hogs the queue. */
  playedCounts: Record<string, number>
  /** Opaque id of the device that has claimed the role of platine (single playback authority), so
   * two open platine pages don't both blast audio. null until someone claims it. */
  platineId: string | null
  currentStartedAt: number | null
  startedAt: number
}

export interface Group {
  id: string
  code: string
  name: string
  createdAt: number
  members: Member[]
  party: PartySession
  /** Host-controlled setting unlocking 18+ content packs and drinking games for the whole room. */
  adultModeEnabled: boolean
  /** Active "Mode Soirée" jukebox, or null when no music session is running. */
  music: MusicSession | null
}

/** A durable record of one completed mini-game, independent of the live (and overwritten-on-next-game)
 * `party.roundData` — this is what powers a "parties précédentes" history for a group. */
export interface GameHistoryEntry {
  id: number
  groupId: string
  gameId: string
  gameName: string
  endedAt: number
  roundsPlayed: number
}
