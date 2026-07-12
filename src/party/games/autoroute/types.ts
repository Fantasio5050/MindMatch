export type AutorouteQuestionKind = 'higher-lower' | 'red-black' | 'inter-exter'
export type AutorouteChoice = 'higher' | 'lower' | 'red' | 'black' | 'inter' | 'exter'

export interface AutorouteCard {
  id: string
  rank: number
  suit: number
}

export type AutorouteTrackCell = { type: 'question'; kind: AutorouteQuestionKind } | { type: 'toll' }

export interface AutoroutePlayerRoundResult {
  choice: AutorouteChoice
  kind: AutorouteQuestionKind
  drawnCard: AutorouteCard
  correct: boolean
  faultSips: number
  tollSips: number
  newPosition: number
  finished: boolean
}

export interface AutorouteHistoryEntry {
  results: Record<string, AutoroutePlayerRoundResult>
}

export interface AutorouteClientState {
  track: AutorouteTrackCell[]
  positions: Record<string, number>
  finished: Record<string, boolean>
  finishOrder: string[]
  recentCards: Record<string, AutorouteCard[]>
  totalSipsReceived: Record<string, number>
  history: AutorouteHistoryEntry[]
  votedCount: number
  yourVote: AutorouteChoice | null
}

export const QUESTION_META: Record<AutorouteQuestionKind, { title: string; options: [AutorouteChoice, AutorouteChoice] }> = {
  'higher-lower': { title: 'Plus haut ou plus bas ?', options: ['higher', 'lower'] },
  'red-black': { title: 'Rouge ou noir ?', options: ['red', 'black'] },
  'inter-exter': { title: 'Inter ou Exter ?', options: ['inter', 'exter'] },
}

export const CHOICE_META: Record<AutorouteChoice, { label: string; emoji: string }> = {
  higher: { label: 'Plus haut', emoji: '⬆️' },
  lower: { label: 'Plus bas', emoji: '⬇️' },
  red: { label: 'Rouge', emoji: '🟥' },
  black: { label: 'Noir', emoji: '⬛' },
  inter: { label: 'Inter', emoji: '↔️' },
  exter: { label: 'Exter', emoji: '↕️' },
}

export function choiceLabel(choice: AutorouteChoice): string {
  const meta = CHOICE_META[choice]
  return `${meta.emoji} ${meta.label}`
}
