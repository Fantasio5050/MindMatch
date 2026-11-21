import { useEffect, useState } from 'react'
import { usePartyStore } from '../store/usePartyStore'
import { useAppStore } from '../store/useAppStore'
import { anchorPosition } from '../lib/jukebox'
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

/** Position et durée du morceau en cours, extrapolées de l'ancre partagée et rafraîchies à
 * intervalle (annonce du suivant, compte à rebours). Pour une barre fluide, voir `MusicProgress`. */
export function useTrackClock(intervalMs = 500): { positionMs: number; durationMs: number | null; remainingMs: number | null } {
  useNow(intervalMs)
  const st = usePartyStore.getState()
  const music = st.group?.music
  const durationMs = music?.current?.durationMs ?? null
  const positionMs = music?.current ? anchorPosition(music.anchor, st.serverNow(), durationMs) : 0
  return { positionMs, durationMs, remainingMs: durationMs ? Math.max(0, durationMs - positionMs) : null }
}
