import { useState } from 'react'
import { motion } from 'framer-motion'
import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { RadarChart } from '../components/RadarChart'
import { TraitGauge } from '../components/TraitGauge'
import { useAppStore } from '../store/useAppStore'
import { ARCHETYPES } from '../data/archetypes'
import { TRAITS } from '../data/traits'
import { generateDescription, sortedTraits } from '../lib/scoring'
import type { TraitKey } from '../types'

export function ProfilePage() {
  const member = useAppStore((s) => s.currentMember())
  const group = useAppStore((s) => s.currentGroup())
  const [copied, setCopied] = useState(false)

  if (!member || !member.scores) return null

  const archetype = ARCHETYPES[member.archetypeId as TraitKey]
  const description = generateDescription(member.scores, member.pseudo)
  const order = sortedTraits(member.scores)

  const copyCode = async () => {
    if (!group) return
    try {
      await navigator.clipboard.writeText(group.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable, ignore silently
    }
  }

  return (
    <PageTransition>
      <div className="px-6 pt-10 pb-6 safe-top">
        <div className="flex flex-col items-center text-center gap-2 mb-6">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.7 }}
            className="text-6xl mb-1"
          >
            {archetype.emoji}
          </motion.div>
          <p className="text-xs uppercase tracking-widest text-white/40">{member.pseudo}</p>
          <h1 className="text-3xl font-extrabold shimmer-text">{archetype.name}</h1>
          <p className="text-white/60 text-sm max-w-xs">{archetype.tagline}</p>
        </div>

        <Card className="mb-4" delay={0.05}>
          <p className="text-[15px] leading-relaxed text-white/80">{description}</p>
        </Card>

        <Card className="mb-4 flex flex-col items-center" delay={0.1}>
          <h3 className="self-start text-sm font-bold text-white/70 mb-1">Ta carte de personnalité</h3>
          <RadarChart series={[{ label: member.pseudo, color: '#c084fc', scores: member.scores }]} />
        </Card>

        <Card className="mb-4" delay={0.15}>
          <h3 className="text-sm font-bold text-white/70 mb-4">Tes scores en détail</h3>
          <div className="flex flex-col gap-4">
            {order.map((key, i) => (
              <TraitGauge key={key} trait={key} value={member.scores![key]} delay={0.05 * i} />
            ))}
          </div>
        </Card>

        {group && (
          <Card className="mb-4" delay={0.2}>
            <h3 className="text-sm font-bold text-white/70 mb-3">Invite tes amis</h3>
            <button
              onClick={copyCode}
              className="w-full flex items-center justify-between rounded-2xl bg-white/6 border border-white/10 px-4 py-3.5"
            >
              <div className="text-left">
                <p className="text-xs text-white/40">Code du groupe {group.name}</p>
                <p className="text-xl font-bold tracking-[0.3em]">{group.code}</p>
              </div>
              <span className="text-sm text-fuchsia-300 font-semibold">{copied ? 'Copié ✓' : 'Copier'}</span>
            </button>
          </Card>
        )}

        <p className="text-center text-[11px] text-white/30 mt-2">
          Basé sur {TRAITS.length} traits calculés à partir de tes réponses
        </p>
      </div>
    </PageTransition>
  )
}
