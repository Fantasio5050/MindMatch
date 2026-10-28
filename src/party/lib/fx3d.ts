import * as THREE from 'three'

// ─── Animations ─────────────────────────────────────────────────────────────

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  outElastic: (t: number) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
}

interface Tween {
  start: number
  duration: number
  ease: (t: number) => number
  update: (t: number) => void
  resolve: () => void
}

/** Petit moteur d'interpolation piloté par la boucle de rendu (temps absolu, donc insensible aux
 * images sautées par le limiteur de cadence). */
export class Tweens {
  private list: Tween[] = []

  get busy() {
    return this.list.length > 0
  }

  add(duration: number, update: (t: number) => void, opts: { delay?: number; ease?: (t: number) => number } = {}): Promise<void> {
    return new Promise((resolve) => {
      this.list.push({
        start: performance.now() + (opts.delay ?? 0),
        duration: Math.max(1, duration),
        ease: opts.ease ?? ease.inOutCubic,
        update,
        resolve,
      })
    })
  }

  wait(ms: number): Promise<void> {
    return this.add(ms, () => {}, { ease: ease.linear })
  }

  tick(now: number) {
    if (this.list.length === 0) return
    const keep: Tween[] = []
    for (const tw of this.list) {
      if (now < tw.start) {
        keep.push(tw)
        continue
      }
      const t = Math.min(1, (now - tw.start) / tw.duration)
      tw.update(tw.ease(t))
      if (t < 1) keep.push(tw)
      else tw.resolve()
    }
    this.list = keep
  }

  /** Termine tout immédiatement (démontage). */
  flush() {
    for (const tw of this.list) {
      tw.update(1)
      tw.resolve()
    }
    this.list = []
  }
}

// ─── Particules ─────────────────────────────────────────────────────────────

const PARTICLE_VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  varying float vAlpha;
  varying vec3 vTint;
  uniform float pixelScale;
  void main() {
    vAlpha = alpha;
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const PARTICLE_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vTint * (0.6 + glow), vAlpha * glow);
  }
`

export interface EmitOptions {
  count: number
  color: THREE.ColorRepresentation | THREE.ColorRepresentation[]
  speed?: number
  /** Dispersion horizontale (0 = colonne, 1 = sphère). */
  spread?: number
  /** Poussée verticale de base. */
  up?: number
  gravity?: number
  size?: number
  life?: number
}

/** Système de particules unique (un seul appel de dessin), en mélange additif. */
export class Particles {
  readonly points: THREE.Points
  private pos: Float32Array
  private vel: Float32Array
  private tint: Float32Array
  private size: Float32Array
  private alpha: Float32Array
  private life: Float32Array
  private maxLife: Float32Array
  private baseSize: Float32Array
  private gravity: Float32Array
  private cursor = 0
  private alive = 0

  private capacity: number

  constructor(capacity = 2400) {
    this.capacity = capacity
    const geo = new THREE.BufferGeometry()
    this.pos = new Float32Array(capacity * 3)
    this.vel = new Float32Array(capacity * 3)
    this.tint = new Float32Array(capacity * 3)
    this.size = new Float32Array(capacity)
    this.alpha = new Float32Array(capacity)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)
    this.baseSize = new Float32Array(capacity)
    this.gravity = new Float32Array(capacity)
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000)
    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      uniforms: { pixelScale: { value: 300 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 10
  }

  setPixelScale(height: number) {
    ;(this.points.material as THREE.ShaderMaterial).uniforms.pixelScale.value = height * 0.55
  }

  get active() {
    return this.alive > 0
  }

  emit(origin: THREE.Vector3, o: EmitOptions) {
    const colors = (Array.isArray(o.color) ? o.color : [o.color]).map((c) => new THREE.Color(c))
    const speed = o.speed ?? 4
    const spread = o.spread ?? 1
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.capacity
      const theta = Math.random() * Math.PI * 2
      const r = Math.random()
      const s = speed * (0.35 + Math.random() * 0.65)
      this.pos[i * 3] = origin.x
      this.pos[i * 3 + 1] = origin.y
      this.pos[i * 3 + 2] = origin.z
      this.vel[i * 3] = Math.cos(theta) * r * s * spread
      this.vel[i * 3 + 1] = (o.up ?? 3) * (0.5 + Math.random() * 0.8) + (1 - spread) * s
      this.vel[i * 3 + 2] = Math.sin(theta) * r * s * spread
      const c = colors[n % colors.length]
      this.tint[i * 3] = c.r
      this.tint[i * 3 + 1] = c.g
      this.tint[i * 3 + 2] = c.b
      this.maxLife[i] = (o.life ?? 1.2) * (0.6 + Math.random() * 0.6)
      this.life[i] = this.maxLife[i]
      this.baseSize[i] = (o.size ?? 0.45) * (0.6 + Math.random() * 0.8)
      this.gravity[i] = o.gravity ?? 7
    }
    this.alive = this.capacity
  }

  tick(dt: number) {
    if (this.alive === 0) return
    let alive = 0
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0
          this.size[i] = 0
        }
        continue
      }
      alive++
      this.life[i] -= dt
      this.vel[i * 3 + 1] -= this.gravity[i] * dt
      // Légère traînée de l'air.
      this.vel[i * 3] *= 1 - 0.9 * dt
      this.vel[i * 3 + 2] *= 1 - 0.9 * dt
      this.pos[i * 3] += this.vel[i * 3] * dt
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt
      // Rebond mou sur la table.
      if (this.pos[i * 3 + 1] < 0.05) {
        this.pos[i * 3 + 1] = 0.05
        this.vel[i * 3 + 1] *= -0.35
      }
      const k = Math.max(0, this.life[i] / this.maxLife[i])
      this.alpha[i] = Math.min(1, k * 1.6)
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * k)
    }
    this.alive = alive
    const geo = this.points.geometry
    geo.attributes.position.needsUpdate = true
    geo.attributes.alpha.needsUpdate = true
    geo.attributes.size.needsUpdate = true
    geo.attributes.tint.needsUpdate = true
  }

  dispose() {
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
  }
}

// ─── Textes et pastilles ────────────────────────────────────────────────────

const DISPLAY_FONT = '"Archivo Variable", "Archivo", "Arial Black", system-ui, sans-serif'
const SANS_FONT = '"Inter Tight Variable", "Inter Tight", system-ui, sans-serif'

/** Texte « plateau télé » en sprite : italique très grasse, contour noir, halo de couleur. */
export function makeTextSprite(text: string, color: string, height = 1.6): THREE.Sprite {
  const pad = 40
  const fontPx = 150
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `italic 900 ${fontPx}px ${DISPLAY_FONT}`
  const w = Math.ceil(measure.measureText(text).width) + pad * 2
  const h = fontPx + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.font = `italic 900 ${fontPx}px ${DISPLAY_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = 38
  ctx.lineWidth = 22
  ctx.strokeStyle = '#0d0b12'
  ctx.strokeText(text, w / 2, h / 2)
  ctx.shadowBlur = 0
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2)
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.strokeText(text, w / 2, h / 2 - 3)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sprite.scale.set((height * w) / h, height, 1)
  sprite.renderOrder = 20
  return sprite
}

export function disposeSprite(sprite: THREE.Sprite) {
  sprite.material.map?.dispose()
  sprite.material.dispose()
}

/** `CanvasRenderingContext2D.roundRect` manque sur des navigateurs de TV encore en service. */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase()
}

/** Avatar rond (photo si disponible, sinon initiales sur la couleur du joueur). */
export function makeAvatarTexture(name: string, color: string, photoUrl: string | null, onUpdate: () => void): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const ring = () => {
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
    ctx.lineWidth = 10
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.font = `800 ${size * 0.4}px ${SANS_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(initials(name), size / 2, size / 2 + 4)
  ring()
  if (photoUrl) {
    const img = new Image()
    img.onload = () => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
      ctx.clip()
      const s = Math.max(size / img.width, size / img.height)
      ctx.drawImage(img, (size - img.width * s) / 2, (size - img.height * s) / 2, img.width * s, img.height * s)
      ctx.restore()
      ring()
      tex.needsUpdate = true
      onUpdate()
    }
    img.src = photoUrl
  }
  return tex
}

/** Étiquette de siège : pseudo + nombre de cartes (+ badge UNO / à toi). Redessinée sur place. */
export class SeatLabel {
  readonly sprite: THREE.Sprite
  private canvas: HTMLCanvasElement
  private tex: THREE.CanvasTexture
  private last = ''

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 640
    this.canvas.height = 160
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false }))
    this.sprite.scale.set(3.2, 0.8, 1)
    this.sprite.renderOrder = 15
  }

  draw(name: string, count: number, opts: { active: boolean; uno: boolean; exposed: boolean }) {
    const key = `${name}|${count}|${opts.active}|${opts.uno}|${opts.exposed}`
    if (key === this.last) return
    this.last = key
    const ctx = this.canvas.getContext('2d')!
    const W = this.canvas.width
    const H = this.canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.font = `700 64px ${SANS_FONT}`
    const nameW = Math.min(360, ctx.measureText(name).width)
    const badge = opts.uno ? 'UNO' : opts.exposed ? '!' : String(count)
    ctx.font = `italic 900 70px ${DISPLAY_FONT}`
    const badgeW = Math.max(96, ctx.measureText(badge).width + 44)
    const total = nameW + 36 + badgeW + 28
    const x0 = (W - total) / 2
    // Pastille sombre.
    roundRectPath(ctx, x0, 20, total, 120, 60)
    ctx.fillStyle = opts.active ? 'rgba(255,61,127,0.92)' : 'rgba(18,16,24,0.86)'
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = opts.active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)'
    ctx.stroke()
    ctx.font = `700 64px ${SANS_FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#F2EFE9'
    ctx.fillText(name, x0 + 32, 82, 360)
    // Badge du nombre de cartes.
    const bx = x0 + 32 + nameW + 18
    roundRectPath(ctx, bx, 36, badgeW, 88, 44)
    ctx.fillStyle = opts.uno ? '#F7C623' : opts.exposed ? '#E5322D' : '#F2EFE9'
    ctx.fill()
    ctx.font = `italic 900 70px ${DISPLAY_FONT}`
    ctx.textAlign = 'center'
    ctx.fillStyle = opts.exposed ? '#fff' : '#121015'
    ctx.fillText(badge, bx + badgeW / 2, 84)
    this.tex.needsUpdate = true
  }

  dispose() {
    this.tex.dispose()
    this.sprite.material.dispose()
  }
}

/** Texture de halo radial (anneaux lumineux, sol, projecteur). */
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)'): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
