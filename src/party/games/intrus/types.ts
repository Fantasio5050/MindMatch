export type IntrusRole = 'civil' | 'undercover' | 'mrwhite'
export type IntrusOutcome = 'civils' | 'infiltres' | 'mrwhite'

export interface IntrusTruth {
  roleByMember: Record<string, IntrusRole>
  civilWord: string
  undercoverWord: string
}

export interface IntrusElimination {
  memberId: string
  role: IntrusRole
  round: number
}

/** État tel que reçu par le client, après passage dans `sanitizeParty` :
 *  - `votes` est remplacé par `votedCount` + `yourVote`,
 *  - `secrets` est supprimé et remplacé par les dérivés `yourWord` / `yourTruth`.
 * `yourWord` absent = tu n'es pas participant (ou tu es la TV) ; `yourWord === null` = Mr. White. */
export interface IntrusClientState {
  pack: 'classic' | 'trash' | 'mixed'
  turnSeconds: number
  mrWhiteEnabled: boolean
  undercoverCount: number
  mrWhiteCount: number
  order: string[]
  speakers: string[]
  speakerIndex: number
  turnStartedAt: number | null
  alive: string[]
  eliminated: IntrusElimination[]
  ready: string[]
  tiedIds: string[] | null
  inDuel: boolean
  lastElimination: IntrusElimination | null
  mrWhiteGuess: { memberId: string; guess: string; correct: boolean } | null
  outcome: IntrusOutcome | null
  revealedTruth: IntrusTruth | null
  votedCount: number
  votedMemberIds: string[]
  yourVote: string | null
  yourWord?: string | null
  yourTruth?: IntrusTruth
}

export const ROLE_LABEL: Record<IntrusRole, string> = {
  civil: 'Civil',
  undercover: 'Undercover',
  mrwhite: 'Mr. White',
}

export const ROLE_EMOJI: Record<IntrusRole, string> = {
  civil: '😇',
  undercover: '🕵️',
  mrwhite: '🃏',
}

export const ROLE_COLOR: Record<IntrusRole, string> = {
  civil: 'text-emerald-300',
  undercover: 'text-pink-300',
  mrwhite: 'text-amber-300',
}

export const OUTCOME_TEXT: Record<IntrusOutcome, { title: string; emoji: string; sub: string }> = {
  civils: { title: 'Les civils gagnent !', emoji: '😇', sub: 'Tous les intrus ont été démasqués.' },
  infiltres: { title: 'Les intrus gagnent !', emoji: '🕵️', sub: 'Ils sont passés inaperçus jusqu’au bout.' },
  mrwhite: { title: 'Mr. White vole la partie !', emoji: '🃏', sub: 'Démasqué, il a quand même trouvé le mot.' },
}
