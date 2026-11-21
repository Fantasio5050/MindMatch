import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePartyStore } from '../../store/usePartyStore'
import { useSound } from '../../hooks/useSound'
import { DUCK_FACTOR, MAX_CROSSFADE_SEC } from '../../lib/jukebox'
import { Surface } from '../../components/Card'
import { Button } from '../../components/Button'
import { IconCopy, IconCheck, IconExternal, IconPause, IconPlay, IconReplay, IconScreen, IconSkip, IconSpeaker } from '../../components/icons'
import type { MusicSettings } from '../../types'
import { Switch, StatusDot } from '../ui'
import { platineUrl } from '../links'

type Draft = Partial<Pick<MusicSettings, 'volume' | 'crossfadeSec'>>

/**
 * La régie de l'hôte : lecture, passage, volume et fondu de la platine À DISTANCE (on règle
 * l'enceinte depuis le canapé), réglages de la soirée, et l'endroit d'où sort le son.
 */
export function HostTab({ code }: { code: string }) {
  const music = usePartyStore((s) => s.group?.music)
  const gameRunning = usePartyStore((s) => s.group?.party.status === 'playing')
  const platine = usePartyStore((s) => s.platine)
  const musicAction = usePartyStore((s) => s.musicAction)
  const stopMusic = usePartyStore((s) => s.stopMusic)
  const { play } = useSound()
  const [draft, setDraft] = useState<Draft>({})
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [copied, setCopied] = useState(false)
  const pending = useRef<Record<string, unknown>>({})
  const timer = useRef<number | null>(null)
  if (!music) return null
  const s = music.settings

  /** Les curseurs envoient au plus ~6 réglages par seconde : la platine suit le doigt sans inonder
   * le serveur. Le dernier réglage part toujours. */
  const push = (patch: Record<string, unknown>) => {
    Object.assign(pending.current, patch)
    if (timer.current) return
    timer.current = window.setTimeout(() => {
      timer.current = null
      const p = pending.current
      pending.current = {}
      void musicAction('settings', p)
    }, 160)
  }
  const settle = () => window.setTimeout(() => setDraft({}), 600)
  const setting = (patch: Partial<MusicSettings>) => {
    play('pop')
    void musicAction('settings', patch)
  }

  const volume = draft.volume ?? s.volume
  const crossfade = draft.crossfadeSec ?? s.crossfadeSec
  const link = platineUrl(code, music.platineKey)

  return (
    <div className="flex flex-col gap-3">
      <Surface className="!p-4">
        <p className="kicker text-2xs mb-3">Lecture</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={!music.current}
            onClick={() => {
              play('pop')
              void musicAction('setPlayback', { isPlaying: !music.isPlaying })
            }}
            className="flex items-center justify-center gap-2 !px-3"
          >
            {music.isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
            {music.isPlaying ? 'Pause' : 'Lecture'}
          </Button>
          <Button
            variant="secondary"
            disabled={!music.current}
            onClick={() => {
              play('pop')
              void musicAction('hostSkip')
            }}
            className="flex items-center justify-center gap-2 !px-3"
          >
            <IconSkip size={18} />
            Suivant
          </Button>
        </div>
      </Surface>

      <Surface className="!p-4">
        <p className="kicker text-2xs mb-3">Platine, à distance</p>
        <Slider
          label="Volume"
          value={volume}
          min={0}
          max={100}
          format={(v) => `${v} %`}
          onInput={(v) => {
            setDraft((d) => ({ ...d, volume: v }))
            push({ volume: v })
          }}
          onRelease={settle}
        />
        {s.duck && gameRunning && (
          <p className="text-2xs text-chalk-faint mt-1">Partie en cours : la platine joue à {Math.round(volume * DUCK_FACTOR)} %.</p>
        )}
        <div className="h-4" />
        <Slider
          label="Fondu enchaîné"
          value={crossfade}
          min={0}
          max={MAX_CROSSFADE_SEC}
          format={(v) => (v === 0 ? 'Coupure nette' : `${v} s`)}
          onInput={(v) => {
            setDraft((d) => ({ ...d, crossfadeSec: v }))
            push({ crossfadeSec: v })
          }}
          onRelease={settle}
        />
        {music.source === 'spotify' && (
          <p className="text-2xs text-chalk-faint mt-1">Spotify ne lit qu’un morceau à la fois : le son descend puis remonte, sans chevauchement.</p>
        )}
      </Surface>

      <Surface className="!p-4">
        <p className="kicker text-2xs mb-1">Soirée</p>
        <Switch
          icon={<IconReplay size={17} />}
          label="Mode continu"
          hint="File vide : on repioche parmi les morceaux les plus applaudis de la soirée."
          checked={s.continuous}
          onChange={(v) => setting({ continuous: v })}
        />
        <Switch
          icon={<IconSpeaker size={17} />}
          label="Baisser pendant les jeux"
          hint={`La musique descend à ${Math.round(DUCK_FACTOR * 100)} % pendant une partie, pour qu’on s’entende.`}
          checked={s.duck}
          onChange={(v) => setting({ duck: v })}
        />
        {music.source === 'youtube' && (
          <Switch
            icon={<IconScreen size={17} />}
            label="Jouer le son sur la TV"
            hint="L’écran partagé devient la platine. Il faudra toucher « Démarrer le son » sur la TV."
            checked={s.output === 'tv'}
            onChange={(v) => setting({ output: v ? 'tv' : 'device' })}
          />
        )}
      </Surface>

      <Surface className="!p-4">
        <p className="kicker text-2xs mb-2">Où sort le son</p>
        <p className="flex items-center gap-2 text-sm text-chalk mb-3">
          <StatusDot tone={platine?.online ? 'live' : 'off'} />
          {platine?.online
            ? platine.kind === 'tv'
              ? 'La TV joue le son'
              : 'Platine en ligne'
            : s.output === 'tv'
              ? 'La TV attend « Démarrer le son »'
              : 'Aucune platine en ligne'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="!min-h-[44px] text-sm !px-3 flex items-center justify-center gap-1.5"
            onClick={() => window.open(link, '_blank')}
          >
            <IconExternal size={16} />
            Platine ici
          </Button>
          <Button
            variant="secondary"
            className="!min-h-[44px] text-sm !px-3 flex items-center justify-center gap-1.5"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              } catch {
                /* presse-papiers indisponible */
              }
            }}
          >
            {copied ? <IconCheck size={16} className="text-jade" /> : <IconCopy size={16} />}
            {copied ? 'Copié' : 'Copier le lien'}
          </Button>
        </div>
        <p className="text-2xs text-chalk-faint mt-2 leading-relaxed">
          Ce lien contient ta clé : ouvert sur un autre appareil, il prend la main même si une platine joue déjà.
        </p>
      </Surface>

      <AnimatePresence mode="wait" initial={false}>
        {confirmEnd ? (
          <motion.div key="confirm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Surface className="!p-4 border-blood/50">
              <p className="text-sm text-chalk mb-1">Terminer la soirée ?</p>
              <p className="text-xs text-chalk-soft mb-3">La platine s’arrête et tout le monde voit le récap.</p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    play('pop')
                    void stopMusic()
                  }}
                >
                  Terminer
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmEnd(false)}>
                  Annuler
                </Button>
              </div>
            </Surface>
          </motion.div>
        ) : (
          <motion.div key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button variant="ghost" fullWidth className="!text-blood" onClick={() => setConfirmEnd(true)}>
              Terminer la soirée
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  format,
  onInput,
  onRelease,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  format: (v: number) => string
  onInput: (v: number) => void
  onRelease: () => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="text-chalk">{label}</span>
        <span className="tabular-nums text-chalk-muted">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onInput(Number(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        onTouchEnd={onRelease}
        className="w-full accent-spark mt-2 h-6"
      />
    </label>
  )
}
