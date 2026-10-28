import * as THREE from 'three'
import type { UnoCard } from '../types'
import { CARD_H, CARD_W, drawBack, drawFace, type PlayColor } from './cardFaces'

export { CARD_W, CARD_H, UNO_HEX, loadCardFont, type PlayColor } from './cardFaces'

/**
 * Matériaux et géométrie des cartes de la table 3D. Le dessin lui-même vit dans `cardFaces.ts`.
 *
 * Aucune image à télécharger : 54 faces distinctes au plus (4 couleurs × 13 valeurs + 2 jokers),
 * dessinées une fois à la demande et mises en cache pour toute la partie.
 */

function toTexture(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = anisotropy
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/** Cache des matériaux de cartes, partagé par toutes les cartes de la scène. */
export class CardArt {
  private faces = new Map<string, THREE.MeshStandardMaterial>()
  readonly back: THREE.MeshStandardMaterial
  readonly edge: THREE.MeshStandardMaterial

  private anisotropy: number

  constructor(anisotropy: number) {
    this.anisotropy = anisotropy
    this.back = new THREE.MeshStandardMaterial({ map: toTexture(drawBack(), anisotropy), roughness: 0.55, metalness: 0 })
    this.edge = new THREE.MeshStandardMaterial({ color: 0xece8df, roughness: 0.8 })
  }

  face(card: Pick<UnoCard, 'color' | 'value'>, tint: PlayColor | null = null): THREE.MeshStandardMaterial {
    const key = `${card.color}:${card.value}:${tint ?? ''}`
    let m = this.faces.get(key)
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: toTexture(drawFace(card, tint), this.anisotropy), roughness: 0.42, metalness: 0 })
      this.faces.set(key, m)
    }
    return m
  }

  dispose() {
    for (const m of this.faces.values()) {
      m.map?.dispose()
      m.dispose()
    }
    this.back.map?.dispose()
    this.back.dispose()
    this.edge.dispose()
  }
}

/**
 * Géométrie d'une carte : une plaque arrondie de faible épaisseur, en trois groupes de matériaux
 * (face, dos, tranche). Une seule géométrie partagée par toutes les cartes.
 */
export function makeCardGeometry(thickness = 0.012): THREE.BufferGeometry {
  const r = 0.09
  const w = CARD_W
  const h = CARD_H
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2 + r, -h / 2)
  shape.lineTo(w / 2 - r, -h / 2)
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  shape.lineTo(w / 2, h / 2 - r)
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  shape.lineTo(-w / 2 + r, h / 2)
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  shape.lineTo(-w / 2, -h / 2 + r)
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)

  const extruded = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 6 })
  extruded.translate(0, 0, -thickness / 2)
  // ExtrudeGeometry : groupe 0 = les deux faces, groupe 1 = la tranche. On sépare face (z+) et dos
  // (z−) en recalculant les UV des faces à partir des positions, pour que la texture couvre la carte.
  const pos = extruded.getAttribute('position')
  const uv = extruded.getAttribute('uv')
  const normal = extruded.getAttribute('normal')
  // Selon la version de three.js, l'extrusion est indexée ou non (sommets consécutifs par triangle).
  const at = (i: number) => (extruded.index ? extruded.index.getX(i) : i)
  const front: number[] = []
  const back: number[] = []
  const side: number[] = []
  const [caps, sides] = extruded.groups
  for (let i = caps.start; i < caps.start + caps.count; i += 3) {
    const a = at(i)
    ;(normal.getZ(a) > 0 ? front : back).push(a, at(i + 1), at(i + 2))
  }
  for (let i = sides.start; i < sides.start + sides.count; i++) side.push(at(i))
  for (let v = 0; v < pos.count; v++) {
    if (Math.abs(normal.getZ(v)) > 0.5) {
      const u = (pos.getX(v) + w / 2) / w
      const vv = (pos.getY(v) + h / 2) / h
      // Le dos est vu de l'autre côté : on le retourne pour que le logo ne soit pas en miroir.
      uv.setXY(v, normal.getZ(v) > 0 ? u : 1 - u, vv)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', pos)
  geo.setAttribute('normal', normal)
  geo.setAttribute('uv', uv)
  geo.setIndex([...front, ...back, ...side])
  geo.addGroup(0, front.length, 0)
  geo.addGroup(front.length, back.length, 1)
  geo.addGroup(front.length + back.length, side.length, 2)
  extruded.dispose()
  return geo
}
