import { PageTransition } from '../components/PageTransition'
import { Card } from '../components/Card'
import { Avatar } from '../components/Avatar'
import { useAppStore } from '../store/useAppStore'
import { useGroupPolling } from '../hooks/useGroupPolling'
import { finishedMembers } from '../lib/groupAnalysis'
import { generateDebates } from '../lib/debates'

export function DebatesPage() {
  const group = useAppStore((s) => s.currentGroup())
  useGroupPolling()
  if (!group) return null

  const finished = finishedMembers(group.members)

  if (finished.length < 2) {
    return (
      <PageTransition>
        <div className="px-6 pt-10 pb-6 safe-top text-center">
          <p className="text-xs uppercase tracking-widest text-chalk-faint">Débats</p>
          <h1 className="text-3xl font-extrabold shimmer-text mb-4">Bientôt disponible</h1>
          <Card>
            <p className="text-4xl mb-3">💬</p>
            <p className="text-chalk-soft text-sm">
              Les débats apparaissent dès que deux amis ou plus ont terminé le questionnaire.
            </p>
          </Card>
        </div>
      </PageTransition>
    )
  }

  const debates = generateDebates(finished, 5)

  return (
    <PageTransition>
      <div className="px-6 pt-10 pb-6 safe-top">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-chalk-faint">Débats du groupe</p>
          <h1 className="text-3xl font-extrabold shimmer-text mb-1">À vous de jouer</h1>
          <p className="text-chalk-soft text-sm">Des sujets générés à partir de vos plus grandes différences</p>
        </div>

        {debates.length === 0 ? (
          <Card className="text-center">
            <p className="text-4xl mb-3">🤝</p>
            <p className="text-chalk-soft text-sm">
              Vous êtes étonnamment alignés sur tout ! Pas de gros débat à l'horizon.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {debates.map((d, i) => (
              <Card key={d.id} delay={0.05 * i}>
                <p className="text-xs uppercase tracking-wider text-fuchsia-300/80 font-semibold mb-2">
                  Vision opposée sur {d.theme}
                </p>
                <p className="text-[15px] font-semibold leading-snug mb-4">🗣️ Débattez : {d.question}</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <Avatar pseudo={d.memberA.pseudo} color={d.memberA.color} size={44} />
                    <p className="text-sm font-semibold">{d.memberA.pseudo}</p>
                    <p className="text-[11px] text-chalk-soft text-center">défend {d.poleA}</p>
                  </div>
                  <span className="text-chalk-faint font-bold text-sm px-2">VS</span>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <Avatar pseudo={d.memberB.pseudo} color={d.memberB.color} size={44} />
                    <p className="text-sm font-semibold">{d.memberB.pseudo}</p>
                    <p className="text-[11px] text-chalk-soft text-center">défend {d.poleB}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
