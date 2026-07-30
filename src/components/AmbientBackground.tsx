/**
 * Atmosphère de base — « la table sous la lampe ».
 *
 * Remplace les 4 taches de dégradé néon qui dérivaient en permanence derrière chaque page.
 * Trois raisons de les avoir retirées, dans l'ordre d'importance :
 *  1. Elles ne disaient rien du produit — c'est le marqueur visuel le plus banal du web actuel.
 *  2. Du mouvement décoratif permanent sur 8 téléphones dans une pièce sombre disperse
 *     l'attention, alors que tout l'enjeu d'un jeu de soirée est de regarder au même endroit.
 *  3. Un mouvement gratuit dévalue le mouvement utile : si le fond bouge sans arrêt, une
 *     révélation qui bouge ne surprend plus personne.
 *
 * Ce qui reste : une nappe de lumière chaude et FIXE en haut (la lampe au-dessus de la table),
 * un halo de feutre en bas, et une vignette qui referme les bords. Zéro animation, zéro coût
 * par frame — c'est aussi la version la plus légère qu'on ait jamais eue sur mobile.
 */
export function AmbientBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* La lampe : chute de lumière depuis le haut, très douce. */}
      <div
        className="absolute inset-x-0 top-0 h-[70svh]"
        style={{
          background:
            'radial-gradient(80% 100% at 50% -10%, rgba(255, 236, 209, 0.09) 0%, rgba(255, 236, 209, 0.03) 38%, transparent 72%)',
        }}
      />
      {/* Le feutre : la table prend une teinte légèrement plus chaude que le fond. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55svh]"
        style={{
          background: 'radial-gradient(90% 100% at 50% 120%, rgba(38, 26, 44, 0.55) 0%, transparent 70%)',
        }}
      />
      {/* Vignette : referme les angles pour que le regard reste au centre. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(130% 100% at 50% 40%, transparent 45%, var(--color-ink) 100%)',
        }}
      />
    </div>
  )
}
