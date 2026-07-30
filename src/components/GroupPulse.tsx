import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { usePartyStore } from '../store/usePartyStore'
import { useAppStore } from '../store/useAppStore'
import { Player } from './Player'
import type { Member } from '../types'

/**
 * GroupPulse — la primitive sociale du téléphone.
 *
 * Principe fondateur du produit : **jamais seul dans son téléphone**. Un temps d'attente n'est
 * pas un état vide, c'est un moment de jeu. Ce composant remplace tous les « En attente des
 * autres… » par la vie réelle du groupe.
 *
 * ## Une seule information dominante à la fois
 * Ce n'est PAS un chat et il n'y a PAS de flux qui défile. Une file de priorité stricte décide de
 * l'unique ligne affichée, et elle est remplacée en douceur :
 *
 *   1. une réaction humaine qui vient de tomber (emote)        — la plus vivante
 *   2. « X vient d'agir », détecté par différence d'instantanés — l'événement
 *   3. la progression du groupe                                — l'état de fond
 *
 * ## Ton
 * `mode="rapid"` peut nommer le dernier joueur (« On attend Marie 👀 ») : sur un jeu court c'est
 * de la complicité. `mode="creative"` reste **collectif** (« 5 créations reçues ») : quand
 * quelqu'un dessine ou écrit, réfléchir est légitime — le système accompagne, il ne désigne pas
 * de retardataire.
 */
const EVENT_MS = 2600

export interface GroupPulseProps {
  /** Qui a déjà agi (vient de `votedMemberIds` / `submittedMemberIds` / une liste du jeu). */
  actedIds: string[]
  /** Qui est attendu. Par défaut : les participants de la manche. */
  expectedIds?: string[]
  /** Nom de l'action au pluriel : « votes », « créations reçues », « prêts »… */
  noun?: string
  /** `rapid` autorise à nommer le dernier ; `creative` reste collectif. */
  mode?: 'rapid' | 'creative'
  /** Verbe de l'événement individuel : « a voté », « a choisi », « a rendu son dessin ». */
  verb?: string
  className?: string
}

export function GroupPulse({
  actedIds,
  expectedIds,
  noun = 'prêts',
  mode = 'rapid',
  verb = 'a joué',
  className,
}: GroupPulseProps) {
  const group = usePartyStore((s) => s.group)
  const emotes = usePartyStore((s) => s.emotes)
  const onlineIds = usePartyStore((s) => s.onlinePlayerIds)
  const myId = useAppStore((s) => s.identity?.memberId) ?? null

  const expected = useMemo(
    () => expectedIds ?? group?.party.participantIds ?? group?.members.map((m) => m.id) ?? [],
    [expectedIds, group],
  )
  const members = useMemo(
    () => (group?.members ?? []).filter((m) => expected.includes(m.id)),
    [group, expected],
  )
  const acted = useMemo(() => actedIds.filter((id) => expected.includes(id)), [actedIds, expected])
  const missing = useMemo(() => members.filter((m) => !acted.includes(m.id)), [members, acted])

  // ---- Détection de l'événement « X vient d'agir » -----------------------
  // Par comparaison avec l'instantané précédent : aucun horodatage serveur nécessaire.
  const previous = useRef<string[]>(actedIds)
  const [event, setEvent] = useState<{ member: Member; at: number } | null>(null)

  useEffect(() => {
    const fresh = acted.filter((id) => !previous.current.includes(id))
    previous.current = acted
    // On n'annonce pas sa propre action : le joueur vient de la faire, il le sait.
    const other = fresh.find((id) => id !== myId)
    if (!other) return
    const member = members.find((m) => m.id === other)
    if (member) setEvent({ member, at: Date.now() })
  }, [acted, members, myId])

  const [, force] = useState(0)
  useEffect(() => {
    if (!event) return
    const t = setTimeout(() => force((n) => n + 1), EVENT_MS)
    return () => clearTimeout(t)
  }, [event])

  const lastEmote = emotes.length > 0 ? emotes[emotes.length - 1] : null
  const emoteMember = lastEmote ? members.find((m) => m.id === lastEmote.memberId) : undefined
  const eventFresh = !!event && Date.now() - event.at < EVENT_MS

  // ---- Sélection de L'UNIQUE ligne affichée ------------------------------
  let key = 'progress'
  let line: React.ReactNode = null

  if (lastEmote && emoteMember) {
    key = `emote-${lastEmote.id}`
    line = (
      <>
        <span className="text-lg leading-none">{lastEmote.emoji}</span>
        <span className="text-chalk-muted">
          <b className="text-chalk">{emoteMember.pseudo}</b> réagit
        </span>
      </>
    )
  } else if (eventFresh && event) {
    key = `event-${event.member.id}-${event.at}`
    line = (
      <span className="text-chalk-muted">
        <b className="text-chalk">{event.member.pseudo}</b> {verb}
      </span>
    )
  } else if (missing.length === 0 && members.length > 0) {
    key = 'all-done'
    line = <span className="text-jade font-semibold">Tout le monde a joué</span>
  } else if (mode === 'rapid' && missing.length === 1) {
    // Complicité, jamais reproche — et uniquement sur les jeux courts.
    key = `waiting-${missing[0].id}`
    line = (
      <span className="text-chalk-muted">
        On attend <b className="text-chalk">{missing[0].pseudo}</b> 👀
      </span>
    )
  } else {
    key = 'progress'
    line = (
      <span className="text-chalk-muted">
        <b className="text-chalk tabular-nums">
          {acted.length}/{members.length}
        </b>{' '}
        {noun}
      </span>
    )
  }

  if (members.length === 0) return null

  return (
    <div className={clsx('flex flex-col gap-2.5', className)}>
      {/* Les visages : c'est eux qui portent la présence, la ligne de texte ne fait que commenter. */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {members.map((m) => (
          <Player
            key={m.id}
            member={m}
            size="chip"
            showName={false}
            acted={acted.includes(m.id)}
            offline={onlineIds.length > 0 && !onlineIds.includes(m.id)}
          />
        ))}
      </div>

      {/* Une ligne, une seule, remplacée en fondu — surtout pas un flux qui défile. */}
      <div className="h-6 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-1.5 text-sm"
          >
            {line}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
