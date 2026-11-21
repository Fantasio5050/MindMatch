/** Lien de la platine d'une salle. Avec la clé de l'hôte, il permet de reprendre la main sur une
 * platine déjà en ligne (sinon, seul le premier appareil arrivé devient la platine). */
export function platineUrl(code: string, key?: string | null): string {
  return `${window.location.origin}${window.location.pathname}#/platine/${code}${key ? `?cle=${encodeURIComponent(key)}` : ''}`
}
