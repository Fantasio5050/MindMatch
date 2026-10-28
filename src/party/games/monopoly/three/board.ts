import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createManagedRenderer, disposeScene, makeFrameGate, type ManagedRenderer } from '../../../lib/threePerf'
import { disposeSprite, ease, makeAvatarTexture, makeGlowTexture, makeTextSprite, Particles, SeatLabel, Tweens } from '../../../lib/fx3d'
import { planRoll, poseAt, poseAtTime, seededRandom, type SimResult } from '../../../lib/diceSim'
import { DieSkin, makeDieGeometry } from '../../../lib/dieArt'
import { sfx } from '../../../lib/sfx'
import { formatMoney, JAIL_SQUARE } from '../../../../data/monopoly'
import { BOARD_SIZE, drawBoard, drawCardBack, drawCardFace, squareLayout } from './boardArt'
import { Buildings, TokenKit } from './tokens'
import type { MonoClientState, MonoEvent } from '../types'

/**
 * Le plateau de Monopoly en 3D, vu par la TV — à la manière des Monopoly de console.
 *
 * Le serveur consigne chaque moment de la partie (`events`) ; ce module les rejoue un par un :
 * les dés roulent pour de vrai au centre du plateau, le pion avance case par case et la caméra le
 * suit d'un bord à l'autre, les pièces volent du payeur au propriétaire, la carte Chance se
 * retourne face à la caméra, les maisons tombent du ciel. Une TV branchée en cours de partie pose
 * le plateau tel quel, sans rejouer l'historique.
 */

export interface BoardMember {
  id: string
  pseudo: string
  color: string
  photoUrl: string | null
}

export type BoardNotice = { type: 'event'; event: MonoEvent } | { type: 'idle' }
export type BoardPhase = 'intro' | 'turn' | 'ended'

const DIE = 0.95
const DICE_ARENA = { halfX: 6.4, halfZ: 6.4 }
const CAM_HOME = new THREE.Vector3(0, 26.5, 21)
const CAM_TARGET = new THREE.Vector3(0, 0, 0.9)
const GOLD = '#f5c542'
/** La cagnotte se pose sur la case Parc gratuit, côté intérieur. */
const POT_POS = onSquare(20, 0, -0.85)
/** Paquets de cartes au centre (voir le dessin du plateau). */
const DECKS = {
  chance: { pos: new THREE.Vector3(2.95, 0, 2.95), rot: Math.PI / 4 },
  chest: { pos: new THREE.Vector3(-2.95, 0, -2.95), rot: Math.PI / 4 },
}

interface Pawn {
  id: string
  group: THREE.Group
  label: SeatLabel
  avatar: THREE.Sprite
  square: number
  inJail: boolean
  bankrupt: boolean
  color: string
  name: string
  cash: number
}

interface DicePlayback {
  sim: SimResult
  start: number
  impact: number
  resolve: () => void
}

/** Position monde d'un point exprimé dans le repère d'une case (x le long du bord, z vers l'extérieur). */
function onSquare(i: number, lx: number, lz: number, y = 0): THREE.Vector3 {
  const L = squareLayout(i)
  const c = Math.cos(L.rot)
  const s = Math.sin(L.rot)
  return new THREE.Vector3(L.x + lx * c + lz * s, y, L.z - lx * s + lz * c)
}

/** Les dés ne doivent pas traverser les paquets de cartes posés au centre. */
function clearOfDecks(sim: SimResult): boolean {
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  for (let f = 0; f < sim.frames; f += 2) {
    for (let d = 0; d < sim.dice; d++) {
      poseAt(sim, d, f, p, q)
      for (const deck of Object.values(DECKS)) if (Math.hypot(p.x - deck.pos.x, p.z - deck.pos.z) < 2.4) return false
    }
  }
  return true
}

/** Les pions regardent dans le sens de la marche. */
const HEADING = [Math.PI, Math.PI / 2, 0, -Math.PI / 2]

export class MonopolyBoard {
  private managed: ManagedRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private tweens = new Tweens()
  private particles = new Particles(2600)
  private kit = new TokenKit()
  private buildings = new Buildings()
  private pawns = new Map<string, Pawn>()
  private houseMeshes = new Map<number, THREE.Mesh[]>()
  private houseCount = new Map<number, number>()
  private ownerStrips = new Map<number, THREE.Mesh>()
  private mortgageVeils = new Map<number, THREE.Mesh>()
  private stripGeo = new THREE.BoxGeometry(1, 0.08, 0.24)
  private highlight: THREE.Mesh
  private highlightSquare = -1
  private dice: THREE.Group[] = []
  private diceMeshes: THREE.Mesh[] = []
  private skins: DieSkin[] = []
  private dicePlay: DicePlayback | null = null
  private pot: THREE.Mesh
  private potShown = 0
  private card: THREE.Mesh | null = null
  /** La carte est arrivée devant la caméra : elle la suit tant qu'elle reste affichée. */
  private cardHeld = false
  private texts: THREE.Sprite[] = []
  private coinTexture = makeGlowTexture('rgba(255,224,120,1)', 'rgba(245,197,66,0)')
  private state: MonoClientState | null = null
  private phase: BoardPhase = 'intro'
  private lastSeq = 0
  private queue: MonoEvent[] = []
  private running = false
  private follow: string | null = null
  private cameraGoal = { pos: CAM_HOME.clone(), target: CAM_TARGET.clone() }
  private cameraTarget = CAM_TARGET.clone()
  private shake = 0
  private orbit = 0
  private celebrate: number | null = null
  private raf = 0
  private disposed = false
  private lastFrame = performance.now()
  private shouldRender = makeFrameGate()
  private resizeObserver: ResizeObserver
  private container: HTMLElement
  private notify: (n: BoardNotice) => void

  static async create(container: HTMLElement, notify: (n: BoardNotice) => void): Promise<MonopolyBoard> {
    await Promise.all([
      document.fonts?.load('italic 900 100px "Archivo Variable"').catch(() => null),
      document.fonts?.load('800 60px "Inter Tight Variable"').catch(() => null),
    ])
    return new MonopolyBoard(container, notify)
  }

  private constructor(container: HTMLElement, notify: (n: BoardNotice) => void) {
    this.container = container
    this.notify = notify
    this.managed = createManagedRenderer(container)
    const renderer = this.managed.renderer
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

    this.camera = new THREE.PerspectiveCamera(40, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 300)
    this.camera.position.copy(CAM_HOME)
    this.camera.lookAt(CAM_TARGET)

    const scene = this.scene
    scene.background = new THREE.Color(0x07090b)
    scene.fog = new THREE.Fog(0x07090b, 40, 90)
    try {
      const pmrem = new THREE.PMREMGenerator(renderer)
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      scene.environmentIntensity = 0.55
      pmrem.dispose()
    } catch {
      scene.environment = null
    }

    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1b1410, 0.55))
    const key = new THREE.DirectionalLight(0xfff0dd, 2.0)
    key.position.set(-9, 26, 14)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -14
    key.shadow.camera.right = 14
    key.shadow.camera.top = 14
    key.shadow.camera.bottom = -14
    key.shadow.camera.near = 5
    key.shadow.camera.far = 60
    key.shadow.bias = -0.0006
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x9fb7ff, 0.45)
    rim.position.set(12, 10, -14)
    scene.add(rim)

    // ── Le plateau : dessus peint, tranche laquée, posé sur une table sombre.
    const boardTex = new THREE.CanvasTexture(drawBoard())
    boardTex.colorSpace = THREE.SRGBColorSpace
    boardTex.anisotropy = anisotropy
    const side = new THREE.MeshStandardMaterial({ color: 0x1c2b26, roughness: 0.35, metalness: 0.2 })
    const top = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.62 })
    const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD_SIZE, 0.5, BOARD_SIZE), [side, side, top, side, side, side])
    board.position.y = -0.25
    board.receiveShadow = true
    board.castShadow = true
    scene.add(board)
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(60, 64),
      new THREE.MeshStandardMaterial({ map: this.tableTexture(), roughness: 0.9 }),
    )
    table.rotation.x = -Math.PI / 2
    table.position.y = -0.5
    table.receiveShadow = true
    scene.add(table)

    // ── Paquets de cartes.
    for (const deck of ['chance', 'chest'] as const) {
      const tex = new THREE.CanvasTexture(drawCardBack(deck))
      tex.colorSpace = THREE.SRGBColorSpace
      const edge = new THREE.MeshStandardMaterial({ color: 0xf4eddb, roughness: 0.8 })
      const stack = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.3, 2.35), [edge, edge, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), edge, edge, edge])
      stack.position.copy(DECKS[deck].pos).setY(0.15)
      stack.rotation.y = DECKS[deck].rot
      stack.castShadow = true
      stack.receiveShadow = true
      scene.add(stack)
    }

    // ── Cagnotte du Parc gratuit : une liasse de billets qui grossit au centre.
    this.pot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.8), new THREE.MeshStandardMaterial({ color: 0xc9e6b7, roughness: 0.7 }))
    this.pot.castShadow = true
    this.pot.position.copy(POT_POS)
    this.pot.rotation.y = Math.PI / 4
    this.pot.visible = false
    scene.add(this.pot)

    // ── Surbrillance d'une case (achat, enchère).
    this.highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.highlight.rotation.x = -Math.PI / 2
    this.highlight.position.y = 0.03
    scene.add(this.highlight)

    // ── Les deux dés, posés au centre en attendant le premier lancer.
    for (let k = 0; k < 2; k++) {
      const skin = new DieSkin(undefined, anisotropy)
      const holder = new THREE.Group()
      const mesh = new THREE.Mesh(makeDieGeometry(DIE), skin.materials)
      mesh.castShadow = true
      holder.add(mesh)
      holder.position.set(k === 0 ? -0.9 : 0.9, DIE / 2, 1.2)
      holder.rotation.y = k * 0.6
      scene.add(holder)
      this.dice.push(holder)
      this.diceMeshes.push(mesh)
      this.skins.push(skin)
    }

    scene.add(this.particles.points)
    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.loop()
  }

  private tableTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 256)
    g.addColorStop(0, '#3a2a20')
    g.addColorStop(0.5, '#22180f')
    g.addColorStop(1, '#0b0806')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  // ─── Pions ────────────────────────────────────────────────────────────────

  private pawnSlot(pawn: Pawn, square: number, inJail: boolean): THREE.Vector3 {
    const here = [...this.pawns.values()].filter((p) => !p.bankrupt && p.square === square && (square !== JAIL_SQUARE || p.inJail === inJail))
    const k = Math.max(0, here.indexOf(pawn))
    const n = Math.max(1, here.length)
    const L = squareLayout(square)
    if (L.corner) {
      if (square === JAIL_SQUARE) {
        // En prison : dans la cellule ; en simple visite : sur la bande extérieure.
        if (inJail) return onSquare(square, -0.55 + (k % 2) * 0.62, -0.55 + Math.floor(k / 2) * 0.5)
        return onSquare(square, -1.0 + k * 0.62, 1.05)
      }
      return onSquare(square, -0.6 + (k % 3) * 0.6, -0.3 + Math.floor(k / 3) * 0.7)
    }
    const cols = n > 1 ? 2 : 1
    const col = k % cols
    const row = Math.floor(k / cols)
    return onSquare(square, cols === 1 ? 0 : col === 0 ? -0.42 : 0.42, -0.25 + row * 0.55)
  }

  private placePawn(pawn: Pawn) {
    const p = this.pawnSlot(pawn, pawn.square, pawn.inJail)
    pawn.group.position.copy(p)
    // Seul sur sa case, le pion prend toute sa taille ; à plusieurs, ils se serrent.
    const crowd = [...this.pawns.values()].filter((o) => !o.bankrupt && o.square === pawn.square).length
    pawn.group.scale.setScalar(crowd <= 1 ? 1.45 : crowd === 2 ? 1.15 : 0.95)
    pawn.group.rotation.y = HEADING[Math.floor(pawn.square / 10) % 4]
  }

  private layoutPawns() {
    for (const pawn of this.pawns.values()) if (!pawn.bankrupt) this.placePawn(pawn)
  }

  private ensurePawns(s: MonoClientState, members: BoardMember[]) {
    s.players.forEach((pl) => {
      if (this.pawns.has(pl.id)) return
      const m = members.find((x) => x.id === pl.id)
      const color = m?.color ?? '#cccccc'
      const group = this.kit.make(pl.token, color)
      const label = new SeatLabel()
      label.sprite.scale.set(2, 0.5, 1)
      label.sprite.position.set(0, 1.85, 0)
      const avatar = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeAvatarTexture(m?.pseudo ?? '?', color, m?.photoUrl ?? null, () => {}), transparent: true, depthTest: false }))
      avatar.scale.setScalar(0.5)
      avatar.position.set(0, 1.35, 0)
      avatar.renderOrder = 14
      group.add(label.sprite, avatar)
      this.scene.add(group)
      const pawn: Pawn = { id: pl.id, group, label, avatar, square: pl.pos, inJail: pl.inJail, bankrupt: pl.bankrupt, color, name: m?.pseudo ?? '?', cash: pl.cash }
      group.visible = !pl.bankrupt
      this.pawns.set(pl.id, pawn)
    })
    this.layoutPawns()
    this.refreshLabels()
  }

  private refreshLabels() {
    const s = this.state
    const cur = s && this.phase === 'turn' ? s.players[s.turn]?.id : null
    for (const p of this.pawns.values()) {
      p.label.draw(p.name, p.cash, { active: p.id === cur })
      // Le bandeau de la TV nomme déjà tout le monde : sur le plateau, seule l'étiquette du joueur
      // courant reste, sinon elles s'empilent sur la case Départ.
      p.label.sprite.visible = p.id === cur
    }
  }

  // ─── Propriétés : bandes de propriétaire, maisons, hypothèques ─────────────

  private setOwner(square: number, ownerId: string | null) {
    const old = this.ownerStrips.get(square)
    if (old) {
      this.scene.remove(old)
      ;(old.material as THREE.Material).dispose()
      this.ownerStrips.delete(square)
    }
    if (!ownerId) return
    const pawn = this.pawns.get(ownerId)
    const color = pawn?.color ?? '#ffffff'
    const strip = new THREE.Mesh(this.stripGeo, new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.8, roughness: 0.4 }))
    strip.userData.owner = ownerId
    const L = squareLayout(square)
    strip.scale.x = L.w * 0.86
    strip.position.copy(onSquare(square, 0, L.d / 2 - 0.2, 0.04))
    strip.rotation.y = L.rot
    this.scene.add(strip)
    this.ownerStrips.set(square, strip)
  }

  private setHouses(square: number, count: number, animate: boolean) {
    const old = this.houseMeshes.get(square) ?? []
    for (const m of old) this.scene.remove(m)
    this.houseMeshes.delete(square)
    this.houseCount.set(square, Math.max(0, count))
    if (count <= 0) return
    const L = squareLayout(square)
    const bandZ = -L.d / 2 + L.d * 0.11
    const meshes: THREE.Mesh[] = []
    if (count >= 5) meshes.push(new THREE.Mesh(this.buildings.hotelGeo, this.buildings.hotelMat))
    else for (let k = 0; k < count; k++) meshes.push(new THREE.Mesh(this.buildings.houseGeo, this.buildings.houseMat))
    meshes.forEach((m, k) => {
      const lx = count >= 5 ? 0 : (k - (count - 1) / 2) * 0.4
      const target = onSquare(square, lx, bandZ, 0.02)
      m.rotation.y = L.rot
      m.castShadow = true
      this.scene.add(m)
      if (animate && k === meshes.length - 1) {
        m.position.copy(target).setY(4)
        void this.tweens.add(520, (t) => m.position.set(target.x, 4 * (1 - t), target.z), { ease: ease.outBack }).then(() => {
          this.particles.emit(target.clone().setY(0.2), { count: 26, color: ['#ffffff', '#c9f2d5'], speed: 2.6, up: 1.4, size: 0.25, life: 0.6 })
          sfx.clack(0.6, 'board')
        })
      } else m.position.copy(target)
    })
    this.houseMeshes.set(square, meshes)
  }

  private setMortgaged(square: number, on: boolean) {
    const old = this.mortgageVeils.get(square)
    if (old) {
      this.scene.remove(old)
      ;(old.material as THREE.Material).dispose()
      old.geometry.dispose()
      this.mortgageVeils.delete(square)
    }
    if (!on) return
    const L = squareLayout(square)
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(L.w * 0.96, L.d * 0.96), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }))
    veil.rotation.set(-Math.PI / 2, 0, L.rot)
    veil.position.set(L.x, 0.02, L.z)
    this.scene.add(veil)
    this.mortgageVeils.set(square, veil)
  }

  private setPot(amount: number) {
    this.potShown = amount
    this.pot.visible = amount > 0
    const h = Math.min(1.2, 0.08 + amount / 1500)
    this.pot.scale.set(1, h, 1)
    this.pot.position.y = h / 2
  }

  /** Remet tout en accord avec l'état (connexion en cours de partie, fin d'une file d'événements). */
  private reconcile(s: MonoClientState) {
    for (const pl of s.players) {
      const pawn = this.pawns.get(pl.id)
      if (!pawn) continue
      pawn.square = pl.pos
      pawn.inJail = pl.inJail
      pawn.bankrupt = pl.bankrupt
      pawn.cash = pl.cash
      pawn.group.visible = !pl.bankrupt
    }
    this.layoutPawns()
    for (let i = 0; i < 40; i++) {
      const owner = s.owners[i] ?? null
      if ((this.ownerStrips.get(i)?.userData.owner ?? null) !== owner) this.setOwner(i, owner)
      const houses = s.houses[i] ?? 0
      if ((this.houseCount.get(i) ?? 0) !== houses) this.setHouses(i, houses, false)
      if (!!s.mortgaged[i] !== this.mortgageVeils.has(i)) this.setMortgaged(i, !!s.mortgaged[i])
    }
    this.setPot(s.pot)
    this.refreshLabels()
  }

  // ─── Synchronisation ──────────────────────────────────────────────────────

  sync(next: MonoClientState, members: BoardMember[], phase: BoardPhase) {
    const first = this.state === null
    this.state = next
    this.phase = phase
    this.ensurePawns(next, members)
    if (first) {
      this.lastSeq = next.seq
      this.reconcile(next)
      if (phase === 'ended') this.startCelebration(next.winner)
      return
    }
    const fresh = next.events.filter((e) => e.seq > this.lastSeq)
    if (fresh.length) {
      this.lastSeq = fresh[fresh.length - 1].seq
      this.queue.push(...fresh)
      void this.drain()
    }
    if (!this.running) this.idleState()
  }

  /** Ce qui ne dépend que de l'état, hors animation : surbrillance, étiquette du joueur courant. */
  private idleState() {
    const s = this.state
    if (!s) return
    this.refreshLabels()
    const cur = s.players[s.turn]
    const square = s.step === 'auction' && s.auction ? s.auction.square : s.step === 'buy' && cur ? cur.pos : -1
    this.highlightSquare = square
    if (square >= 0) {
      const L = squareLayout(square)
      this.highlight.scale.set(L.w, L.d, 1)
      this.highlight.rotation.set(-Math.PI / 2, 0, L.rot)
      this.highlight.position.set(L.x, 0.03, L.z)
    }
    // Entre deux actions, la caméra garde un œil sur le joueur courant.
    if (this.phase === 'turn' && cur && s.step !== 'roll' && s.step !== 'jail') this.follow = cur.id
    else this.follow = null
    if (this.phase === 'ended') this.startCelebration(s.winner)
  }

  private async drain() {
    if (this.running) return
    this.running = true
    while (this.queue.length) {
      const ev = this.queue.shift()!
      this.notify({ type: 'event', event: ev })
      for (const [id, cash] of Object.entries(ev.cash)) {
        const p = this.pawns.get(id)
        if (p) p.cash = cash
      }
      this.refreshLabels()
      try {
        await this.play(ev, this.queue.length > 6)
      } catch (error) {
        console.error(error)
      }
      if (this.disposed) return
    }
    this.running = false
    if (this.state) this.reconcile(this.state)
    this.idleState()
    this.notify({ type: 'idle' })
  }

  // ─── Événements ───────────────────────────────────────────────────────────

  private pawnPos(id: string, y = 0): THREE.Vector3 {
    const p = this.pawns.get(id)
    return p ? p.group.position.clone().setY(y) : new THREE.Vector3(0, y, 0)
  }

  private async play(ev: MonoEvent, hurry: boolean) {
    switch (ev.type) {
      case 'start':
        return
      case 'roll':
        return this.throwDice(ev.dice, ev.seed, hurry)
      case 'move':
        return this.movePawn(ev.who, ev.from, ev.to, ev.mode, hurry)
      case 'go':
        this.popText(`+${formatMoney(ev.amount)}`, '#3ddc97', this.pawnPos(ev.who, 2.6), 0.9, 900)
        this.coinBurst(this.pawnPos(ev.who, 0.6))
        sfx.cash()
        return this.tweens.wait(hurry ? 200 : 700)
      case 'buy':
      case 'won': {
        const who = ev.who
        if (!who) {
          this.popText('Pas preneur', '#bbbbbb', this.squareTop(ev.square), 0.8, 900)
          return this.tweens.wait(600)
        }
        this.focusSquare(ev.square)
        this.setOwner(ev.square, who)
        this.popText(ev.type === 'won' ? 'ADJUGÉ !' : 'ACHETÉ !', this.pawns.get(who)?.color ?? GOLD, this.squareTop(ev.square), 1.1, 1000)
        this.particles.emit(this.squareTop(ev.square).setY(0.3), { count: 60, color: [this.pawns.get(who)?.color ?? GOLD, GOLD, '#ffffff'], speed: 4, up: 3, size: 0.32, life: 1 })
        sfx.cash()
        return this.tweens.wait(hurry ? 300 : 1300)
      }
      case 'rent':
        this.focusSquare(ev.square)
        this.popText(`−${formatMoney(ev.amount)}`, '#ff5d5d', this.pawnPos(ev.who, 2.6), 0.85, 1000)
        await this.coinStream(this.pawnPos(ev.who, 0.8), this.pawnPos(ev.to, 0.8), Math.min(12, 3 + Math.round(ev.amount / 60)))
        this.popText(`+${formatMoney(ev.amount)}`, '#3ddc97', this.pawnPos(ev.to, 2.6), 0.85, 900)
        sfx.cash()
        return this.tweens.wait(hurry ? 200 : 600)
      case 'tax':
        this.popText(`−${formatMoney(ev.amount)}`, '#ff5d5d', this.pawnPos(ev.who, 2.6), 0.85, 1000)
        await this.coinStream(this.pawnPos(ev.who, 0.8), POT_POS.clone().setY(0.6), 6)
        sfx.buzzer()
        this.setPot(this.potShown + ev.amount)
        return this.tweens.wait(hurry ? 200 : 600)
      case 'money': {
        const up = ev.amount >= 0
        this.popText(`${up ? '+' : '−'}${formatMoney(Math.abs(ev.amount))}`, up ? '#3ddc97' : '#ff5d5d', this.pawnPos(ev.who, 2.6), 0.85, 1000)
        if (up) {
          this.coinBurst(this.pawnPos(ev.who, 0.6))
          sfx.coins()
        } else sfx.buzzer()
        return this.tweens.wait(hurry ? 200 : 900)
      }
      case 'pot':
        await this.coinStream(POT_POS.clone().setY(0.8), this.pawnPos(ev.who, 0.8), 14)
        this.setPot(0)
        this.popText(`JACKPOT +${formatMoney(ev.amount)}`, GOLD, this.pawnPos(ev.who, 2.6), 0.95, 1300)
        sfx.fanfare()
        return this.tweens.wait(hurry ? 200 : 900)
      case 'card':
        return this.showCard(ev.deck, ev.text)
      case 'jail':
        this.popText('EN PRISON !', '#ff5d5d', this.pawnPos(ev.who, 2.6), 1.1, 1200)
        this.shake = 0.35
        sfx.buzzer()
        sfx.thud(0.1)
        return this.tweens.wait(hurry ? 300 : 1200)
      case 'free': {
        const pawn = this.pawns.get(ev.who)
        if (pawn) {
          pawn.inJail = false
          this.layoutPawns()
        }
        this.popText('LIBÉRÉ !', '#3ddc97', this.pawnPos(ev.who, 2.6), 0.95, 900)
        sfx.chime()
        return this.tweens.wait(hurry ? 200 : 800)
      }
      case 'build':
        this.focusSquare(ev.square)
        this.setHouses(ev.square, ev.houses, true)
        sfx.whoosh(0, 0.3)
        return this.tweens.wait(hurry ? 250 : 800)
      case 'sell':
        this.setHouses(ev.square, ev.houses, false)
        sfx.coins(0, 4)
        return this.tweens.wait(hurry ? 150 : 400)
      case 'mortgage':
        this.setMortgaged(ev.square, ev.on)
        sfx.clack(0.5, 'board')
        return this.tweens.wait(hurry ? 150 : 400)
      case 'auction':
        this.focusSquare(ev.square)
        this.popText('AUX ENCHÈRES !', GOLD, this.squareTop(ev.square), 1, 1200)
        sfx.drumroll(0.8)
        return this.tweens.wait(hurry ? 200 : 900)
      case 'bid':
        this.popText(formatMoney(ev.amount), this.pawns.get(ev.who)?.color ?? GOLD, this.pawnPos(ev.who, 2.6), 0.75, 700)
        sfx.pop(0, 1.2)
        return this.tweens.wait(hurry ? 50 : 250)
      case 'trade':
        sfx.whoosh(0, 0.4)
        sfx.cash(0.3)
        this.popText('MARCHÉ CONCLU', GOLD, new THREE.Vector3(0, 3, 0), 1, 1200)
        if (this.state) this.reconcile(this.state)
        return this.tweens.wait(hurry ? 300 : 1200)
      case 'bankrupt': {
        const pawn = this.pawns.get(ev.who)
        this.popText('FAILLITE', '#ff5d5d', this.pawnPos(ev.who, 2.6), 1.2, 1400)
        sfx.buzzer()
        if (pawn) {
          const g = pawn.group
          await this.tweens.add(900, (t) => {
            g.rotation.z = t * 1.4
            g.position.y = -t * 0.3
          }, { ease: ease.inOutCubic })
          pawn.bankrupt = true
          g.visible = false
          g.rotation.z = 0
        }
        if (this.state) this.reconcile(this.state)
        return this.tweens.wait(500)
      }
      case 'end':
        return this.startCelebration(ev.winner)
    }
  }

  private squareTop(square: number): THREE.Vector3 {
    const L = squareLayout(square)
    return new THREE.Vector3(L.x, 2.4, L.z)
  }

  private focusSquare(square: number) {
    const L = squareLayout(square)
    const out = new THREE.Vector3(L.x, 0, L.z).normalize()
    this.follow = null
    this.cameraGoal.target.set(L.x * 0.85, 0, L.z * 0.85)
    this.cameraGoal.pos.set(L.x * 0.85 + out.x * 7, 11, L.z * 0.85 + out.z * 7 + 3)
  }

  // ─── Dés ──────────────────────────────────────────────────────────────────

  private async throwDice(values: [number, number], seed: number, hurry: boolean) {
    this.follow = null
    this.cameraGoal.pos.set(0, 13, 12.5)
    this.cameraGoal.target.set(0, 0, 0.8)
    for (const s of this.skins) s.glow(null, 0xffffff, 0)
    // Lancés en diagonale, du coin bas-gauche vers le haut-droit : la diagonale libre, celle où
    // ne sont posés ni les paquets de cartes ni la cagnotte.
    const release = [new THREE.Vector3(-5.2, 3.2, 4.4), new THREE.Vector3(-4.2, 3.4, 5.3)]
    const aim = new THREE.Vector3(1, 0, -1).normalize()
    const releaseQuat = [new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.9, 0.2)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 2.1, 0.5))]
    const plan = planRoll(
      values,
      this.diceMeshes.map((m) => m.quaternion.clone()),
      (attempt) => {
        const r = seededRandom(seed + attempt * 7919)
        return release.map((pos, k) => ({
          pos: pos.clone(),
          vel: aim.clone().multiplyScalar(6.5 + r() * 2.5).add(new THREE.Vector3((r() - 0.5) * 1.6, 2 + r() * 2, (r() - 0.5) * 1.6)),
          spin: new THREE.Vector3((r() - 0.5) * 34, (r() - 0.5) * 24, (r() - 0.5) * 34),
          quat: releaseQuat[k].clone(),
        }))
      },
      DICE_ARENA,
      DIE,
      { accept: (sim) => !sim.impacts.some((i) => i.surface === 'wall') && clearOfDecks(sim) },
    )
    // Les dés filent dans la main, se secouent, puis partent.
    const from = this.dice.map((d) => ({ p: d.position.clone(), q: d.quaternion.clone() }))
    sfx.whoosh(0, 0.35)
    await this.tweens.add(hurry ? 200 : 420, (t) => {
      this.dice.forEach((d, k) => {
        d.position.lerpVectors(from[k].p, release[k], t)
        d.position.y += Math.sin(t * Math.PI) * 1.5
        d.quaternion.slerpQuaternions(from[k].q, releaseQuat[k], t)
      })
    }, { ease: ease.inOutCubic })
    sfx.rattle(hurry ? 0.2 : 0.4)
    await this.tweens.add(hurry ? 200 : 400, (t) => {
      const k = Math.sin(t * Math.PI)
      this.dice.forEach((d, i) => d.position.set(release[i].x + Math.sin(t * 50 + i) * 0.1 * k, release[i].y + Math.abs(Math.sin(t * 41 + i)) * 0.15 * k, release[i].z))
    }, { ease: ease.linear })
    plan.remaps.forEach((q, k) => {
      if (q) this.diceMeshes[k].quaternion.copy(q)
    })
    await new Promise<void>((resolve) => {
      this.dicePlay = { sim: plan.sim, start: performance.now(), impact: 0, resolve }
    })
    const sum = values[0] + values[1]
    const double = values[0] === values[1]
    this.skins.forEach((s, k) => s.glow(values[k], double ? GOLD : '#ffffff', 0.7))
    this.popText(double ? `DOUBLE ${values[0]} !` : String(sum), double ? GOLD : '#ffffff', new THREE.Vector3(0, 2.6, 0.5), double ? 1.3 : 1.6, 900)
    if (double) {
      sfx.chime()
      this.particles.emit(new THREE.Vector3(0, 0.8, 0.5), { count: 90, color: [GOLD, '#ffffff'], speed: 6, up: 4, size: 0.35, life: 1.1 })
    } else sfx.pop(0, 0.9)
    await this.tweens.wait(hurry ? 250 : 750)
  }

  // ─── Déplacements ─────────────────────────────────────────────────────────

  private async movePawn(id: string, from: number, to: number, mode: 'walk' | 'back' | 'jump', hurry: boolean) {
    const pawn = this.pawns.get(id)
    if (!pawn) return
    this.follow = id
    if (mode === 'jump') {
      const a = pawn.group.position.clone()
      pawn.square = to
      pawn.inJail = to === JAIL_SQUARE && (this.state?.players.find((p) => p.id === id)?.inJail ?? true)
      const b = this.pawnSlot(pawn, to, pawn.inJail)
      sfx.whoosh(0, 0.5)
      await this.tweens.add(hurry ? 400 : 900, (t) => {
        pawn.group.position.lerpVectors(a, b, t)
        pawn.group.position.y = Math.sin(t * Math.PI) * 5
        pawn.group.rotation.y += 0.25
      }, { ease: ease.inOutCubic })
      pawn.group.rotation.y = HEADING[Math.floor(to / 10) % 4]
      this.layoutPawns()
      sfx.thud()
      this.shake = 0.25
      return
    }
    const dir = mode === 'back' ? -1 : 1
    const steps = mode === 'back' ? (from - to + 40) % 40 : (to - from + 40) % 40 || 40
    const hop = hurry ? 110 : steps > 8 ? 170 : 230
    pawn.inJail = false
    for (let k = 1; k <= steps; k++) {
      const sq = (from + dir * k + 40) % 40
      const a = pawn.group.position.clone()
      pawn.square = sq
      const b = this.pawnSlot(pawn, sq, false)
      const heading = HEADING[Math.floor(sq / 10) % 4] + (dir < 0 ? Math.PI : 0)
      const h0 = pawn.group.rotation.y
      const dh = Math.atan2(Math.sin(heading - h0), Math.cos(heading - h0))
      await this.tweens.add(hop, (t) => {
        pawn.group.position.lerpVectors(a, b, t)
        pawn.group.position.y = Math.sin(t * Math.PI) * 0.7
        pawn.group.rotation.y = h0 + dh * Math.min(1, t * 2)
      }, { ease: ease.inOutCubic })
      sfx.step(0, 0.9 + (k % 3) * 0.08)
      if (sq === 0 && dir > 0) this.particles.emit(b.clone().setY(0.3), { count: 40, color: ['#3ddc97', '#ffffff'], speed: 3, up: 2, size: 0.3, life: 0.7 })
    }
    this.layoutPawns()
    this.particles.emit(pawn.group.position.clone().setY(0.1), { count: 18, color: [pawn.color, '#ffffff'], speed: 2, up: 1, size: 0.22, life: 0.5 })
    await this.tweens.wait(hurry ? 100 : 350)
  }

  // ─── Cartes ───────────────────────────────────────────────────────────────

  private async showCard(deck: 'chance' | 'chest', text: string) {
    this.hideCard()
    const face = new THREE.CanvasTexture(drawCardFace(deck, text))
    face.colorSpace = THREE.SRGBColorSpace
    const back = new THREE.CanvasTexture(drawCardBack(deck))
    back.colorSpace = THREE.SRGBColorSpace
    // Dessinée en dernier et sans test de profondeur : rien (étiquette de pion, avatar) ne passe
    // devant la carte qu'on lit.
    const mat = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ ...o, transparent: true, depthTest: false, depthWrite: false })
    const edge = mat({ color: 0xf4eddb })
    const card = new THREE.Mesh(new THREE.BoxGeometry(6, 3.67, 0.05), [edge, edge, edge, edge, mat({ map: face }), mat({ map: back })])
    card.renderOrder = 50
    this.card = card
    this.scene.add(card)
    const startPos = DECKS[deck].pos.clone().setY(0.4)
    const startQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, DECKS[deck].rot))
    const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
    sfx.whoosh(0, 0.35)
    await this.tweens.add(900, (t) => {
      const goal = this.cardGoal()
      card.position.lerpVectors(startPos, goal.pos, t)
      card.position.y += Math.sin(t * Math.PI) * 2
      // Part dos visible, arrive face visible : le demi-tour se voit pendant le vol.
      const q = goal.quat.clone().multiply(flip.clone().slerp(new THREE.Quaternion(), t))
      card.quaternion.slerpQuaternions(startQuat, q, t)
    }, { ease: ease.inOutCubic })
    sfx.pop(0, 0.8)
    this.cardHeld = true
    // La carte reste lisible tant que le joueur ne l'a pas validée sur son téléphone.
    const t0 = performance.now()
    while (!this.disposed && this.state?.card && performance.now() - t0 < 20_000) await this.tweens.wait(120)
    await this.tweens.wait(400)
    this.cardHeld = false
    const from = card.position.clone()
    await this.tweens.add(500, (t) => {
      card.position.lerpVectors(from, startPos, t)
      card.scale.setScalar(1 - t * 0.6)
    }, { ease: ease.inOutCubic })
    this.hideCard()
  }

  /** Devant la caméra, face à elle. */
  private cardGoal() {
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    return { pos: this.camera.position.clone().addScaledVector(dir, 10), quat: this.camera.quaternion.clone() }
  }

  private hideCard() {
    if (!this.card) return
    this.cardHeld = false
    this.scene.remove(this.card)
    const mats = this.card.material as THREE.MeshBasicMaterial[]
    for (const m of mats) {
      m.map?.dispose()
      m.dispose()
    }
    this.card.geometry.dispose()
    this.card = null
  }

  // ─── Effets ───────────────────────────────────────────────────────────────

  private popText(text: string, color: string, at: THREE.Vector3, height: number, hold: number) {
    const sprite = makeTextSprite(text, color, height)
    sprite.position.copy(at)
    const full = sprite.scale.clone()
    sprite.scale.multiplyScalar(0.01)
    this.scene.add(sprite)
    this.texts.push(sprite)
    void this.tweens
      .add(380, (t) => sprite.scale.copy(full).multiplyScalar(Math.max(0.01, t)), { ease: ease.outBack })
      .then(() => this.tweens.add(380, (t) => {
        sprite.material.opacity = 1 - t
        sprite.position.y = at.y + t * 0.6
      }, { delay: hold, ease: ease.linear }))
      .then(() => {
        this.texts = this.texts.filter((s) => s !== sprite)
        this.scene.remove(sprite)
        disposeSprite(sprite)
      })
  }

  private coinBurst(at: THREE.Vector3) {
    this.particles.emit(at, { count: 50, color: [GOLD, '#fff3c4'], speed: 4, up: 4, size: 0.32, life: 1 })
  }

  /** Une volée de pièces d'un point à un autre. */
  private async coinStream(from: THREE.Vector3, to: THREE.Vector3, count: number) {
    const flights: Promise<void>[] = []
    for (let i = 0; i < count; i++) {
      const coin = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.coinTexture, transparent: true, depthWrite: false, depthTest: false }))
      coin.scale.setScalar(0.55)
      coin.visible = false
      coin.renderOrder = 12
      this.scene.add(coin)
      const mid = from.clone().lerp(to, 0.5).setY(Math.max(from.y, to.y) + 3 + Math.random())
      const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone())
      flights.push(
        this.tweens
          .add(650, (t) => {
            coin.visible = true
            curve.getPoint(t, coin.position)
          }, { delay: i * 70, ease: ease.inOutCubic })
          .then(() => {
            this.scene.remove(coin)
            coin.material.dispose()
            if (i % 3 === 0) sfx.coins(0, 2)
          }),
      )
    }
    await Promise.all(flights)
    this.particles.emit(to, { count: 20, color: [GOLD], speed: 2, up: 2, size: 0.25, life: 0.5 })
  }

  private startCelebration(winner: string | null) {
    if (this.celebrate !== null) return
    this.follow = null
    const pawn = winner ? this.pawns.get(winner) : undefined
    if (pawn) {
      const g = pawn.group
      const base = g.position.clone()
      void this.tweens.add(1200, (t) => {
        g.position.y = base.y + t * 1.2
        g.scale.setScalar(1 + t * 0.6)
      }, { ease: ease.outBack })
      this.popText(`${pawn.name.toUpperCase()} GAGNE !`, GOLD, base.clone().setY(4.2), 1.3, 6000)
    }
    sfx.fanfare(0.2)
    const burst = () => {
      if (this.disposed) return
      const at = new THREE.Vector3((Math.random() - 0.5) * 16, 4 + Math.random() * 3, (Math.random() - 0.5) * 16)
      this.particles.emit(at, { count: 140, color: ['#ff3d7f', GOLD, '#3ddc97', '#4cc9f0', '#ffffff'], speed: 8, up: 1.5, gravity: 4, size: 0.45, life: 1.6 })
      sfx.pop(0, 0.7 + Math.random() * 0.6)
    }
    burst()
    this.celebrate = window.setInterval(burst, 900)
  }

  // ─── Boucle ───────────────────────────────────────────────────────────────

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
    const active = this.tweens.busy || this.dicePlay !== null || this.particles.active || this.shake > 0.01 || this.celebrate !== null || this.highlightSquare >= 0 || this.card !== null
    if (!this.shouldRender(now, active) || !this.managed.canRender()) return
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.tweens.tick(now)
    this.particles.tick(dt)

    const dp = this.dicePlay
    if (dp) {
      const t = (now - dp.start) / 1000
      this.dice.forEach((d, k) => poseAtTime(dp.sim, k, t, d.position, d.quaternion))
      while (dp.impact < dp.sim.impacts.length && dp.sim.impacts[dp.impact].t <= t) {
        const hit = dp.sim.impacts[dp.impact++]
        sfx.clack(hit.strength, hit.surface === 'die' ? 'wood' : 'board')
        if (hit.strength > 0.4) this.shake = Math.max(this.shake, hit.strength * 0.1)
      }
      if (t >= dp.sim.duration) {
        this.dicePlay = null
        dp.resolve()
      }
    }

    // Surbrillance de la case en jeu (achat, enchère).
    const hl = this.highlight.material as THREE.MeshBasicMaterial
    hl.opacity = this.highlightSquare >= 0 && !this.running ? 0.25 + Math.sin(now / 260) * 0.15 : 0

    // Caméra : vue d'ensemble, ou elle suit un pion d'un bord à l'autre.
    if (this.celebrate !== null) {
      this.orbit += dt * 0.1
      const r = Math.hypot(CAM_HOME.z, 0)
      this.cameraGoal.pos.set(Math.sin(this.orbit) * r, CAM_HOME.y - 3, Math.cos(this.orbit) * r)
      this.cameraGoal.target.set(0, 0, 0)
    } else if (this.follow) {
      const p = this.pawns.get(this.follow)
      if (p && !p.bankrupt) {
        const pos = p.group.position
        const out = new THREE.Vector3(pos.x, 0, pos.z)
        if (out.lengthSq() < 1) out.set(0, 0, 1)
        out.normalize()
        this.cameraGoal.target.set(pos.x * 0.8, 0, pos.z * 0.8)
        this.cameraGoal.pos.set(pos.x * 0.8 + out.x * 9, 12.5, pos.z * 0.8 + out.z * 9 + 2.5)
      }
    } else if (!this.running) {
      this.cameraGoal.pos.copy(CAM_HOME)
      this.cameraGoal.target.copy(CAM_TARGET)
    }
    const k = 1 - Math.exp(-dt * 2.6)
    this.camera.position.lerp(this.cameraGoal.pos, k)
    this.cameraTarget.lerp(this.cameraGoal.target, k)
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake
      this.camera.position.y += (Math.random() - 0.5) * this.shake
      this.shake *= Math.exp(-dt * 7)
    }
    this.camera.lookAt(this.cameraTarget)

    // La carte suit la caméra quand elle est arrivée devant elle.
    if (this.card && this.cardHeld) {
      const g = this.cardGoal()
      this.card.position.lerp(g.pos, 0.2)
      this.card.quaternion.slerp(g.quat, 0.2)
    }

    // Le pion du joueur courant respire un peu.
    const s = this.state
    const cur = s && this.phase === 'turn' ? this.pawns.get(s.players[s.turn]?.id ?? '') : undefined
    for (const p of this.pawns.values()) {
      const body = p.group.children[1]
      if (body) body.position.y = 0.08 + (p === cur && !this.running ? Math.abs(Math.sin(now / 380)) * 0.18 : 0)
    }

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
    this.dicePlay?.resolve()
    this.dicePlay = null
    this.tweens.flush()
    this.hideCard()
    for (const p of this.pawns.values()) p.label.dispose()
    for (const s of this.skins) s.dispose()
    this.particles.dispose()
    disposeScene(this.scene)
    this.kit.dispose()
    this.buildings.dispose()
    this.stripGeo.dispose()
    this.coinTexture.dispose()
    this.scene.environment?.dispose()
    this.managed.dispose()
  }
}

