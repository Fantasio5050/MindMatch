import { useEffect, useState } from 'react'
import { usePartyStore } from '../store/usePartyStore'
import { useAppStore } from '../store/useAppStore'
import type { Member } from '../types'

/** L'heure, rafraîchie à intervalle (estimations de passage, fraîcheur du fil). */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** Pseudo d'un membre (ou « Quelqu'un » s'il a quitté la salle). */
export function useMemberLookup(): { byId: (id: string | null | undefined) => Member | undefined; name: (id: string | null | undefined) => string } {
  const members = usePartyStore((s) => s.group?.members)
  const byId = (id: string | null | undefined) => (id ? members?.find((m) => m.id === id) : undefined)
  return { byId, name: (id) => byId(id)?.pseudo ?? 'Quelqu’un' }
}

/** Hôte du Mode Soirée : l'hôte de la salle, ou celui qui a lancé la soirée. */
export function useIsMusicHost(): boolean {
  const myId = useAppStore((s) => s.identity?.memberId)
  const group = usePartyStore((s) => s.group)
  if (!myId || !group) return false
  return group.party.hostMemberId === myId || group.music?.hostMemberId === myId
}
