import type { UnoCard } from '../types'

/**
 * Dessin des cartes UNO dans un canevas, sans three.js.
 *
 * Partagé par la table 3D (qui en fait des textures) et par la manette (qui en fait des images) :
 * la carte qu'on tient au téléphone est exactement celle qui atterrit sur la table de la TV. Ce
 * module n'importe pas three.js pour que le téléphone ne télécharge pas le moteur 3D.
 *
 * Le dessin reprend les codes du vrai jeu — bordure blanche, ovale blanc incliné, valeur en
 * italique grasse cerclée de noir, petits index dans les coins — pour qu'on reconnaisse une carte
 * d'un coup d'œil depuis le canapé.
 */

export const CARD_W = 1
export const CARD_H = 1.5
const PX_W = 320
const PX_H = 480

export const UNO_HEX = {
  red: '#E5322D',
  yellow: '#F7C623',
  green: '#2FA84F',
  blue: '#1F72D6',
  wild: '#15131A',
} as const

export type PlayColor = 'red' | 'yellow' | 'green' | 'blue'

const DISPLAY_FONT = '"Archivo Variable", "Archivo", "Arial Black", system-ui, sans-serif'

/** Attend la police d'affichage (sinon le premier dessin tombe sur la police système). */
export async function loadCardFont(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.load(`italic 900 120px ${DISPLAY_FONT}`),
      new Promise((res) => setTimeout(res, 1500)),
    ])
  } catch {
    // Police indisponible : on dessine avec la police de secours, la carte reste lisible.
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, stroke = '#111', strokeW = size * 0.09) {
  ctx.font = `italic 900 ${size}px ${DISPLAY_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = strokeW
  ctx.strokeStyle = stroke
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

/** Panneau « Passe » : cercle barré. */
function drawSkip(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.lineCap = 'round'
  for (const [w, c] of [[r * 0.5, '#111'], [r * 0.3, color]] as const) {
    ctx.lineWidth = w
    ctx.strokeStyle = c
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-r * 0.68, r * 0.68)
    ctx.lineTo(r * 0.68, -r * 0.68)
    ctx.stroke()
  }
  ctx.restore()
}

/** « Inversion » : deux flèches tête-bêche. */
function drawReverse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-Math.PI / 4)
  const arrow = (dir: 1 | -1) => {
    ctx.save()
    ctx.scale(dir, dir)
    ctx.beginPath()
    ctx.moveTo(-s * 0.15, s * 0.55)
    ctx.lineTo(-s * 0.15, -s * 0.05)
    ctx.lineTo(-s * 0.42, -s * 0.05)
    ctx.lineTo(s * 0.05, -s * 0.6)
    ctx.lineTo(s * 0.52, -s * 0.05)
    ctx.lineTo(s * 0.25, -s * 0.05)
    ctx.lineTo(s * 0.25, s * 0.55)
    ctx.closePath()
    ctx.restore()
  }
  for (const dir of [1, -1] as const) {
    ctx.save()
    ctx.translate(dir * s * 0.26, 0)
    arrow(dir)
    ctx.lineJoin = 'round'
    ctx.lineWidth = s * 0.1
    ctx.strokeStyle = '#111'
    ctx.stroke()
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

/** Ovale quadricolore des jokers. */
function drawWildOval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  const quads: PlayColor[] = ['red', 'blue', 'yellow', 'green']
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.5)
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  quads.forEach((c, i) => {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, Math.max(rx, ry) * 1.2, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2)
    ctx.closePath()
    ctx.fillStyle = UNO_HEX[c]
    ctx.fill()
  })
  ctx.restore()
}

function cardBody(ctx: CanvasRenderingContext2D, fill: string) {
  ctx.clearRect(0, 0, PX_W, PX_H)
  roundRect(ctx, 0, 0, PX_W, PX_H, 34)
  ctx.fillStyle = '#FBFAF7'
  ctx.fill()
  roundRect(ctx, 16, 16, PX_W - 32, PX_H - 32, 24)
  ctx.fillStyle = fill
  ctx.fill()
}

function label(value: UnoCard['value']): string {
  if (typeof value === 'number') return String(value)
  if (value === 'draw2') return '+2'
  if (value === 'wild4') return '+4'
  return ''
}

export function drawFace(card: Pick<UnoCard, 'color' | 'value'>, tint: PlayColor | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PX_W
  canvas.height = PX_H
  const ctx = canvas.getContext('2d')!
  const wild = card.color === 'wild'
  const base = wild ? UNO_HEX.wild : UNO_HEX[card.color as PlayColor]
  const ink = wild ? '#FBFAF7' : base
  cardBody(ctx, base)
  // Un joker posé garde son fond noir, mais s'encadre de la couleur annoncée : c'est ce qu'il faut
  // lire sur la défausse, sans perdre le fait que c'était un joker.
  if (wild && tint) {
    roundRect(ctx, 16, 16, PX_W - 32, PX_H - 32, 24)
    ctx.lineWidth = 26
    ctx.strokeStyle = UNO_HEX[tint]
    ctx.stroke()
  }

  const cx = PX_W / 2
  const cy = PX_H / 2

  // Ovale central incliné.
  if (wild) {
    drawWildOval(ctx, cx, cy, 104, 164)
  } else {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-0.5)
    ctx.beginPath()
    ctx.ellipse(0, 0, 112, 176, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#FBFAF7'
    ctx.fill()
    ctx.restore()
  }

  // Symbole central.
  const v = card.value
  if (v === 'skip') drawSkip(ctx, cx, cy, 64, ink)
  else if (v === 'reverse') drawReverse(ctx, cx, cy, 150, ink)
  else if (v === 'wild4') {
    // Quatre petites cartes en éventail, comme sur la vraie carte.
    const colors: PlayColor[] = ['blue', 'green', 'red', 'yellow']
    colors.forEach((c, i) => {
      ctx.save()
      ctx.translate(cx + (i - 1.5) * 34, cy + (i % 2 ? 18 : -18))
      ctx.rotate(-0.25)
      roundRect(ctx, -26, -40, 52, 80, 9)
      ctx.fillStyle = UNO_HEX[c]
      ctx.fill()
      ctx.lineWidth = 5
      ctx.strokeStyle = '#FBFAF7'
      ctx.stroke()
      ctx.restore()
    })
    outlinedText(ctx, '+4', cx, cy + 120, 70, '#FBFAF7')
  } else if (v !== 'wild') {
    outlinedText(ctx, label(v), cx, cy + 6, typeof v === 'number' ? 190 : 150, ink, '#111', 14)
    if (v === 6 || v === 9) {
      // Le soulignement qui distingue le 6 du 9.
      ctx.fillStyle = ink
      ctx.fillRect(cx - 40, cy + 92, 80, 12)
    }
  }

  // Index des coins.
  const corner = (rot: number, x: number, y: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    if (v === 'skip') drawSkip(ctx, 0, 0, 17, '#FBFAF7')
    else if (v === 'reverse') drawReverse(ctx, 0, 0, 42, '#FBFAF7')
    else if (v === 'wild') drawWildOval(ctx, 0, 0, 20, 30)
    else outlinedText(ctx, label(v), 0, 0, 58, '#FBFAF7', '#111', 7)
    ctx.restore()
  }
  corner(0, 52, 62)
  corner(Math.PI, PX_W - 52, PX_H - 62)
  return canvas
}

export function drawBack(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PX_W
  canvas.height = PX_H
  const ctx = canvas.getContext('2d')!
  cardBody(ctx, '#121015')
  ctx.save()
  ctx.translate(PX_W / 2, PX_H / 2)
  ctx.rotate(-0.5)
  ctx.beginPath()
  ctx.ellipse(0, 0, 118, 186, 0, 0, Math.PI * 2)
  ctx.fillStyle = UNO_HEX.red
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.translate(PX_W / 2, PX_H / 2)
  ctx.rotate(-0.42)
  // Ombre portée du logo.
  ctx.font = `italic 900 118px ${DISPLAY_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.fillStyle = '#111'
  ctx.fillText('UNO', 6, 10)
  ctx.lineWidth = 16
  ctx.strokeStyle = '#111'
  ctx.strokeText('UNO', 0, 0)
  ctx.fillStyle = UNO_HEX.yellow
  ctx.fillText('UNO', 0, 0)
  ctx.restore()
  return canvas
}


const imageCache = new Map<string, string>()

/** Image (data URL) d'une face de carte, mise en cache. `null` = le dos. */
export function cardImage(card: Pick<UnoCard, 'color' | 'value'> | null, tint: PlayColor | null = null): string {
  const key = card ? `${card.color}:${card.value}:${tint ?? ''}` : 'back'
  let url = imageCache.get(key)
  if (!url) {
    url = (card ? drawFace(card, tint) : drawBack()).toDataURL('image/png')
    imageCache.set(key, url)
  }
  return url
}
