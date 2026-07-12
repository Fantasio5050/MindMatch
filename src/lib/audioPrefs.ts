type Listener = () => void

interface PersistedValue<T> {
  get(): T
  set(next: T): void
  subscribe(listener: Listener): () => void
}

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key)
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, value)
}

/** Small persisted pub-sub value so every component sharing a key (e.g. two mute toggles on
 * different pages) reacts immediately via useSyncExternalStore, instead of only the instance
 * that changed it. */
function makePersistedBoolean(key: string, defaultValue: boolean): PersistedValue<boolean> {
  let value = readStorage(key) === null ? defaultValue : readStorage(key) === '1'
  const listeners = new Set<Listener>()
  return {
    get: () => value,
    set: (next) => {
      value = next
      writeStorage(key, next ? '1' : '0')
      listeners.forEach((l) => l())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function makePersistedNumber(key: string, defaultValue: number): PersistedValue<number> {
  const stored = readStorage(key)
  let value = stored === null ? defaultValue : Number(stored)
  if (Number.isNaN(value)) value = defaultValue
  const listeners = new Set<Listener>()
  return {
    get: () => value,
    set: (next) => {
      value = next
      writeStorage(key, String(next))
      listeners.forEach((l) => l())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const sfxMutedStore = makePersistedBoolean('mindmatch-sound-muted', false)
export const musicMutedStore = makePersistedBoolean('mindmatch-music-muted', false)
export const musicVolumeStore = makePersistedNumber('mindmatch-music-volume', 0.45)
