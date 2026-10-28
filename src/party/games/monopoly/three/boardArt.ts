import { BOARD, GROUP_COLORS, formatMoney, type Square } from '../../../../data/monopoly'

/**
 * Le plateau dessiné : géométrie des 40 cases et peinture du dessus du plateau (une seule texture
 * 2048 × 2048, nette à distance de canapé et légère pour un GPU de TV). Sans dépendance à three.js :
 * la manette réutilise la géométrie pour sa mini-carte.
 */

/** Côté du plateau, taille des coins et largeur d'une case ordinaire (unités de scène). */
export const BOARD_SIZE = 22
export const CORNER = 2.8
export const CELL = (BOARD_SIZE - 2 * CORNER) / 9
const HALF = BOARD_SIZE / 2

export interface SquareLayout {
  x: number
  z: number
  /** Largeur le long du bord, profondeur vers l'extérieur. */
  w: number
  d: number
  /** Rotation autour de Y qui oriente le +z local vers l'extérieur du plateau. */
  rot: number
  side: 0 | 1 | 2 | 3
  corner: boolean
}

export function squareLayout(i: number): SquareLayout {
  const side = Math.floor(i / 10) as 0 | 1 | 2 | 3
  const k = i % 10
  const rot = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side]
  const edge = HALF - CORNER / 2
  if (k === 0) {
    const cx = [edge, -edge, -edge, edge][side]
    const cz = [edge, edge, -edge, -edge][side]
    return { x: cx, z: cz, w: CORNER, d: CORNER, rot, side, corner: true }
  }
  const along = HALF - CORNER - (k - 0.5) * CELL
  const pos = [
    [along, edge],
    [-edge, along],
    [-along, -edge],
    [edge, -along],
  ][side]
  return { x: pos[0], z: pos[1], w: CELL, d: CORNER, rot, side, corner: false }
}

/** Direction (x, z) vers l'extérieur du plateau pour une case. */
export function outward(i: number): [number, number] {
  const side = Math.floor(i / 10) % 4
  return [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ][side] as [number, number]
}

// ─── Peinture ───────────────────────────────────────────────────────────────

const PX = 2048
const S = PX / BOARD_SIZE
const DISPLAY = '"Archivo Variable", "Archivo", "Arial Black", system-ui, sans-serif'
const SANS = '"Inter Tight Variable", "Inter Tight", system-ui, sans-serif'
export const CREAM = '#f4eddb'
const INK = '#1d1a17'
const CENTER = '#0f3a30'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function textBlock(ctx: CanvasRenderingContext2D, text: string, y: number, maxWidth: number, size: number, font = SANS, weight = 800) {
  ctx.font = `${weight} ${size}px ${font}`
  const lines = wrap(ctx, text.toUpperCase(), maxWidth)
  lines.forEach((l, n) => ctx.fillText(l, 0, y + n * size * 1.08, maxWidth))
  return lines.length
}

/** Locomotive stylisée. */
function drawTrain(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save()
  ctx.fillStyle = INK
  ctx.fillRect(-s * 0.55, -s * 0.15, s * 0.8, s * 0.38)
  ctx.fillRect(s * 0.1, -s * 0.45, s * 0.3, s * 0.32)
  ctx.fillRect(-s * 0.45, -s * 0.38, s * 0.14, s * 0.25)
  ctx.beginPath()
  ctx.moveTo(-s * 0.55, s * 0.23)
  ctx.lineTo(-s * 0.72, s * 0.32)
  ctx.lineTo(-s * 0.55, s * 0.32)
  ctx.fill()
  for (const x of [-s * 0.35, -s * 0.05, s * 0.22]) {
    ctx.beginPath()
    ctx.arc(x, s * 0.3, s * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawBulb(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save()
  ctx.fillStyle = '#f2c230'
  ctx.strokeStyle = INK
  ctx.lineWidth = s * 0.06
  ctx.beginPath()
  ctx.arc(0, -s * 0.12, s * 0.3, Math.PI * 0.8, Math.PI * 2.2)
  ctx.lineTo(s * 0.12, s * 0.22)
  ctx.lineTo(-s * 0.12, s * 0.22)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.fillRect(-s * 0.13, s * 0.25, s * 0.26, s * 0.08)
  ctx.fillRect(-s * 0.1, s * 0.36, s * 0.2, s * 0.06)
  ctx.restore()
}

function drawTap(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save()
  ctx.fillStyle = INK
  ctx.fillRect(-s * 0.45, -s * 0.12, s * 0.7, s * 0.18)
  ctx.fillRect(s * 0.15, -s * 0.12, s * 0.16, s * 0.42)
  ctx.fillRect(-s * 0.15, -s * 0.36, s * 0.08, s * 0.26)
  ctx.fillRect(-s * 0.3, -s * 0.4, s * 0.38, s * 0.08)
  ctx.fillStyle = '#3d8fd6'
  ctx.beginPath()
  ctx.moveTo(s * 0.23, s * 0.38)
  ctx.quadraticCurveTo(s * 0.35, s * 0.55, s * 0.23, s * 0.6)
  ctx.quadraticCurveTo(s * 0.11, s * 0.55, s * 0.23, s * 0.38)
  ctx.fill()
  ctx.restore()
}

function drawChest(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save()
  ctx.fillStyle = '#2b6cb0'
  ctx.strokeStyle = INK
  ctx.lineWidth = s * 0.05
  ctx.beginPath()
  ctx.rect(-s * 0.4, -s * 0.05, s * 0.8, s * 0.38)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-s * 0.4, -s * 0.05)
  ctx.quadraticCurveTo(0, -s * 0.42, s * 0.4, -s * 0.05)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f2c230'
  ctx.fillRect(-s * 0.07, -s * 0.06, s * 0.14, s * 0.16)
  ctx.restore()
}

function drawSquare(ctx: CanvasRenderingContext2D, sq: Square, i: number) {
  const L = squareLayout(i)
  const w = L.w * S
  const d = L.d * S
  ctx.save()
  ctx.translate((L.x + HALF) * S, (L.z + HALF) * S)
  ctx.rotate(-L.rot)
  ctx.fillStyle = CREAM
  ctx.fillRect(-w / 2, -d / 2, w, d)
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.strokeRect(-w / 2, -d / 2, w, d)
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const inner = w * 0.86
  switch (sq.kind) {
    case 'property': {
      const band = d * 0.22
      ctx.fillStyle = GROUP_COLORS[sq.group]
      ctx.fillRect(-w / 2, -d / 2, w, band)
      ctx.strokeRect(-w / 2, -d / 2, w, band)
      ctx.fillStyle = INK
      textBlock(ctx, sq.name, -d / 2 + band + d * 0.07, inner, w * 0.15)
      ctx.font = `700 ${w * 0.17}px ${SANS}`
      ctx.fillText(formatMoney(sq.price), 0, d / 2 - d * 0.18, inner)
      break
    }
    case 'station':
      textBlock(ctx, sq.name, -d / 2 + d * 0.08, inner, w * 0.14)
      ctx.save()
      ctx.translate(0, d * 0.06)
      drawTrain(ctx, w * 0.62)
      ctx.restore()
      ctx.font = `700 ${w * 0.17}px ${SANS}`
      ctx.fillText(formatMoney(sq.price), 0, d / 2 - d * 0.18, inner)
      break
    case 'utility':
      textBlock(ctx, sq.name, -d / 2 + d * 0.08, inner, w * 0.13)
      ctx.save()
      ctx.translate(0, d * 0.08)
      if (sq.name.includes('eaux')) drawTap(ctx, w * 0.6)
      else drawBulb(ctx, w * 0.6)
      ctx.restore()
      ctx.font = `700 ${w * 0.17}px ${SANS}`
      ctx.fillText(formatMoney(sq.price), 0, d / 2 - d * 0.18, inner)
      break
    case 'chance':
      ctx.font = `900 ${w * 0.2}px ${DISPLAY}`
      ctx.fillText('CHANCE', 0, -d / 2 + d * 0.08, inner)
      ctx.fillStyle = '#e8641b'
      ctx.font = `italic 900 ${d * 0.5}px ${DISPLAY}`
      ctx.textBaseline = 'middle'
      ctx.fillText('?', 0, d * 0.12)
      break
    case 'chest':
      textBlock(ctx, 'Caisse de communauté', -d / 2 + d * 0.08, inner, w * 0.14)
      ctx.save()
      ctx.translate(0, d * 0.16)
      drawChest(ctx, w * 0.62)
      ctx.restore()
      break
    case 'tax':
      textBlock(ctx, sq.name, -d / 2 + d * 0.08, inner, w * 0.14)
      ctx.save()
      ctx.translate(0, d * 0.08)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = sq.amount > 150 ? '#c0392b' : '#7d3c98'
      ctx.fillRect(-w * 0.17, -w * 0.17, w * 0.34, w * 0.34)
      ctx.restore()
      ctx.font = `700 ${w * 0.15}px ${SANS}`
      ctx.fillText(`Payez ${formatMoney(sq.amount)}`, 0, d / 2 - d * 0.18, inner)
      break
    case 'go': {
      ctx.textBaseline = 'middle'
      ctx.rotate(-Math.PI / 4)
      ctx.font = `900 ${w * 0.11}px ${SANS}`
      ctx.fillText('RECEVEZ 200 € EN PASSANT', 0, -w * 0.28, w * 0.9)
      ctx.font = `italic 900 ${w * 0.24}px ${DISPLAY}`
      ctx.fillStyle = '#c0392b'
      ctx.fillText('DÉPART', 0, 0)
      ctx.beginPath()
      ctx.moveTo(-w * 0.32, w * 0.25)
      ctx.lineTo(w * 0.12, w * 0.25)
      ctx.lineTo(w * 0.12, w * 0.17)
      ctx.lineTo(w * 0.32, w * 0.3)
      ctx.lineTo(w * 0.12, w * 0.43)
      ctx.lineTo(w * 0.12, w * 0.35)
      ctx.lineTo(-w * 0.32, w * 0.35)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'jail': {
      // Cellule dans l'angle intérieur, « simple visite » le long des deux bords extérieurs.
      const cell = w * 0.62
      ctx.fillStyle = '#f39c12'
      ctx.fillRect(-w / 2, -d / 2, cell, cell)
      ctx.strokeRect(-w / 2, -d / 2, cell, cell)
      ctx.strokeStyle = INK
      ctx.lineWidth = w * 0.025
      for (let k = 1; k < 5; k++) {
        const x = -w / 2 + (cell * k) / 5
        ctx.beginPath()
        ctx.moveTo(x, -d / 2 + cell * 0.12)
        ctx.lineTo(x, -d / 2 + cell * 0.88)
        ctx.stroke()
      }
      ctx.fillStyle = INK
      ctx.font = `900 ${w * 0.1}px ${DISPLAY}`
      ctx.textBaseline = 'middle'
      ctx.fillText('PRISON', -w / 2 + cell / 2, -d / 2 + cell / 2)
      ctx.font = `800 ${w * 0.085}px ${SANS}`
      ctx.fillText('SIMPLE VISITE', -w / 2 + cell / 2, d / 2 - (w - cell) / 2)
      ctx.save()
      ctx.translate(w / 2 - (w - cell) / 2, -d / 2 + cell / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText('SIMPLE VISITE', 0, 0)
      ctx.restore()
      break
    }
    case 'parking':
      ctx.textBaseline = 'middle'
      ctx.rotate(-Math.PI / 4)
      ctx.font = `italic 900 ${w * 0.15}px ${DISPLAY}`
      ctx.fillText('PARC', 0, -w * 0.28)
      ctx.fillText('GRATUIT', 0, w * 0.3)
      ctx.fillStyle = '#c0392b'
      ctx.fillRect(-w * 0.22, -w * 0.08, w * 0.44, w * 0.12)
      ctx.fillRect(-w * 0.12, -w * 0.15, w * 0.22, w * 0.09)
      ctx.fillStyle = INK
      for (const x of [-w * 0.13, w * 0.13]) {
        ctx.beginPath()
        ctx.arc(x, w * 0.06, w * 0.05, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    case 'gotojail':
      ctx.textBaseline = 'middle'
      ctx.rotate(-Math.PI / 4)
      ctx.font = `italic 900 ${w * 0.15}px ${DISPLAY}`
      ctx.fillText('ALLEZ EN', 0, -w * 0.28)
      ctx.fillText('PRISON', 0, w * 0.3)
      ctx.fillStyle = '#2b6cb0'
      ctx.beginPath()
      ctx.arc(0, 0, w * 0.13, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f2c230'
      ctx.beginPath()
      ctx.arc(0, 0, w * 0.06, 0, Math.PI * 2)
      ctx.fill()
      break
  }
  ctx.restore()
}

/** Le dessus du plateau, prêt à devenir une texture. */
export function drawBoard(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = PX
  const ctx = c.getContext('2d')!
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, PX, PX)
  // Centre : un tapis vert profond, le titre sur son bandeau, les emplacements des paquets.
  const inner = (BOARD_SIZE - 2 * CORNER) * S
  const o = CORNER * S
  const g = ctx.createRadialGradient(PX / 2, PX / 2, inner * 0.1, PX / 2, PX / 2, inner * 0.75)
  g.addColorStop(0, '#16574a')
  g.addColorStop(1, CENTER)
  ctx.fillStyle = g
  ctx.fillRect(o, o, inner, inner)
  ctx.save()
  ctx.translate(PX / 2, PX / 2)
  ctx.rotate(-Math.PI / 4)
  ctx.fillStyle = '#d7262e'
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 30
  ctx.fillRect(-inner * 0.42, -inner * 0.075, inner * 0.84, inner * 0.15)
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 8
  ctx.strokeRect(-inner * 0.4, -inner * 0.06, inner * 0.8, inner * 0.12)
  ctx.fillStyle = '#ffffff'
  ctx.font = `italic 900 ${inner * 0.1}px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('MONOPOLY', 0, 4)
  ctx.font = `700 ${inner * 0.028}px ${SANS}`
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText('ÉDITION PARIS · MINDMATCH', 0, inner * 0.11)
  // Emplacements des paquets (les cartes 3D s'y posent).
  ctx.setLineDash([18, 12])
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(232,100,27,0.85)'
  ctx.strokeRect(-inner * 0.13, inner * 0.17, inner * 0.26, inner * 0.17)
  ctx.strokeStyle = 'rgba(80,150,230,0.85)'
  ctx.strokeRect(-inner * 0.13, -inner * 0.34, inner * 0.26, inner * 0.17)
  ctx.restore()
  ctx.strokeStyle = INK
  ctx.lineWidth = 6
  ctx.strokeRect(o, o, inner, inner)
  BOARD.forEach((sq, i) => drawSquare(ctx, sq, i))
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, PX - 10, PX - 10)
  return c
}

/** Recto d'une carte Chance / Caisse de communauté (pour la carte 3D qui se retourne). */
export function drawCardFace(deck: 'chance' | 'chest', text: string): HTMLCanvasElement {
  const W = 720
  const H = 440
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const color = deck === 'chance' ? '#e8641b' : '#2b6cb0'
  ctx.fillStyle = '#fbf6ea'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = color
  ctx.lineWidth = 14
  ctx.strokeRect(16, 16, W - 32, H - 32)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = `italic 900 52px ${DISPLAY}`
  ctx.fillText(deck === 'chance' ? 'CHANCE' : 'CAISSE DE COMMUNAUTÉ', W / 2, 46, W - 80)
  ctx.fillStyle = INK
  ctx.font = `700 40px ${SANS}`
  const lines = wrap(ctx, text, W - 110)
  const top = H / 2 - (lines.length * 48) / 2 + 30
  lines.forEach((l, n) => ctx.fillText(l, W / 2, top + n * 48))
  return c
}

/** Verso d'une carte (paquet sur le plateau). */
export function drawCardBack(deck: 'chance' | 'chest'): HTMLCanvasElement {
  const W = 360
  const H = 220
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = deck === 'chance' ? '#e8641b' : '#2b6cb0'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 8
  ctx.strokeRect(12, 12, W - 24, H - 24)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (deck === 'chance') {
    ctx.font = `italic 900 150px ${DISPLAY}`
    ctx.fillText('?', W / 2, H / 2 + 8)
  } else {
    ctx.save()
    ctx.translate(W / 2, H / 2 - 10)
    drawChest(ctx, 150)
    ctx.restore()
    ctx.font = `800 26px ${SANS}`
    ctx.fillText('CAISSE DE COMMUNAUTÉ', W / 2, H - 34)
  }
  return c
}
