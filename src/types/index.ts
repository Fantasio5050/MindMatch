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
  /** Petit mot joint à l'ajout (« pour Chloé, qui adore »), nettoyé et court. Les champs suivants
   * sont facultatifs : les sessions enregistrées avant leur arrivée ne les ont pas. */
  dedication?: string | null
  /** Réactions reçues PENDANT son passage : emoji → nombre. */
  reactions?: Record<string, number>
  /** Combien de réactions chaque membre a déjà comptées sur ce passage (plafond anti-matraquage). */
  reactedBy?: Record<string, number>
  /** « Jouer ensuite » de l'hôte : horodatage de l'épinglage. Le dernier épinglé passe en premier. */
  pinnedAt?: number | null
  /** Repioché par le mode continu : ne compte pas dans le tour de son auteur d'origine. */
  auto?: boolean
  /** Début de son passage (horloge serveur). */
  playedAt?: number | null
}

/**
 * Position de lecture ancrée : « à `at` (horloge serveur), on était à `positionMs` ». Chaque
 * appareil en déduit la position courante tout seul — la barre de progression avance sans que la
 * platine diffuse sa position deux fois par seconde. Réancrée à chaque lecture, pause, saut, seek ou
 * changement de morceau, plus un battement léger de la platine.
 */
export interface MusicAnchor {
  positionMs: number
  at: number
  /** Lecture effective sur la platine (≠ `isPlaying`, l'intention de la salle : un morceau qui charge
   * est voulu « en lecture » mais n'avance pas encore). */
  playing: boolean
}

/** Où sort le son : l'appareil-platine dédié, ou la TV de l'écran partagé. */
export type MusicOutput = 'device' | 'tv'

/** Réglages de la platine, pilotables à distance par l'hôte (et par la platine elle-même). */
export interface MusicSettings {
  /** Volume maître de la platine, 0-100. */
  volume: number
  /** Durée du fondu enchaîné en secondes (0 = coupure nette). */
  crossfadeSec: number
  /** Baisser le volume pendant une partie, pour qu'on s'entende jouer. */
  duck: boolean
  /** File vide → la platine repioche parmi les morceaux les plus applaudis de la soirée. */
  continuous: boolean
  output: MusicOutput
}

export type MusicFeedKind =
  | 'add'
  | 'replay'
  | 'skipVote'
  | 'skip'
  | 'hostSkip'
  | 'playNext'
  | 'remove'
  | 'auto'
  | 'unplayable'
  | 'platineOn'
  | 'platineOff'
  | 'output'

/** Une ligne du fil d'activité (« Bruno a ajouté… », « 2 votes pour passer »). Le texte est composé
 * côté client : le serveur ne transmet que les faits. */
export interface MusicFeedEvent {
  id: string
  at: number
  kind: MusicFeedKind
  memberId?: string | null
  title?: string
  count?: number
  needed?: number
  /** Pour `output` : la nouvelle sortie. Pour `add` : la dédicace jointe. */
  detail?: string
}

/** Un morceau déjà passé, gardé côté serveur pour le mode continu et le récap. Jamais diffusé. */
export interface MusicPoolEntry {
  sourceId: string
  title: string
  artist: string
  thumbnail: string | null
  durationMs: number | null
  addedById: string
  reactions: number
  plays: number
  firstPlayedAt: number
  /** Numéro du dernier passage (compteur de la session), pour écarter ce qui vient de passer. */
  lastPlay: number
}

export interface MusicRecapTrack {
  sourceId: string
  title: string
  artist: string
  thumbnail: string | null
  addedById: string
  reactions: number
  plays: number
}

/** Le bilan affiché à la fin de la soirée. */
export interface MusicRecap {
  source: MusicSource
  startedAt: number
  endedAt: number
  tracksPlayed: number
  totalReactions: number
  /** Les plus applaudis d'abord (5 au plus). */
  topTracks: MusicRecapTrack[]
  /** Meilleurs DJ : réactions reçues, puis morceaux passés. */
  djs: { memberId: string; plays: number; reactions: number }[]
  /** Tout ce qui est passé, dans l'ordre (50 au plus — la limite d'une playlist YouTube sans compte). */
  playlist: { sourceId: string; title: string; artist: string }[]
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
  /** Identifiant de l'appareil qui tient (ou tenait en dernier) le rôle de platine. Le lien vivant
   * avec sa connexion n'est pas ici : il vit en mémoire côté serveur (voir server/music.ts). */
  platineId: string | null
  currentStartedAt: number | null
  startedAt: number
  // --- Champs ajoutés avec la refonte : `normalizeMusicSession` les complète à la lecture. ---
  /** Secret du lien de la platine : permet de reprendre la main sur une platine déjà en ligne.
   * Transmis à l'hôte seulement. */
  platineKey?: string
  anchor: MusicAnchor | null
  settings: MusicSettings
  /** Fil d'activité, du plus ancien au plus récent (court). */
  feed: MusicFeedEvent[]
  /** Ce que le mode continu jouerait si la file restait vide — calculé par le serveur, avec un id
   * stable, pour que la platine puisse l'annoncer et le lancer en fondu. */
  autoNext: MusicTrack | null
  /** Compteur des passages (sert à dater les morceaux du réservoir). */
  playCount: number
  /** memberId → réactions reçues par les morceaux qu'il a ajoutés (les meilleurs DJ du récap). */
  djReactions: Record<string, number>
  /** Réservoir du mode continu et du récap — serveur seulement, retiré des diffusions. */
  pool?: MusicPoolEntry[]
  /** Fin de soirée : la session reste affichée (récap) jusqu'à ce que l'hôte la referme. */
  endedAt: number | null
  recap: MusicRecap | null
}

/** État vivant de la platine, calculé par le serveur à chaque diffusion (pas persisté). L'identifiant
 * de l'appareil n'y figure pas : le connaître permettrait de se faire passer pour lui. */
export interface PlatineStatus {
  online: boolean
  kind: MusicOutput | null
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
