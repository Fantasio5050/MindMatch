import * as THREE from 'three'

/** Outils de perf partagés par les scènes 3D (PMU, Roue). Importés uniquement par les chunks
 * lazy des scènes — jamais dans le bundle principal des téléphones. */

/** Budget de pixels rendus par frame. Une TV 4K annonçant devicePixelRatio 1 rendait sinon
 * 8,3 Mpx par frame (× l'antialiasing) — de quoi faire ramer ou crasher un GPU de TV. On vise
 * ~du 1440×900 : indiscernable à distance de canapé, largement moins de travail GPU. */
const MAX_RENDER_PIXELS = 1_300_000

/** Perte de contexte WebGL répétée = signe qu'un GPU de TV fragile est en train de lâcher. Après
 * quelques pertes rapprochées on arrête d'essayer (forceContextLoss + on ne relance plus la boucle
 * de rendu) plutôt que de continuer à marteler un driver à l'agonie jusqu'au crash complet. */
const MAX_CONTEXT_LOSSES = 3
const CONTEXT_LOSS_WINDOW_MS = 15_000

export interface ManagedRenderer {
  renderer: THREE.WebGLRenderer
  /** false pendant une perte de contexte WebGL, ou définitivement après trop de pertes — il faut
   * sauter le rendu, pas crasher. */
  canRender: () => boolean
  /** true une fois qu'on a définitivement abandonné le rendu 3D sur cet appareil. */
  isFatal: () => boolean
  resize: () => void
  dispose: () => void
}

function pixelRatioFor(container: HTMLElement): number {
  const area = Math.max(1, container.clientWidth * container.clientHeight)
  // Plafonné à 1 : une TV est vue à distance du canapé, l'échantillonnage "retina" n'y apporte
  // rien de visible mais double ou triple le travail de remplissage du GPU.
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1, Math.sqrt(MAX_RENDER_PIXELS / area)))
}

/** Certains navigateurs de TV bas de gamme n'exposent WebGL qu'à moitié (contexte non
 * fonctionnel, extensions manquantes) ou pas du tout. On vérifie explicitement avant de
 * construire le vrai renderer three.js, pour échouer avec une erreur propre et attrapable plutôt
 * qu'un crash silencieux plus loin dans le pipeline de rendu. */
function assertWebglAvailable(): void {
  const probe = document.createElement('canvas')
  const gl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl')
  if (!gl) throw new Error('WebGL indisponible sur cet appareil')
}

export function createManagedRenderer(container: HTMLElement): ManagedRenderer {
  assertWebglAvailable()

  // Ni l'antialiasing (coût de remplissage multiplié) ni le mode "high-performance" (peut
  // pousser certains drivers TV embarqués vers un bascule GPU cassée) ne valent le risque sur du
  // matériel qu'on ne connaît pas : on vise la stabilité avant le rendu léché.
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'default' })

  let contextLost = false
  let fatal = false
  const lossTimestamps: number[] = []

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault() // indispensable : autorise le navigateur à restaurer le contexte
    contextLost = true

    const now = performance.now()
    lossTimestamps.push(now)
    while (lossTimestamps.length > 0 && now - lossTimestamps[0] > CONTEXT_LOSS_WINDOW_MS) lossTimestamps.shift()
    if (lossTimestamps.length >= MAX_CONTEXT_LOSSES) {
      fatal = true
      renderer.forceContextLoss() // libère la mémoire GPU pour de bon, on ne retentera plus
    }
  })
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    if (!fatal) contextLost = false
  })

  const resize = () => {
    renderer.setPixelRatio(pixelRatioFor(container))
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  resize()
  container.appendChild(renderer.domElement)

  return {
    renderer,
    canRender: () => !contextLost && !fatal,
    isFatal: () => fatal,
    resize,
    dispose: () => {
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

/** Limiteur de cadence : plein régime quand la scène est en action, moitié quand elle est au
 * repos (paddock, roue à l'arrêt, podium) — une TV n'a aucune raison de brûler 60 fps pour un
 * léger balancement de caméra. Fonctionne par saut de frames, donc toutes les animations basées
 * sur le temps absolu restent exactes. */
export function makeFrameGate() {
  let lastRender = -Infinity
  return function shouldRender(nowMs: number, active: boolean): boolean {
    const minInterval = active ? 1000 / 60 - 2 : 1000 / 30 - 2
    if (nowMs - lastRender < minInterval) return false
    lastRender = nowMs
    return true
  }
}

const TEXTURE_MAP_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const

function disposeMaterial(material: THREE.Material): void {
  const withMaps = material as unknown as Record<(typeof TEXTURE_MAP_KEYS)[number], THREE.Texture | null>
  // .dispose() sur un matériau ne libère PAS les textures qu'il référence (map, emissiveMap…) —
  // sans ça, chaque canvas texture générée pour une carte/roue/banderole restait en mémoire GPU
  // après le démontage de la scène, un vrai fuite qui s'accumule sur une TV restée allumée à
  // travers plusieurs jeux/manches d'une même soirée.
  for (const key of TEXTURE_MAP_KEYS) withMaps[key]?.dispose()
  material.dispose()
}

export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else if (material) disposeMaterial(material)
  })
}
