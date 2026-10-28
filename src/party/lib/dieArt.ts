import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { FACE_VALUES } from './diceSim'

/**
 * Habillage d'un dé 3D : géométrie aux arêtes arrondies, six faces peintes (points creusés, as
 * rouge à la façon des dés de casino asiatiques) et une carte d'émission par face pour faire
 * s'allumer les points de la face gagnante à la couleur du joueur.
 */

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.29, 0.24], [0.29, 0.5], [0.29, 0.76], [0.71, 0.24], [0.71, 0.5], [0.71, 0.76]],
}

export interface DieStyle {
  body: string
  /** Bord de face, un peu plus sombre : donne du volume à l'arrondi. */
  edge: string
  pip: string
  /** Couleur de l'as (le point unique du 1). */
  ace: string
}

export const IVORY_DIE: DieStyle = { body: '#f7f1e3', edge: '#d9cfb8', pip: '#1b1622', ace: '#c8102e' }

const SIZE = 256

function drawFace(value: number, style: DieStyle): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(SIZE * 0.45, SIZE * 0.4, SIZE * 0.1, SIZE / 2, SIZE / 2, SIZE * 0.75)
  g.addColorStop(0, style.body)
  g.addColorStop(1, style.edge)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SIZE, SIZE)
  const ace = value === 1
  const r = SIZE * (ace ? 0.13 : 0.085)
  for (const [u, v] of PIPS[value]) {
    const x = u * SIZE
    const y = v * SIZE
    // Creux : un liseré clair en bas à droite (la lumière accroche le bord du trou), puis le point.
    ctx.beginPath()
    ctx.arc(x + r * 0.08, y + r * 0.1, r * 1.08, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fill()
    const pg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
    const base = ace ? style.ace : style.pip
    pg.addColorStop(0, base)
    pg.addColorStop(1, shade(base, -0.35))
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = pg
    ctx.fill()
  }
  return c
}

function drawGlow(value: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, SIZE, SIZE)
  const r = SIZE * (value === 1 ? 0.13 : 0.085)
  for (const [u, v] of PIPS[value]) {
    const g = ctx.createRadialGradient(u * SIZE, v * SIZE, 0, u * SIZE, v * SIZE, r * 1.25)
    g.addColorStop(0, '#fff')
    g.addColorStop(0.75, '#fff')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(u * SIZE - r * 1.3, v * SIZE - r * 1.3, r * 2.6, r * 2.6)
  }
  return c
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount * hsl.l)))
  return `#${c.getHexString()}`
}

function texture(canvas: HTMLCanvasElement, anisotropy: number, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = anisotropy
  return t
}

/** Les six matériaux d'un dé, dans l'ordre des faces d'une BoxGeometry. */
export class DieSkin {
  readonly materials: THREE.MeshPhysicalMaterial[]

  constructor(style: DieStyle = IVORY_DIE, anisotropy = 4) {
    this.materials = FACE_VALUES.map(
      (value) =>
        new THREE.MeshPhysicalMaterial({
          map: texture(drawFace(value, style), anisotropy, true),
          emissiveMap: texture(drawGlow(value), anisotropy, false),
          emissive: new THREE.Color(0x000000),
          emissiveIntensity: 0,
          roughness: 0.3,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
        }),
    )
  }

  /** Allume les points de la face `value` (0 = éteint). */
  glow(value: number | null, color: THREE.ColorRepresentation, intensity: number) {
    FACE_VALUES.forEach((v, i) => {
      const m = this.materials[i]
      if (v === value && intensity > 0) {
        m.emissive.set(color)
        m.emissiveIntensity = intensity
      } else {
        m.emissiveIntensity = 0
      }
    })
  }

  dispose() {
    for (const m of this.materials) {
      m.map?.dispose()
      m.emissiveMap?.dispose()
      m.dispose()
    }
  }
}

export function makeDieGeometry(size: number): THREE.BufferGeometry {
  return new RoundedBoxGeometry(size, size, size, 5, size * 0.14)
}
