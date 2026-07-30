import { QRCode } from './QRCode'
import { joinUrl } from '../lib/joinUrl'

/**
 * Le coin « on peut encore vous rejoindre », posé en permanence sur la TV pendant une partie.
 *
 * Il existe pour une raison sociale, pas fonctionnelle : sans lui, un ami qui arrive à 23 h oblige
 * quelqu'un à interrompre la partie pour lui expliquer comment entrer. Avec lui, il scanne et
 * s'assied. Il doit donc rester lisible à 4 m — et discret, parce que la scène passe avant.
 */
export function RoomCodeBadge({ code }: { code: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-card border border-line bg-felt/90 p-3 backdrop-blur-sm">
      <QRCode value={joinUrl(code)} size={64} />
      <div className="text-left pr-1">
        <p className="kicker text-2xs">Rejoindre</p>
        <p className="font-stage text-tv-sm text-brass tracking-[0.16em]">{code}</p>
      </div>
    </div>
  )
}
