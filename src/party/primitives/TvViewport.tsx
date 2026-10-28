import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Scène virtuelle des écrans TV historiques. Voir `.tv-viewport` dans styles/tokens.css. */
export const TV_BASE_WIDTH = 1280
export const TV_BASE_HEIGHT = 720

/**
 * TvViewport — fait remplir l'écran aux vues TV composées en tailles fixes.
 *
 * Vingt écrans de jeu sont dessinés en pixels de « téléphone » : leur texte suivait la taille de
 * l'écran (échelle `.tv-surface`), mais pas leurs boîtes, cartes, avatars et marges. Résultat sur
 * une vraie TV : en 1080p le jeu tenait dans un timbre-poste au milieu de l'écran, en 720p il
 * débordait et coupait le dernier joueur de la liste.
 *
 * On les met donc en page dans une scène FIXE de 1280 × 720 — les proportions pour lesquelles ils
 * ont été composés — puis on agrandit (ou réduit) la scène entière pour remplir l'écran, quelle
 * que soit sa définition : 720p, 1080p ou 4K donnent la même image, juste plus ou moins fine.
 *
 * Si le contenu dépasse la hauteur (huit joueurs dans une liste), la scène s'allonge et l'échelle
 * se resserre : on rétrécit un peu plutôt que de couper qui que ce soit.
 */
export function TvViewport({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, height: TV_BASE_HEIGHT })

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const update = () => {
      // Hauteur des enfants DANS LE FLUX, pas `scrollHeight` : un élément en position fixe ou
      // absolue (le canevas des confettis, dimensionné sur la vraie fenêtre) gonflait la mesure et
      // rétrécissait la scène pour rien.
      const content = Array.from(el.children).reduce((h, c) => Math.max(h, (c as HTMLElement).offsetHeight), 0)
      const height = Math.max(TV_BASE_HEIGHT, content)
      const scale = Math.min(window.innerWidth / TV_BASE_WIDTH, window.innerHeight / height)
      setFit((f) => (Math.abs(f.scale - scale) < 0.001 && f.height === height ? f : { scale, height }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        ref={inner}
        className="tv-viewport absolute left-1/2 top-1/2"
        style={{
          width: TV_BASE_WIDTH,
          minHeight: TV_BASE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${fit.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
