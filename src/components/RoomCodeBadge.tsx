import { QRCode } from './QRCode'
import { joinUrl } from '../lib/joinUrl'

/** Persistent corner badge shown on the TV screen during a game so a friend arriving late can
 * scan or read the code without anyone having to pause and explain how to join. */
export function RoomCodeBadge({ code }: { code: string }) {
  return (
    <div className="fixed bottom-4 right-4 z-40 glass-card rounded-2xl p-3 flex items-center gap-3">
      <QRCode value={joinUrl(code)} size={64} />
      <div className="text-left pr-1">
        <p className="text-[10px] uppercase tracking-widest text-white/40">Rejoindre</p>
        <p className="text-lg font-bold tracking-[0.15em]">{code}</p>
      </div>
    </div>
  )
}
