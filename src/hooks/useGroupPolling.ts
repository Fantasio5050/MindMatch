import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useGroupPolling(intervalMs = 4000) {
  const refreshGroup = useAppStore((s) => s.refreshGroup)

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refreshGroup()
    }, intervalMs)
    return () => clearInterval(id)
  }, [refreshGroup, intervalMs])
}
