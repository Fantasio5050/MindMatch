import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Les pions en métal, modelés à la main en géométrie procédurale (aucun fichier à télécharger) :
 * chapeau haut-de-forme, voiture, bateau, chien, dé à coudre, fer à repasser, botte, brouette.
 * Chaque pion repose sur un socle à la couleur de son joueur — c'est ce qui le désigne de loin.
 * Taille de référence : ~0.9 de large, soit la moitié d'une case.
 */

function lathe(points: [number, number][], segments = 32) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  )
}

function extrudeProfile(points: [number, number][], depth: number, bevel = 0.03): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 })
  g.translate(0, 0, -depth / 2)
  return g
}

const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  g.rotateX(rx)
  g.rotateY(ry)
  g.rotateZ(rz)
  g.translate(x, y, z)
  return g
}

/** Les géométries se fondent en une seule (un appel de dessin par pion). */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    for (const name of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(name)) n.deleteAttribute(name)
    if (!n.getAttribute('uv')) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((n.getAttribute('position').count) * 2), 2))
    return n
  })
  const merged = mergeGeometries(clean, false)!
  merged.computeVertexNormals()
  return merged
}

function hat() {
  return merge([
    lathe([[0, 0.02], [0.46, 0.02], [0.47, 0.06], [0.3, 0.07], [0.27, 0.12], [0.29, 0.62], [0.3, 0.66], [0, 0.67]]),
    at(new THREE.TorusGeometry(0.285, 0.035, 8, 32), 0, 0.17, 0, Math.PI / 2),
  ])
}

function car() {
  const body = extrudeProfile([[-0.48, 0.08], [0.48, 0.08], [0.5, 0.22], [0.22, 0.26], [0.1, 0.42], [-0.22, 0.42], [-0.34, 0.27], [-0.5, 0.24]], 0.34)
  const wheels = [-0.3, 0.3].flatMap((x) => [-0.19, 0.19].map((z) => at(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 18), x, 0.11, z, Math.PI / 2)))
  return merge([body, ...wheels])
}

function boat() {
  const hull = extrudeProfile([[-0.5, 0.22], [0.52, 0.24], [0.3, 0.02], [-0.36, 0.02]], 0.3)
  const mast = at(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8), 0, 0.53, 0)
  const sail = extrudeProfile([[0.04, 0.3], [0.04, 0.82], [0.36, 0.3]], 0.02, 0.01)
  const jib = extrudeProfile([[-0.04, 0.32], [-0.04, 0.74], [-0.3, 0.32]], 0.02, 0.01)
  return merge([hull, mast, sail, jib])
}

function dog() {
  const body = at(new THREE.BoxGeometry(0.62, 0.24, 0.24), 0, 0.32, 0)
  const head = at(new THREE.BoxGeometry(0.24, 0.22, 0.2), 0.32, 0.5, 0)
  const snout = at(new THREE.BoxGeometry(0.16, 0.1, 0.14), 0.48, 0.44, 0)
  const ears = [-0.06, 0.06].map((z) => at(new THREE.ConeGeometry(0.05, 0.14, 6), 0.28, 0.66, z))
  const legs = [-0.22, 0.2].flatMap((x) => [-0.08, 0.08].map((z) => at(new THREE.BoxGeometry(0.08, 0.22, 0.08), x, 0.11, z)))
  const tail = at(new THREE.CylinderGeometry(0.02, 0.035, 0.2, 6), -0.36, 0.48, 0, 0, 0, 0.6)
  const beard = at(new THREE.BoxGeometry(0.12, 0.08, 0.14), 0.44, 0.36, 0)
  return merge([body, head, snout, ...ears, ...legs, tail, beard])
}

function thimble() {
  return merge([lathe([[0, 0.02], [0.3, 0.02], [0.32, 0.06], [0.29, 0.1], [0.27, 0.48], [0.22, 0.6], [0.12, 0.66], [0, 0.67]], 28)])
}

function iron() {
  const sole = extrudeProfile([[-0.42, 0.02], [0.5, 0.02], [0.3, 0.14], [-0.42, 0.14]], 0.36)
  const top = extrudeProfile([[-0.36, 0.14], [0.36, 0.14], [0.18, 0.24], [-0.36, 0.24]], 0.3)
  const handle = at(new THREE.TorusGeometry(0.2, 0.035, 8, 20, Math.PI), -0.05, 0.25, 0)
  return merge([at(sole, 0, 0, 0, 0, Math.PI / 2), at(top, 0, 0, 0, 0, Math.PI / 2), at(handle, 0, 0, 0, 0, Math.PI / 2)])
}

function boot() {
  return merge([extrudeProfile([[-0.3, 0.02], [0.46, 0.02], [0.48, 0.12], [0.22, 0.2], [0.02, 0.24], [0.02, 0.7], [-0.3, 0.7], [-0.32, 0.1]], 0.24)])
}

function wheelbarrow() {
  const tray = extrudeProfile([[-0.34, 0.24], [0.26, 0.24], [0.38, 0.46], [-0.4, 0.46]], 0.36)
  const wheel = at(new THREE.TorusGeometry(0.12, 0.04, 8, 18), 0.36, 0.14, 0)
  const legs = [-0.12, 0.12].map((z) => at(new THREE.BoxGeometry(0.05, 0.24, 0.04), -0.22, 0.12, z))
  const handles = [-0.15, 0.15].map((z) => at(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), -0.5, 0.36, z, 0, 0, Math.PI / 2 - 0.25))
  return merge([tray, wheel, ...legs, ...handles])
}

const BUILDERS = [hat, car, boat, dog, thimble, iron, boot, wheelbarrow]

/** Cache des géométries de pions (une par modèle). */
export class TokenKit {
  private geos = new Map<number, THREE.BufferGeometry>()
  readonly metal = new THREE.MeshStandardMaterial({ color: 0xd9dbe0, metalness: 1, roughness: 0.22 })
  private baseGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.08, 32)
  private bases: THREE.MeshStandardMaterial[] = []

  geometry(token: number): THREE.BufferGeometry {
    const k = ((token % BUILDERS.length) + BUILDERS.length) % BUILDERS.length
    let g = this.geos.get(k)
    if (!g) {
      g = BUILDERS[k]()
      this.geos.set(k, g)
    }
    return g
  }

  /** Un pion complet : le modèle en métal sur son socle coloré. */
  make(token: number, color: string): THREE.Group {
    const group = new THREE.Group()
    const base = new THREE.Mesh(
      this.baseGeo,
      (() => {
        const m = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.4 })
        this.bases.push(m)
        return m
      })(),
    )
    base.position.y = 0.04
    const body = new THREE.Mesh(this.geometry(token), this.metal)
    body.position.y = 0.08
    for (const m of [base, body]) {
      m.castShadow = true
      m.receiveShadow = true
    }
    group.add(base, body)
    return group
  }

  dispose() {
    for (const g of this.geos.values()) g.dispose()
    this.baseGeo.dispose()
    this.metal.dispose()
    for (const m of this.bases) m.dispose()
  }
}

/** Maisons vertes et hôtels rouges, géométries partagées. */
export class Buildings {
  readonly houseGeo: THREE.BufferGeometry
  readonly hotelGeo: THREE.BufferGeometry
  readonly houseMat = new THREE.MeshStandardMaterial({ color: 0x1f9e4a, roughness: 0.45, metalness: 0.05 })
  readonly hotelMat = new THREE.MeshStandardMaterial({ color: 0xd7262e, roughness: 0.45, metalness: 0.05 })

  constructor() {
    const roof = (w: number, d: number, h: number, y: number) => {
      const g = extrudeProfile([[-w / 2, 0], [w / 2, 0], [0, h]], d, 0.005)
      g.translate(0, y, 0)
      return g
    }
    this.houseGeo = merge([at(new THREE.BoxGeometry(0.3, 0.22, 0.3), 0, 0.11, 0), roof(0.34, 0.3, 0.16, 0.22)])
    this.hotelGeo = merge([at(new THREE.BoxGeometry(0.62, 0.28, 0.34), 0, 0.14, 0), roof(0.66, 0.34, 0.18, 0.28)])
  }

  dispose() {
    this.houseGeo.dispose()
    this.hotelGeo.dispose()
    this.houseMat.dispose()
    this.hotelMat.dispose()
  }
}
