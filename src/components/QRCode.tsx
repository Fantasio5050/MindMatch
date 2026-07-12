import { useEffect, useState } from 'react'
import QRCodeLib from 'qrcode'

/** Renders a scannable QR code client-side (no third-party API call — the room code never leaves
 * the device just to render an image). */
export function QRCode({ value, size = 160 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCodeLib.toDataURL(value, { width: size, margin: 1, color: { dark: '#1a1030ff', light: '#ffffffff' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="rounded-xl bg-white/10 animate-pulse" />
  }
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="QR code pour rejoindre la salle"
      className="rounded-xl bg-white p-1.5"
    />
  )
}
