/** État client de Coup de Crayon — miroir de l'état serveur après sanitization : les dessins en
 * cours restent cachés (`submissions` -> submittedCount/yourSubmission), la galerie de vote est
 * anonyme, `yourEntryIndex` désigne ton propre dessin (inéligible), et le double vote passe par
 * la convention `votes` -> votedCount/yourVote. */

export interface CdcEntry {
  image: string
  authorId: string
}

export interface CdcRoundResult {
  word: string
  entries: CdcEntry[]
  bestVotes: number[]
  funnyVotes: number[]
  bestWinners: number[]
  funnyWinners: number[]
}

export interface CoupDeCrayonClientState {
  order: string[]
  currentWord: string | null
  drawingStartedAt: number | null
  drawSeconds: number
  submittedCount: number
  /** QUI a rendu son dessin (jamais lequel) — alimente GroupPulse en ton collectif. */
  submittedMemberIds: string[]
  yourSubmission: string | null
  gallery: { image: string }[]
  votingStartedAt: number | null
  votedCount: number
  yourVote: { best: number; funny: number } | null
  yourEntryIndex?: number | null
  results: CdcRoundResult | null
  artScore: Record<string, number>
  funScore: Record<string, number>
  totalRounds: number
  roundsPlayed: number
}

/** Durée d'affichage de chaque dessin pendant le diaporama TV (ms). */
export const CDC_SLIDESHOW_MS = 4000
