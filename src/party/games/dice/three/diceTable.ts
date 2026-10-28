import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createManagedRenderer, disposeScene, makeFrameGate, type ManagedRenderer } from '../../../lib/threePerf'
import { disposeSprite, ease, makeAvatarTexture, makeGlowTexture, makeTextSprite, Particles, SeatLabel, Tweens } from '../../../lib/fx3d'
import { faceRotation, planRoll, poseAtTime, seededRandom, type SimResult } from '../../../lib/diceSim'
import { DieSkin, makeDieGeometry } from '../../../lib/dieArt'
import { sfx } from '../../../lib/sfx'

/**
 * Le Lancer de dés en 3D, vu par la TV.
 *
 * Un bac à dés en noyer garni de feutrine, les joueurs autour, leur verre devant eux. À chaque
 * lancer : le dé quitte sa place, file vers le joueur, se secoue dans sa main invisible, puis part
 * rouler pour de vrai (simulation physique, `diceSim.ts`) — chaque choc claque sur le bois ou
 * s'étouffe dans la feutrine. Une fois posé, la caméra plonge sur la face, les points s'allument à
 * la couleur du joueur, et autant de gorgées que le dé l'indique volent jusqu'à son verre.
 *
 * Comme la table d'UNO, ce module ignore React : il reçoit des instantanés (`sync`) et déduit les
 * animations du numéro de lancer. Les lancers arrivés pendant une animation attendent leur tour.
 */

export interface DiceMember {
  id: string
  pseudo: string
  color: string
  photoUrl: string | null
}

export interface DiceTableState {
  phase: 'intro' | 'turn' | 'ended'
  order: string[]
  currentId: string | null
  lastRoll: { n: number; memberId: string; value: number; seed: number } | null
  totalSips: Record<string, number>
}

export type DiceTableEvent =
  | { type: 'rolling'; n: number; memberId: string }
  | { type: 'landed'; n: number; memberId: string; value: number }
  | { type: 'idle' }

// ─── Gabarit (unités : 1 ≈ 1,5 cm) ──────────────────────────────────────────

const DIE = 1.5
const TRAY_HX = 5.7
const TRAY_HZ = 3.55
const TRAY_RADIUS = 0.55
const WALL = 0.6
const WALL_H = 0.95
const SEAT_RX = 8.9
const SEAT_RZ = 5.9
// Assez de recul pour laisser au bandeau du haut (tour, verdict, compteurs) une bande libre.
const CAMERA_HOME = new THREE.Vector3(0, 16.2, 13.4)
const CAMERA_TARGET = new THREE.Vector3(0, 0, -0.2)
const AMBER = '#f5a524'

interface Seat {
  id: string
  pos: THREE.Vector3
  avatar: THREE.Sprite
  label: SeatLabel
  glass: THREE.Group
  liquid: THREE.Mesh
  member: DiceMember
  shownSips: number
  wobble: number
}

interface Playback {
  sim: SimResult
  start: number
  impactIndex: number
  resolve: () => void
}

function roundedRect(hx: number, hz: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(-hx + r, -hz)
  s.lineTo(hx - r, -hz)
  s.quadraticCurveTo(hx, -hz, hx, -hz + r)
  s.lineTo(hx, hz - r)
  s.quadraticCurveTo(hx, hz, hx - r, hz)
  s.lineTo(-hx + r, hz)
  s.quadraticCurveTo(-hx, hz, -hx, hz - r)
  s.lineTo(-hx, -hz + r)
  s.quadraticCurveTo(-hx, -hz, -hx + r, -hz)
  return s
}

function roundedPath(hx: number, hz: number, r: number): THREE.Path {
  const p = new THREE.Path()
  p.moveTo(-hx + r, -hz)
  p.lineTo(hx - r, -hz)
  p.quadraticCurveTo(hx, -hz, hx, -hz + r)
  p.lineTo(hx, hz - r)
  p.quadraticCurveTo(hx, hz, hx - r, hz)
  p.lineTo(-hx + r, hz)
  p.quadraticCurveTo(-hx, hz, -hx, hz - r)
  p.lineTo(-hx, -hz + r)
  p.quadraticCurveTo(-hx, -hz, -hx + r, -hz)
  return p
}

const _wobble = new THREE.Euler()

/** Pose du dé secoué dans la main, de t = 0 à 1. À t = 1 il est immobile, prêt au lâcher : c'est
 * de cette pose exacte que part la simulation. */
function shakePose(t: number, origin: THREE.Vector3, pos: THREE.Vector3, quat: THREE.Quaternion) {
  const k = t >= 1 ? 0 : Math.sin(t * Math.PI)
  pos.set(origin.x + Math.sin(t * 60) * 0.12 * k, origin.y + Math.abs(Math.sin(t * 47)) * 0.18 * k, origin.z + Math.cos(t * 53) * 0.1 * k)
  quat.setFromEuler(_wobble.set(Math.sin(t * 31) * 0.6 * k, t * 6, Math.cos(t * 37) * 0.6 * k))
}

export class DiceTable {
  private managed: ManagedRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private tweens = new Tweens()
  private particles = new Particles(2600)
  private skin: DieSkin
  /** Le solide (position, orientation simulées)… */
  private die: THREE.Group
  /** …et son habillage, tourné pour que la bonne face sorte. */
  private dieMesh: THREE.Mesh
  private dieShadow: THREE.Mesh
  private seats = new Map<string, Seat>()
  private halo: THREE.Mesh
  private seatLight: THREE.PointLight
  private glassGeo = new THREE.CylinderGeometry(0.34, 0.27, 0.78, 28, 1, true)
  private liquidGeo = new THREE.CylinderGeometry(0.3, 0.25, 0.5, 24)
  private glassMat: THREE.MeshPhysicalMaterial
  private liquidMat: THREE.MeshStandardMaterial
  private state: DiceTableState | null = null
  private lastN = 0
  private queue: NonNullable<DiceTableState['lastRoll']>[] = []
  private running = false
  private playback: Playback | null = null
  private hover = true
  private glowValue: number | null = null
  private glowColor = new THREE.Color(AMBER)
  private glow = 0
  private targetGlow = 0
  private shake = 0
  private cameraGoal = { pos: CAMERA_HOME.clone(), target: CAMERA_TARGET.clone() }
  private cameraTarget = CAMERA_TARGET.clone()
  private focusId: string | null = null
  private haloPos = new THREE.Vector3(0, 0, SEAT_RZ)
  private celebrate: number | null = null
  private orbit = 0
  private raf = 0
  private disposed = false
  private lastFrame = performance.now()
  private shouldRender = makeFrameGate()
  private resizeObserver: ResizeObserver
  private container: HTMLElement
  private onEvent: (e: DiceTableEvent) => void
  private texts: THREE.Sprite[] = []
  /** Une gorgée en vol : une goutte ambrée au cœur clair (pas de mélange additif, qui virait au
   * vert sur la feutrine). */
  private sipTexture = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, '#fff7d6')
    g.addColorStop(0.3, '#ffc24a')
    g.addColorStop(0.62, 'rgba(245,165,36,0.55)')
    g.addColorStop(1, 'rgba(245,165,36,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()

  static async create(container: HTMLElement, onEvent: (e: DiceTableEvent) => void): Promise<DiceTable> {
    await Promise.all([
      document.fonts?.load('italic 900 100px "Archivo Variable"').catch(() => null),
      document.fonts?.load('700 60px "Inter Tight Variable"').catch(() => null),
    ])
    return new DiceTable(container, onEvent)
  }

  private constructor(container: HTMLElement, onEvent: (e: DiceTableEvent) => void) {
    this.container = container
    this.onEvent = onEvent
    this.managed = createManagedRenderer(container)
    const renderer = this.managed.renderer
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

    this.camera = new THREE.PerspectiveCamera(40, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 200)
    this.camera.position.copy(CAMERA_HOME)
    this.camera.lookAt(CAMERA_TARGET)

    const scene = this.scene
    scene.background = new THREE.Color(0x0a0709)
    scene.fog = new THREE.Fog(0x0a0709, 24, 52)
    // Reflets : une pièce virtuelle pour que le vernis du dé, le laiton et les verres brillent.
    // Optionnel — un GPU de TV qui ne sait pas faire de rendu flottant s'en passe.
    try {
      const pmrem = new THREE.PMREMGenerator(renderer)
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      scene.environmentIntensity = 0.35
      pmrem.dispose()
    } catch {
      scene.environment = null
    }

    // ── Lumières : un plafonnier de tripot au-dessus du bac, le reste dans la pénombre.
    scene.add(new THREE.HemisphereLight(0xffe6c7, 0x140a0c, 0.45))
    const key = new THREE.SpotLight(0xfff0d8, 520, 40, 0.62, 0.55, 1.6)
    key.position.set(-2.5, 17, 5)
    key.target.position.set(0, 0, 0)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 6
    key.shadow.camera.far = 32
    key.shadow.bias = -0.0006
    key.shadow.radius = 4
    scene.add(key, key.target)
    const fill = new THREE.DirectionalLight(0x9fb4ff, 0.35)
    fill.position.set(6, 8, -6)
    scene.add(fill)
    this.seatLight = new THREE.PointLight(0xff3d7f, 0, 10, 1.7)
    scene.add(this.seatLight)

    this.buildTable(anisotropy)

    // ── Le dé.
    this.skin = new DieSkin(undefined, anisotropy)
    this.die = new THREE.Group()
    this.dieMesh = new THREE.Mesh(makeDieGeometry(DIE), this.skin.materials)
    this.dieMesh.castShadow = true
    this.die.add(this.dieMesh)
    this.die.position.set(0, 2.2, 0)
    scene.add(this.die)
    // Ombre de contact douce, toujours au sol sous le dé : elle ancre le dé même en plein vol.
    this.dieShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(DIE * 2.2, DIE * 2.2),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }),
    )
    this.dieShadow.rotation.x = -Math.PI / 2
    this.dieShadow.position.y = 0.03
    scene.add(this.dieShadow)

    // ── Halo sous le joueur dont c'est le tour.
    this.halo = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 48),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: 0xff3d7f, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.halo.rotation.x = -Math.PI / 2
    this.halo.position.y = 0.025
    this.halo.visible = false
    scene.add(this.halo)

    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      clearcoat: 1,
      depthWrite: false,
    })
    this.liquidMat = new THREE.MeshStandardMaterial({ color: AMBER, emissive: new THREE.Color('#7a3d00'), emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.92 })

    scene.add(this.particles.points)

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.loop()
  }

  // ─── Décor ────────────────────────────────────────────────────────────────

  private buildTable(anisotropy: number) {
    const scene = this.scene
    const wood = this.woodTexture(anisotropy)

    // Plateau de la table : noyer sombre, éclairé en flaque par le plafonnier.
    const tableTex = wood.clone()
    tableTex.repeat.set(3, 3)
    tableTex.needsUpdate = true
    const table = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ map: tableTex, color: 0x6b4a3a, roughness: 0.55 }))
    table.rotation.x = -Math.PI / 2
    table.position.y = -0.01
    table.receiveShadow = true
    scene.add(table)

    // Fond du bac : feutrine.
    const floorGeo = new THREE.ShapeGeometry(roundedRect(TRAY_HX, TRAY_HZ, TRAY_RADIUS), 12)
    const uv = floorGeo.getAttribute('uv')
    const pos = floorGeo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * TRAY_HX) + 0.5, pos.getY(i) / (2 * TRAY_HZ) + 0.5)
    const felt = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: this.feltTexture(anisotropy), roughness: 0.96 }))
    felt.rotation.x = -Math.PI / 2
    felt.position.y = 0.005
    felt.receiveShadow = true
    scene.add(felt)

    // Parois en noyer, chanfreinées.
    const ring = roundedRect(TRAY_HX + WALL, TRAY_HZ + WALL, TRAY_RADIUS + WALL)
    ring.holes.push(roundedPath(TRAY_HX, TRAY_HZ, TRAY_RADIUS))
    const wallGeo = new THREE.ExtrudeGeometry(ring, { depth: WALL_H, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 12 })
    const wallTex = wood.clone()
    wallTex.repeat.set(0.18, 0.18)
    wallTex.needsUpdate = true
    const walls = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: wallTex, color: 0xb98865, roughness: 0.42, metalness: 0.05 }))
    walls.rotation.x = -Math.PI / 2
    walls.castShadow = true
    walls.receiveShadow = true
    scene.add(walls)

    // Liseré de laiton sur le haut des parois.
    const trimShape = roundedRect(TRAY_HX + WALL * 0.62, TRAY_HZ + WALL * 0.62, TRAY_RADIUS + WALL * 0.62)
    trimShape.holes.push(roundedPath(TRAY_HX + WALL * 0.38, TRAY_HZ + WALL * 0.38, TRAY_RADIUS + WALL * 0.38))
    const trim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(trimShape, { depth: 0.05, bevelEnabled: false, curveSegments: 12 }),
      new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.28 }),
    )
    trim.rotation.x = -Math.PI / 2
    trim.position.y = WALL_H + 0.08
    scene.add(trim)

    // Lueur chaude sous le bac : il flotte dans la lumière.
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 26),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture('rgba(255,190,120,0.16)', 'rgba(255,190,120,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    pool.rotation.x = -Math.PI / 2
    pool.position.y = 0.002
    scene.add(pool)
  }

  private woodTexture(anisotropy: number): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#5a3524'
    ctx.fillRect(0, 0, 512, 512)
    const r = seededRandom(7)
    // Veines : des courbes sombres et claires qui ondulent dans le fil du bois.
    for (let i = 0; i < 140; i++) {
      const y = r() * 512
      const amp = 2 + r() * 7
      const freq = 0.004 + r() * 0.012
      const phase = r() * 6
      ctx.beginPath()
      for (let x = 0; x <= 512; x += 8) {
        const yy = y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.3
        if (x === 0) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      const light = r() > 0.6
      ctx.strokeStyle = light ? `rgba(196,140,98,${0.08 + r() * 0.12})` : `rgba(28,14,8,${0.12 + r() * 0.25})`
      ctx.lineWidth = 0.6 + r() * 2.4
      ctx.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = anisotropy
    return t
  }

  private feltTexture(anisotropy: number): THREE.CanvasTexture {
    const w = 1024
    const h = Math.round((w * TRAY_HZ) / TRAY_HX)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.62)
    g.addColorStop(0, '#1d6b4a')
    g.addColorStop(0.6, '#13523a')
    g.addColorStop(1, '#0a3324')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const img = ctx.getImageData(0, 0, w, h)
    const r = seededRandom(3)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 16
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
    // Marquage imprimé dans la feutrine, comme sur un tapis de jeu.
    ctx.strokeStyle = 'rgba(245,215,150,0.16)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, w * 0.2, h * 0.26, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(w / 2, h / 2, w * 0.215, h * 0.285, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(245,215,150,0.16)'
    ctx.font = 'italic 900 64px "Archivo Variable", "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('LANCER DE DÉS', w / 2, h / 2 - 8)
    ctx.font = '600 26px "Inter Tight Variable", system-ui, sans-serif'
    ctx.fillText('TU FAIS • TU BOIS', w / 2, h / 2 + 46)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = anisotropy
    return t
  }

  // ─── Sièges ───────────────────────────────────────────────────────────────

  private layoutSeats(order: string[], members: DiceMember[]) {
    const ids = order.filter((id) => members.some((m) => m.id === id))
    for (const [id, seat] of this.seats) {
      if (!ids.includes(id)) {
        this.scene.remove(seat.avatar, seat.label.sprite, seat.glass)
        seat.label.dispose()
        seat.avatar.material.map?.dispose()
        seat.avatar.material.dispose()
        this.seats.delete(id)
      }
    }
    ids.forEach((id, i) => {
      const member = members.find((m) => m.id === id)!
      // Premier joueur en bas (face à la TV), puis dans le sens des aiguilles d'une montre.
      const angle = Math.PI / 2 + (i / ids.length) * Math.PI * 2
      const pos = new THREE.Vector3(Math.cos(angle) * SEAT_RX, 0, Math.sin(angle) * SEAT_RZ)
      let seat = this.seats.get(id)
      if (!seat) {
        const avatar = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: makeAvatarTexture(member.pseudo, member.color, member.photoUrl, () => {}), transparent: true, depthTest: false }),
        )
        avatar.renderOrder = 14
        const label = new SeatLabel()
        const glass = new THREE.Group()
        const shell = new THREE.Mesh(this.glassGeo, this.glassMat)
        shell.position.y = 0.39
        shell.renderOrder = 6
        const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 24), this.glassMat)
        bottom.position.y = 0.06
        const liquid = new THREE.Mesh(this.liquidGeo, this.liquidMat)
        liquid.position.y = 0.37
        glass.add(liquid, bottom, shell)
        glass.traverse((o) => (o.castShadow = true))
        this.scene.add(avatar, label.sprite, glass)
        seat = { id, pos, avatar, label, glass, liquid, member, shownSips: this.state?.totalSips[id] ?? 0, wobble: 0 }
        this.seats.set(id, seat)
      }
      seat.pos = pos
      seat.member = member
      const near = (Math.sin(angle) + 1) / 2
      // Le verre devant le joueur, côté bac ; l'avatar derrière, plus haut quand il est près de la
      // caméra pour ne pas masquer la table.
      const inward = pos.clone().multiplyScalar(0.86)
      seat.glass.position.set(inward.x, 0, inward.z)
      seat.avatar.position.set(pos.x, 2.15 + near * 0.2, pos.z - near * 0.5)
      seat.avatar.scale.setScalar(1.15)
      seat.label.sprite.position.set(pos.x, 1.3 + near * 0.2, pos.z - near * 0.5 + 0.2)
      seat.label.sprite.scale.set(2.6, 0.65, 1)
    })
    this.refreshLabels()
  }

  private refreshLabels() {
    const s = this.state
    if (!s) return
    for (const seat of this.seats.values()) {
      seat.label.draw(seat.member.pseudo, seat.shownSips, { active: this.focusId === seat.id })
    }
  }

  /** Point de départ d'un lancer : contre la paroi du bac, du côté du joueur. */
  private throwOrigin(seat: Seat | undefined): THREE.Vector3 {
    const dir = seat ? new THREE.Vector3(seat.pos.x / SEAT_RX, 0, seat.pos.z / SEAT_RZ).normalize() : new THREE.Vector3(0, 0, 1)
    return new THREE.Vector3(dir.x * (TRAY_HX - 1.1), 2.6, dir.z * (TRAY_HZ - 0.9))
  }

  // ─── Synchronisation ──────────────────────────────────────────────────────

  sync(next: DiceTableState, members: DiceMember[]) {
    const first = this.state === null
    this.state = next
    this.layoutSeats(next.order, members)

    if (first) {
      // TV branchée en cours de partie : le dernier dé est posé au centre, sans rejouer d'histoire.
      if (next.lastRoll) {
        this.lastN = next.lastRoll.n
        this.hover = false
        this.die.position.set(0, DIE / 2, 0)
        this.die.quaternion.identity()
        this.dieMesh.quaternion.copy(faceRotation(next.lastRoll.value, new THREE.Vector3(0, 1, 0)))
      }
      for (const seat of this.seats.values()) seat.shownSips = next.totalSips[seat.id] ?? 0
    }

    const roll = next.lastRoll
    if (roll && roll.n > this.lastN) {
      this.lastN = roll.n
      this.queue.push(roll)
      void this.drain()
    }
    if (!this.running) {
      this.focusId = next.phase === 'turn' ? next.currentId : null
      // Hors animation, les compteurs suivent l'état (rattrapage d'un lancer sauté, reconnexion).
      for (const seat of this.seats.values()) seat.shownSips = next.totalSips[seat.id] ?? seat.shownSips
    }
    if (next.phase === 'ended' && !this.running) this.startCelebration()
    this.refreshLabels()
  }

  private async drain() {
    if (this.running) return
    this.running = true
    while (this.queue.length > 0) {
      const roll = this.queue.shift()!
      try {
        await this.playRoll(roll, this.queue.length > 0)
      } catch (error) {
        console.error(error)
      }
      if (this.disposed) return
    }
    this.running = false
    const s = this.state
    if (s) {
      this.focusId = s.phase === 'turn' ? s.currentId : null
      for (const seat of this.seats.values()) seat.shownSips = s.totalSips[seat.id] ?? seat.shownSips
      this.refreshLabels()
      if (s.phase === 'ended') this.startCelebration()
    }
    this.onEvent({ type: 'idle' })
  }

  // ─── Un lancer ────────────────────────────────────────────────────────────

  private async playRoll(roll: NonNullable<DiceTableState['lastRoll']>, hurry: boolean) {
    const seat = this.seats.get(roll.memberId)
    const color = new THREE.Color(seat?.member.color ?? AMBER)
    this.focusId = roll.memberId
    this.refreshLabels()
    this.onEvent({ type: 'rolling', n: roll.n, memberId: roll.memberId })
    this.targetGlow = 0
    this.clearTexts()
    this.hover = false
    this.cameraGoal.pos.copy(CAMERA_HOME)
    this.cameraGoal.target.copy(CAMERA_TARGET)

    // 1. Le lancer est calculé d'avance, depuis la pose exacte où le dé quittera la main : on
    // cherche un roulé qui tombe de lui-même sur la valeur du serveur (voir `planRoll`).
    const origin = this.throwOrigin(seat)
    const releasePos = new THREE.Vector3()
    const releaseQuat = new THREE.Quaternion()
    shakePose(1, origin, releasePos, releaseQuat)
    const toCenter = new THREE.Vector3(-origin.x, 0, -origin.z).normalize()
    const side = new THREE.Vector3(-toCenter.z, 0, toCenter.x)
    const plan = planRoll(
      [roll.value],
      [this.dieMesh.quaternion.clone()],
      (attempt) => {
        const r = seededRandom(roll.seed + attempt * 7919)
        return [
          {
            pos: releasePos.clone(),
            vel: toCenter.clone().multiplyScalar(8.5 + r() * 3).addScaledVector(side, (r() - 0.5) * 4).setY(3 + r() * 2.5),
            spin: new THREE.Vector3((r() - 0.5) * 36, (r() - 0.5) * 26, (r() - 0.5) * 36),
            quat: releaseQuat.clone(),
          },
        ]
      },
      { halfX: TRAY_HX, halfZ: TRAY_HZ },
      DIE,
    )

    // 2. Le dé rejoint la main du joueur.
    const fromPos = this.die.position.clone()
    const fromQuat = this.die.quaternion.clone()
    const lift = new THREE.Vector3()
    sfx.whoosh(0, 0.4)
    await this.tweens.add(hurry ? 280 : 480, (t) => {
      lift.lerpVectors(fromPos, origin, t)
      lift.y += Math.sin(t * Math.PI) * 1.6
      this.die.position.copy(lift)
      this.die.quaternion.slerpQuaternions(fromQuat, new THREE.Quaternion(), t)
    }, { ease: ease.inOutCubic })

    // 3. Secoué dans la main, puis lâché.
    const shakeMs = hurry ? 300 : 620
    sfx.rattle(shakeMs / 1000)
    await this.tweens.add(shakeMs, (t) => shakePose(t, origin, this.die.position, this.die.quaternion), { ease: ease.linear })
    // Retouche de l'habillage seulement si aucun essai n'est tombé juste — le dé tourne alors
    // trop vite pour qu'on voie ses faces changer.
    if (plan.remaps[0]) this.dieMesh.quaternion.copy(plan.remaps[0])
    const sim = plan.sim
    sfx.whoosh(0, 0.25)
    await new Promise<void>((resolve) => {
      this.playback = { sim, start: performance.now(), impactIndex: 0, resolve }
    })

    // 4. Posé : la face s'allume, la caméra plonge, la salle réagit.
    const value = roll.value
    this.onEvent({ type: 'landed', n: roll.n, memberId: roll.memberId, value })
    this.glowValue = value
    this.glowColor.copy(color)
    this.targetGlow = 0.9
    const top = this.die.position.clone().setY(DIE)
    this.particles.emit(top, { count: 60 + value * 25, color: [color, '#ffffff', AMBER], speed: 5 + value, up: 3 + value * 0.6, size: 0.42, life: 1.2 })
    this.shockwave(this.die.position, color)
    if (!hurry) {
      // Plongée presque à la verticale : la face du dessus se lit en entier.
      this.cameraGoal.pos.copy(this.die.position).add(new THREE.Vector3(0, 8.6, 3.4))
      this.cameraGoal.target.copy(this.die.position)
    }
    if (value === 6) {
      sfx.fanfare()
      this.shake = 0.45
      this.popText('SIX !', '#ffd23f', top.clone().setY(3.1), 1.8, 1700)
      this.fireworks(this.die.position, 3)
    } else {
      sfx.chime()
      this.popText(String(value), seat?.member.color ?? AMBER, top.clone().setY(3.0), 2.1, 1500)
      if (value === 1) sfx.buzzer(0.25)
    }
    await this.tweens.wait(hurry ? 450 : 1300)

    // 5. Retour plan large, et les gorgées volent jusqu'au verre du joueur, glouglou à l'arrivée.
    this.cameraGoal.pos.copy(CAMERA_HOME)
    this.cameraGoal.target.copy(CAMERA_TARGET)
    this.targetGlow = 0.35
    if (seat) await this.flySips(seat, value, hurry)
    await this.tweens.wait(hurry ? 150 : 500)
  }

  private async flySips(seat: Seat, count: number, hurry: boolean) {
    const from = this.die.position.clone().setY(DIE + 0.3)
    const to = seat.glass.position.clone().setY(0.9)
    const step = hurry ? 90 : 230
    const flights: Promise<void>[] = []
    for (let i = 0; i < count; i++) {
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sipTexture, transparent: true, depthWrite: false, depthTest: false }))
      orb.scale.setScalar(1.3)
      orb.renderOrder = 12
      orb.visible = false
      this.scene.add(orb)
      const mid = from.clone().lerp(to, 0.5).setY(4 + Math.random() * 1.2)
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
      flights.push(
        this.tweens
          .add(hurry ? 420 : 620, (t) => {
            orb.visible = true
            curve.getPoint(t, orb.position)
            orb.scale.setScalar(1.3 - t * 0.5)
          }, { delay: 250 + i * step, ease: ease.inOutCubic })
          .then(() => {
            this.scene.remove(orb)
            orb.material.dispose()
            seat.shownSips += 1
            seat.wobble = 1
            this.refreshLabels()
            sfx.gulp(1)
            this.particles.emit(to, { count: 14, color: [AMBER, '#fff1c1'], speed: 2.5, up: 2.5, size: 0.28, life: 0.6 })
          }),
      )
    }
    await Promise.all(flights)
  }

  // ─── Effets ───────────────────────────────────────────────────────────────

  private popText(text: string, color: string, at: THREE.Vector3, height: number, hold: number) {
    const sprite = makeTextSprite(text, color, height)
    sprite.position.copy(at)
    sprite.scale.multiplyScalar(0.01)
    const full = sprite.scale.clone().multiplyScalar(100)
    this.scene.add(sprite)
    this.texts.push(sprite)
    void this.tweens
      .add(420, (t) => sprite.scale.copy(full).multiplyScalar(Math.max(0.01, t)), { ease: ease.outBack })
      .then(() => this.tweens.add(380, (t) => {
        sprite.material.opacity = 1 - t
        sprite.position.y = at.y + t * 0.6
      }, { delay: hold, ease: ease.linear }))
      .then(() => this.removeText(sprite))
  }

  private removeText(sprite: THREE.Sprite) {
    if (!this.texts.includes(sprite)) return
    this.texts = this.texts.filter((s) => s !== sprite)
    this.scene.remove(sprite)
    disposeSprite(sprite)
  }

  private clearTexts() {
    for (const s of [...this.texts]) this.removeText(s)
  }

  private shockwave(at: THREE.Vector3, color: THREE.Color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 64), mat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(at.x, 0.04, at.z)
    this.scene.add(ring)
    void this.tweens.add(900, (t) => {
      ring.scale.setScalar(1 + t * 4.5)
      mat.opacity = 0.9 * (1 - t)
    }, { ease: ease.outCubic }).then(() => {
      this.scene.remove(ring)
      ring.geometry.dispose()
      mat.dispose()
    })
  }

  private fireworks(around: THREE.Vector3, bursts: number) {
    const palette = ['#ff3d7f', '#ffd23f', '#3ddc97', '#4cc9f0', '#ffffff']
    for (let i = 0; i < bursts; i++) {
      window.setTimeout(() => {
        if (this.disposed) return
        const at = around.clone().add(new THREE.Vector3((Math.random() - 0.5) * 7, 3 + Math.random() * 2.5, (Math.random() - 0.5) * 4))
        this.particles.emit(at, { count: 140, color: palette, speed: 8, spread: 1, up: 1.5, gravity: 4, size: 0.4, life: 1.6 })
        sfx.pop(0, 0.8 + Math.random() * 0.6)
      }, 260 * i)
    }
  }

  private startCelebration() {
    if (this.celebrate !== null) return
    this.focusId = null
    this.refreshLabels()
    this.popText('SANTÉ !', '#ffd23f', new THREE.Vector3(0, 3.6, 0), 2.2, 4200)
    sfx.fanfare(0.2)
    this.fireworks(new THREE.Vector3(0, 0, 0), 4)
    this.celebrate = window.setInterval(() => this.fireworks(new THREE.Vector3(0, 0, 0), 2), 2400)
  }

  // ─── Boucle de rendu ──────────────────────────────────────────────────────

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.managed.resize()
    this.camera.aspect = w / h
    this.camera.fov = w / h < 1.6 ? 40 * (1.6 / (w / h)) ** 0.8 : 40
    this.camera.updateProjectionMatrix()
    this.particles.setPixelScale(this.managed.renderer.domElement.height)
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const active = this.tweens.busy || this.playback !== null || this.particles.active || this.shake > 0.01 || this.hover || this.celebrate !== null
    if (!this.shouldRender(now, active) || !this.managed.canRender()) return
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now

    this.tweens.tick(now)
    this.particles.tick(dt)

    // Rejeu de la simulation.
    const pb = this.playback
    if (pb) {
      const t = (now - pb.start) / 1000
      poseAtTime(pb.sim, 0, t, this.die.position, this.die.quaternion)
      while (pb.impactIndex < pb.sim.impacts.length && pb.sim.impacts[pb.impactIndex].t <= t) {
        const hit = pb.sim.impacts[pb.impactIndex++]
        sfx.clack(hit.strength, hit.surface === 'wall' ? 'wood' : hit.surface === 'die' ? 'wood' : 'felt')
        if (hit.strength > 0.35) {
          this.particles.emit(hit.pos.clone().setY(0.15), { count: Math.round(10 + hit.strength * 30), color: ['#cfe8d8', '#ffffff'], speed: 2.5, up: 1.2, gravity: 5, size: 0.22, life: 0.5 })
          this.shake = Math.max(this.shake, hit.strength * 0.18)
        }
      }
      // La caméra suit un peu le dé pendant qu'il roule.
      this.cameraGoal.target.set(this.die.position.x * 0.35, 0, CAMERA_TARGET.z + this.die.position.z * 0.25)
      if (t >= pb.sim.duration) {
        this.playback = null
        pb.resolve()
      }
    } else if (this.hover) {
      // Avant le premier lancer, le dé flotte au-dessus du bac en tournant lentement.
      this.die.position.set(0, 2.2 + Math.sin(now / 700) * 0.18, 0)
      this.die.rotation.set(now / 2300, now / 1700, now / 2900)
    }

    // Ombre de contact : plus nette et plus sombre quand le dé est près du sol.
    const height = Math.max(0, this.die.position.y - DIE / 2)
    this.dieShadow.position.set(this.die.position.x + height * 0.18, 0.03, this.die.position.z + height * 0.1)
    this.dieShadow.scale.setScalar(1 + height * 0.25)
    ;(this.dieShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 0.9 - height * 0.22)

    // Lueur des points de la face gagnante.
    this.glow += (this.targetGlow - this.glow) * (1 - Math.exp(-dt * 5))
    this.skin.glow(this.glowValue, this.glowColor, this.glow * (0.85 + Math.sin(now / 220) * 0.15))

    // Halo et projecteur sur le joueur concerné.
    const seat = this.focusId ? this.seats.get(this.focusId) : undefined
    this.halo.visible = !!seat
    if (seat) {
      ;(this.halo.material as THREE.MeshBasicMaterial).color.set(seat.member.color)
      this.seatLight.color.set(seat.member.color)
      this.haloPos.lerp(seat.pos, 1 - Math.exp(-dt * 7))
      this.halo.position.set(this.haloPos.x, 0.025, this.haloPos.z)
      const pulse = 1 + Math.sin(now / 280) * 0.08
      this.halo.scale.set(pulse, pulse, 1)
      this.seatLight.position.set(this.haloPos.x * 0.85, 3, this.haloPos.z * 0.85)
      this.seatLight.intensity = 22 + Math.sin(now / 280) * 5
    } else {
      this.seatLight.intensity = 0
    }

    // Verres : le liquide tangue à chaque gorgée.
    for (const s of this.seats.values()) {
      if (s.wobble > 0.001) {
        s.wobble *= Math.exp(-dt * 3.5)
        s.glass.rotation.z = Math.sin(now / 60) * 0.12 * s.wobble
        s.liquid.scale.y = 1 - 0.25 * s.wobble
        s.liquid.position.y = 0.37 - 0.06 * s.wobble
      }
    }

    // Caméra : glisse vers son but, tremble aux chocs, tourne lentement pendant la fête.
    if (this.celebrate !== null) {
      this.orbit += dt * 0.12
      const r = Math.hypot(CAMERA_HOME.x, CAMERA_HOME.z)
      this.cameraGoal.pos.set(Math.sin(this.orbit) * r, CAMERA_HOME.y - 1.5, Math.cos(this.orbit) * r)
      this.cameraGoal.target.set(0, 0, 0)
    }
    const k = 1 - Math.exp(-dt * 3)
    this.camera.position.lerp(this.cameraGoal.pos, k)
    this.cameraTarget.lerp(this.cameraGoal.target, k)
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake
      this.camera.position.y += (Math.random() - 0.5) * this.shake
      this.shake *= Math.exp(-dt * 7)
    }
    this.camera.position.y += Math.sin(now / 2600) * 0.004
    this.camera.lookAt(this.cameraTarget)

    this.managed.renderer.render(this.scene, this.camera)
  }

  get fatal() {
    return this.managed.isFatal()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    if (this.celebrate !== null) window.clearInterval(this.celebrate)
    this.resizeObserver.disconnect()
    this.playback?.resolve()
    this.playback = null
    this.tweens.flush()
    for (const seat of this.seats.values()) seat.label.dispose()
    this.particles.dispose()
    this.skin.dispose()
    disposeScene(this.scene)
    this.scene.environment?.dispose()
    this.glassGeo.dispose()
    this.sipTexture.dispose()
    this.liquidGeo.dispose()
    this.managed.dispose()
  }
}
