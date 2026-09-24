import { useEffect, useRef, useState } from 'react'

/**
 * Décompte local à partir du temps restant envoyé par le serveur.
 *
 * Le serveur n'envoie qu'un instantané (« il reste 11 400 ms ») : sans décompte local, le chrono
 * restait figé entre deux mises à jour. `turnKey` identifie le tour — il repart de zéro à chaque
 * nouveau tour, et se recale sur chaque nouvel instantané du serveur.
 *
 * `onExpire` est appelé une seule fois par tour, au passage à zéro.
 */
export function useCountdown(timeLeft: number, turnKey: number, active: boolean, onExpire?: () => void): number {
  const [left, setLeft] = useState(timeLeft)
  const expireRef = useRef(onExpire)
  const firedFor = useRef<number | null>(null)

  useEffect(() => {
    expireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (!active) return
    const endsAt = Date.now() + timeLeft
    const tick = () => {
      const remaining = Math.max(0, endsAt - Date.now())
      setLeft(remaining)
      if (remaining === 0 && firedFor.current !== turnKey) {
        firedFor.current = turnKey
        expireRef.current?.()
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [timeLeft, turnKey, active])

  return active ? left : 0
}
