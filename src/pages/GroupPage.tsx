import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Avatar } from '../components/Avatar'
import { RadarChart } from '../components/RadarChart'
import { useAppStore } from '../store/useAppStore'
import { finishedMembers, topSimilarities, topDifferences, computeRankings, traitLabel } from '../lib/groupAnalysis'
import { TRAIT_MAP } from '../data/traits'
import { ARCHETYPES } from '../data/archetypes'
import type { TraitKey } from '../types'

const MEMBER_CHART_COLORS = ['#c084fc', '#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#38bdf8', '#f87171']

export function GroupPage() {
  const group = useAppStore((s) => s.currentGroup())
  if (!group) return null

  const finished = finishedMembers(group.members)
  const pending = group.members.filter((m) => !m.scores)

  return (
    <PageTransition>
      <div className="px-6 pt-10 pb-6 safe-top">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-white/40">Groupe</p>
          <h1 className="text-3xl font-extrabold shimmer-text mb-1">{group.name}</h1>
          <p className="text-white/50 text-sm">
            {finished.length} / {group.members.length} ont terminé le quiz
          </p>
        </div>

        {finished.length < 2 ? (
          <Card className="text-center">
            <p className="text-4xl mb-3">⏳</p>
            <h3 className="font-bold text-lg mb-2">En attente de tes amis</h3>
            <p className="text-white/60 text-sm mb-4">
              Partage le code ci-dessous pour qu'ils rejoignent le groupe et répondent au questionnaire.
            </p>
            <p className="text-2xl font-bold tracking-[0.3em] bg-white/6 border border-white/10 rounded-2xl py-3">
              {group.code}
            </p>
            {pending.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {pending.map((m) => (
                  <span key={m.id} className="text-xs px-3 py-1.5 rounded-full bg-white/6 text-white/50">
                    {m.pseudo} en attente…
                  </span>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <GroupInsights members={finished} />
        )}
      </div>
    </PageTransition>
  )
}

function GroupInsights({ members }: { members: ReturnType<typeof finishedMembers> }) {
  const similarities = topSimilarities(members, 2)
  const differences = topDifferences(members, 2)
  const rankings = computeRankings(members)

  return (
    <div className="flex flex-col gap-4">
      <Card delay={0.05}>
        <h3 className="text-sm font-bold text-white/70 mb-3">Toutes les personnalités</h3>
        <RadarChart
          size={260}
          series={members.map((m, i) => ({
            label: m.pseudo,
            color: MEMBER_CHART_COLORS[i % MEMBER_CHART_COLORS.length],
            scores: m.scores!,
          }))}
        />
      </Card>

      <Card delay={0.1}>
        <h3 className="text-sm font-bold text-white/70 mb-3">🤝 Vos points communs</h3>
        <div className="flex flex-col gap-3">
          {similarities.map((s) => (
            <div key={s.trait} className="flex items-center gap-3 rounded-2xl bg-white/6 border border-white/10 px-4 py-3">
              <span className="text-xl">{TRAIT_MAP[s.trait].emoji}</span>
              <div>
                <p className="text-sm font-semibold">{traitLabel(s.trait)}</p>
                <p className="text-xs text-white/50">Vous êtes tous alignés, autour de {Math.round(s.avg)}/100</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {differences.length > 0 && (
        <Card delay={0.15}>
          <h3 className="text-sm font-bold text-white/70 mb-3">⚡ Vos plus grandes différences</h3>
          <div className="flex flex-col gap-3">
            {differences.map((d) => (
              <div key={d.trait} className="rounded-2xl bg-white/6 border border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{TRAIT_MAP[d.trait].emoji}</span>
                  <p className="text-sm font-semibold">{traitLabel(d.trait)}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="flex items-center gap-1.5">
                    <Avatar pseudo={d.max.member.pseudo} color={d.max.member.color} size={22} />
                    {d.max.member.pseudo} · {Math.round(d.max.value)}
                  </span>
                  <span className="text-white/30">vs</span>
                  <span className="flex items-center gap-1.5">
                    <Avatar pseudo={d.min.member.pseudo} color={d.min.member.color} size={22} />
                    {d.min.member.pseudo} · {Math.round(d.min.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card delay={0.2}>
        <h3 className="text-sm font-bold text-white/70 mb-3">🏆 Classements amusants</h3>
        <div className="flex flex-col gap-2">
          {rankings.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/6 border border-white/10 px-3 py-2.5">
              <span className="text-lg w-6 text-center">{r.emoji}</span>
              <Avatar pseudo={r.member.pseudo} color={r.member.color} size={32} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{r.member.pseudo}</p>
                <p className="text-[11px] text-white/50">{r.title}</p>
              </div>
              <span className="text-sm font-bold text-white/80">{r.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card delay={0.25}>
        <h3 className="text-sm font-bold text-white/70 mb-3">Membres</h3>
        <div className="flex flex-col gap-2">
          {members.map((m) => {
            const archetype = ARCHETYPES[m.archetypeId as TraitKey]
            return (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar pseudo={m.pseudo} color={m.color} size={38} />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{m.pseudo}</p>
                  <p className="text-xs text-white/50">
                    {archetype.emoji} {archetype.name}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
