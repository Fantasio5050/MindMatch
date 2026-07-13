import * as THREE from 'three'

/** Outils de perf partagés par les scènes 3D (PMU, Roue). Importés uniquement par les chunks
 * lazy des scènes — jamais dans le bundle principal des téléphones. */

/** Budget de pixels rendus par frame. Une TV 4K annonçant devicePixelRatio 1 rendait sinon
 * 8,3 Mpx par frame (× l'antialiasing) — de quoi faire ramer ou crasher un GPU de TV. On vise
 * ~du 1600×1000 : indiscernable à distance de canapé, 5× moins de travail GPU. */
const MAX_RENDER_PIXELS = 1_600_000

export interface ManagedRenderer {
  renderer: THREE.WebGLRenderer
  /** false pendant une perte de contexte WebGL — il faut sauter le rendu, pas crasher. */
  canRender: () => boolean
  resize: () => void
  dispose: () => void
}

function pixelRatioFor(container: HTMLElement): number {
  const area = Math.max(1, container.clientWidth * container.clientHeight)
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(MAX_RENDER_PIXELS / area)))
}

export function createManagedRenderer(container: HTMLElement): ManagedRenderer {
  const initialRatio = pixelRatioFor(container)
  // L'antialiasing multiplie le coût de remplissage : on ne l'active que si l'appareil a du
  // budget (ratio non réduit). Sur les écrans qu'on a dû brider, la résolution prime sur l'AA.
  const renderer = new THREE.WebGLRenderer({ antialias: initialRatio >= 1, powerPreference: 'high-performance' })

  let contextLost = false
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault() // indispensable : autorise le navigateur à restaurer le contexte
    contextLost = true
  })
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false
  })

  const resize = () => {
    renderer.setPixelRatio(pixelRatioFor(container))
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  resize()
  container.appendChild(renderer.domElement)

  return {
    renderer,
    canRender: () => !contextLost,
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

export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) material.forEach((m) => m.dispose())
    else if (material) material.dispose()
  })
}
