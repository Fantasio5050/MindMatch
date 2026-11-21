import type { MusicFeedEvent } from '../types'

/** Au-delà, une ligne du fil n'est plus « en direct » : on revient à la ligne d'ambiance. */
export const FEED_FRESH_MS = 90_000

function quote(title: string | undefined): string {
  if (!title) return 'le morceau'
  const t = Array.from(title)
  return `« ${t.length > 42 ? `${t.slice(0, 40).join('').trim()}…` : title} »`
}

/**
 * Le fil d'activité en mots. Le serveur ne transmet que des faits (qui, quoi, combien) ; la phrase
 * se compose ici, à la troisième personne — comme le fil du Monopoly, on y garde le vrai pseudo.
 */
export function feedText(e: MusicFeedEvent, name: (id: string | null | undefined) => string): string {
  const t = quote(e.title)
  switch (e.kind) {
    case 'add':
      return `${name(e.memberId)} a ajouté ${t}${e.detail ? ', avec une dédicace' : ''}`
    case 'replay':
      return `${name(e.memberId)} relance ${t}`
    case 'skipVote':
      return `${e.count ?? 1} vote${(e.count ?? 1) > 1 ? 's' : ''} sur ${e.needed ?? 2} pour passer ${t}`
    case 'skip':
      return `La salle a passé ${t}`
    case 'hostSkip':
      return e.memberId ? `${name(e.memberId)} a passé ${t}` : `La platine a passé ${t}`
    case 'playNext':
      return `${name(e.memberId)} fait passer ${t} juste après`
    case 'remove':
      return `${name(e.memberId)} a retiré ${t}`
    case 'auto':
      return `Mode continu : ${t} repart`
    case 'unplayable':
      return `${t} est illisible, on passe au suivant`
    case 'platineOn':
      return e.detail === 'tv' ? 'La TV joue le son' : 'La platine est en ligne'
    case 'platineOff':
      return 'La platine s’est déconnectée'
    case 'output':
      return e.detail === 'tv' ? 'Le son passe sur la TV' : 'Le son revient sur la platine'
  }
}
