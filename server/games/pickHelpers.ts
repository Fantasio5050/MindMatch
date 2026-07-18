/** Sélection de contenu anti-répétition, partagée par les modules de jeu.
 *
 * Objectif : ne pas donner l'impression de retomber sans cesse sur les mêmes gages / vérités /
 * actions / questions au cours d'une partie. Tant que le pool n'est pas épuisé, on ne ressort
 * jamais un élément déjà tiré ; une fois tout le pool consommé, on recycle mais en évitant au
 * moins de reproposer immédiatement le tout dernier élément sorti (pas deux fois d'affilée).
 *
 * Beaucoup de modules tiennent déjà une liste d'ids `used` et filtrent en ligne — ce helper
 * factorise ce comportement pour les pools de chaînes brutes (gages) et garantit la même
 * qualité de non-répétition partout. */
export function pickWithoutRepeat<T>(pool: readonly T[], used: readonly T[]): T {
  if (pool.length === 0) throw new Error('pickWithoutRepeat: pool vide')
  const available = pool.filter((x) => !used.includes(x))
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)]
  // Pool épuisé : on repart du pool complet, mais sans resortir le dernier élément tiré.
  const last = used[used.length - 1]
  const recyclable = pool.length > 1 ? pool.filter((x) => x !== last) : [...pool]
  return recyclable[Math.floor(Math.random() * recyclable.length)]
}
