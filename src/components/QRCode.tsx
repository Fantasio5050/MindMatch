import { useEffect, useState } from 'react'
import QRCodeLib from 'qrcode'

/** Résolution de génération, indépendante de la taille d'affichage.
 *
 * Avant, l'image était générée à la taille exacte d'affichage : sur une TV 4K le QR de 200 px
 * était interpolé (donc mou, donc plus dur à scanner), et changer la taille d'affichage relançait
 * un encodage. On encode une bonne fois en 512 px et on laisse le CSS le mettre à l'échelle. */
const RENDER_PX = 512

/** Renders a scannable QR code client-side (no third-party API call — the room code never leaves
 * the device just to render an image). */
export function QRCode({ value, size = 160 }: { value: string; size?: number | string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  // La taille d'affichage peut être une longueur CSS : la scène TV passe une valeur fluide pour
  // que le QR rétrécisse avec l'écran au lieu de recouvrir le code de la salle.
  const css = typeof size === 'number' ? `${size}px` : size

  useEffect(() => {
    let cancelled = false
    QRCodeLib.toDataURL(value, { width: RENDER_PX, margin: 1, color: { dark: '#0c0b10ff', light: '#f2efe9ff' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [value])

  if (!dataUrl) {
    return <div style={{ width: css, height: css }} className="shrink-0 rounded-control bg-line animate-pulse" />
  }
  return (
    <img
      src={dataUrl}
      style={{ width: css, height: css }}
      alt="QR code pour rejoindre la salle"
      className="shrink-0 rounded-control bg-chalk p-1.5"
    />
  )
}
