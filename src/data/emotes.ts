/** The emoji reactions players can fire during a game — shared between client (picker UI) and
 * server (payload validation) so the two can never drift apart. */
export const EMOTES = ['😂', '🔥', '😱', '👏', '🍻', '❤️', '💀', '🤡'] as const

export type Emote = (typeof EMOTES)[number]

export interface EmoteEvent {
  id: string
  memberId: string
  emoji: Emote
}
