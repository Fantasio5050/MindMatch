let ctx: AudioContext | null = null

/** Single shared AudioContext for both sound effects and background music — creating more than
 * one per page is wasteful and some browsers cap how many can run concurrently. */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

/** Browsers suspend new AudioContexts until a user gesture — call this from a click/touch handler. */
export function resumeAudioContext(): void {
  const c = getAudioContext()
  if (c && c.state === 'suspended') void c.resume()
}
