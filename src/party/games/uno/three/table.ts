import * as THREE from 'three'
import { createManagedRenderer, makeFrameGate, disposeScene, type ManagedRenderer } from '../../../lib/threePerf'
import { CardArt, CARD_H, loadCardFont, makeCardGeometry, UNO_HEX, type PlayColor } from './cardArt'
import { disposeSprite, ease, makeAvatarTexture, makeGlowTexture, makeTextSprite, Particles, SeatLabel, Tweens } from '../../../lib/fx3d'
import type { UnoCard } from '../types'

/**
 * La table d'UNO en 3D, vue par la TV.
 *
 * Ce module ne connaît pas React : il reçoit des instantanés de l'état public (`sync`) et en
 * déduit lui-même les animations, par différence avec l'instantané précédent :
 *  - une carte apparaît sur la défausse → elle part de la main de son joueur, en arc ;
 *  - une main grossit → les cartes partent de la pioche vers ce siège (+2, +4, pioche, pénalité) ;
 *  - la couleur change → la bordure de la table et l'anneau du sens de jeu changent de teinte,
 *    une onde part de la défausse ;
 *  - le sens s'inverse → l'anneau repart dans l'autre sens dans un tourbillon de particules.
 * Les événements nommés (annonce UNO, Contre-UNO, joueur passé, victoire) ajoutent leurs textes
 * et leurs effets. Une TV qui se connecte en cours de partie reconstruit la table sans rejouer
 * l'historique.
 */

export interface TableMember {
  id: string
  pseudo: string
  color: string
  photoUrl: string | null
}

export type TableCard = UnoCard & { chosenColor?: PlayColor | null }

export interface TableState {
  phase: 'intro' | 'playing' | 'ended'
  order: string[]
  handCounts: Record<string, number>
  currentId: string | null
  direction: 1 | -1
  currentColor: PlayColor
  deckCount: number
  discards: TableCard[]
  lastEvent: { seq: number; type: string; memberId: string; cardId?: string; byId?: string } | null
  unoSafeIds: string[]
  exposed: string | null
  winner: string | null
}

export type TableSound = 'vote' | 'pop' | 'reveal' | 'win' | 'tick' | 'lose'

// ─── Gabarit de la scène (unités : 1 = largeur d'une carte) ──────────────────

const TABLE_RX = 9.4
const TABLE_RZ = 6.0
const SEAT_RX = 7.7
const SEAT_RZ = 4.55
const DECK_POS = new THREE.Vector3(-1.9, 0, -0.2)
const DISCARD_POS = new THREE.Vector3(1.35, 0, -0.15)
const RING_R = 3.7
const MAX_FAN = 12
const FAN_SCALE = 0.9
/** Les cartes du centre (pioche, défausse) sont agrandies : ce sont elles qu'on lit du canapé. */
const CENTER_SCALE = 1.4
const CARD_T = 0.012
const DECK_LAYER = 0.0075
const CAMERA_HOME = new THREE.Vector3(0, 14.2, 11.2)
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0.55)

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

interface Pose {
  pos: THREE.Vector3
  quat: THREE.Quaternion
  scale?: number
}

interface Seat {
  id: string
  angle: number
  pos: THREE.Vector3
  /** Orienté vers le centre de la table. */
  fan: THREE.Group
  /** Penché vers l'extérieur, porte les cartes. */
  hand: THREE.Group
  cards: THREE.Mesh[]
  shown: number
  avatar: THREE.Sprite
  label: SeatLabel
  member: TableMember
}

export class UnoTable {
  private managed: ManagedRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private art: CardArt
  private cardGeo = makeCardGeometry(CARD_T)
  private tweens = new Tweens()
  private particles = new Particles()
  private dust: THREE.Points
  private seats = new Map<string, Seat>()
  private deck: THREE.Mesh
  private discard = new Map<string, THREE.Mesh>()
  private seenDiscards = new Set<string>()
  private rimGlow: THREE.Mesh
  private ring: THREE.Group
  private ringMat: THREE.MeshBasicMaterial
  private seatHalo: THREE.Mesh
  private seatLight: THREE.PointLight
  private centerLight: THREE.PointLight
  private color = new THREE.Color(UNO_HEX.red)
  private targetColor = new THREE.Color(UNO_HEX.red)
  private ringSpeed = 0.3
  private targetRingSpeed = 0.3
  private shake = 0
  private cameraGoal = { pos: CAMERA_HOME.clone(), target: CAMERA_TARGET.clone() }
  private cameraTarget = CAMERA_TARGET.clone()
  private state: TableState | null = null
  private lastSeq = 0
  private raf = 0
  private disposed = false
  private lastFrame = performance.now()
  private shouldRender = makeFrameGate()
  private celebrate: number | null = null
  private haloSeat: string | null = null
  private haloPos = new THREE.Vector3()
  private resizeObserver: ResizeObserver

  static async create(container: HTMLElement, sound: (s: TableSound) => void): Promise<UnoTable> {
    await loadCardFont()
    return new UnoTable(container, sound)
  }

  private container: HTMLElement
  private sound: (s: TableSound) => void

  private constructor(container: HTMLElement, sound: (s: TableSound) => void) {
    this.container = container
    this.sound = sound
    this.managed = createManagedRenderer(container)
    const renderer = this.managed.renderer
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.art = new CardArt(Math.min(8, renderer.capabilities.getMaxAnisotropy()))

    this.camera = new THREE.PerspectiveCamera(40, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 200)
    this.camera.position.copy(CAMERA_HOME)
    this.camera.lookAt(CAMERA_TARGET)

    const scene = this.scene
    scene.background = new THREE.Color(0x09070d)
    scene.fog = new THREE.Fog(0x09070d, 26, 60)

    // ── Lumières : une salle sombre, une table éclairée comme un plateau de jeu télé.
    scene.add(new THREE.HemisphereLight(0xc9c2ff, 0x1a1020, 0.55))
    const key = new THREE.DirectionalLight(0xfff2e0, 2.1)
    key.position.set(-4, 18, 8)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -12
    key.shadow.camera.right = 12
    key.shadow.camera.top = 9
    key.shadow.camera.bottom = -9
    key.shadow.camera.near = 4
    key.shadow.camera.far = 40
    key.shadow.bias = -0.0008
    scene.add(key)
    this.centerLight = new THREE.PointLight(0xffffff, 26, 16, 1.6)
    this.centerLight.position.set(0, 5.5, 0)
    scene.add(this.centerLight)
    this.seatLight = new THREE.PointLight(0xff3d7f, 30, 9, 1.8)
    this.seatLight.position.set(0, 3, 6)
    scene.add(this.seatLight)

    // ── La table : feutrine sombre, bordure laquée et liseré lumineux à la couleur du jeu.
    const felt = new THREE.Mesh(
      new THREE.CylinderGeometry(TABLE_RX, TABLE_RX, 0.4, 96, 1),
      new THREE.MeshStandardMaterial({ map: this.feltTexture(), roughness: 0.95, metalness: 0 }),
    )
    felt.scale.z = TABLE_RZ / TABLE_RX
    felt.position.y = -0.2
    felt.receiveShadow = true
    scene.add(felt)

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(TABLE_RX + 0.25, 0.42, 20, 128),
      new THREE.MeshStandardMaterial({ color: 0x1b1622, roughness: 0.35, metalness: 0.4 }),
    )
    rim.rotation.x = Math.PI / 2
    rim.scale.y = (TABLE_RZ + 0.25) / (TABLE_RX + 0.25)
    rim.position.y = 0.02
    rim.castShadow = true
    scene.add(rim)

    this.rimGlow = new THREE.Mesh(
      new THREE.TorusGeometry(TABLE_RX - 0.12, 0.07, 10, 160),
      new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
    )
    this.rimGlow.rotation.x = Math.PI / 2
    this.rimGlow.scale.y = (TABLE_RZ - 0.12) / (TABLE_RX - 0.12)
    this.rimGlow.position.y = 0.06
    scene.add(this.rimGlow)

    // Sol de la salle, très sombre, pour que la table flotte dans la lumière.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -3.5
    floor.receiveShadow = true
    scene.add(floor)

    // ── Anneau du sens de jeu : des chevrons qui tournent autour de la défausse.
    this.ringMat = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    this.ring = new THREE.Group()
    const chevron = new THREE.Shape()
    chevron.moveTo(-0.32, -0.22)
    chevron.lineTo(0.08, 0)
    chevron.lineTo(-0.32, 0.22)
    chevron.lineTo(-0.16, 0)
    chevron.closePath()
    const chevronGeo = new THREE.ShapeGeometry(chevron)
    const CHEVRONS = 14
    for (let i = 0; i < CHEVRONS; i++) {
      const a = (i / CHEVRONS) * Math.PI * 2
      const m = new THREE.Mesh(chevronGeo, this.ringMat)
      m.rotation.x = -Math.PI / 2
      m.rotation.z = -a - Math.PI / 2
      m.position.set(Math.cos(a) * RING_R, 0.025, Math.sin(a) * RING_R)
      m.scale.setScalar(1.3)
      this.ring.add(m)
    }
    const track = new THREE.Mesh(
      new THREE.RingGeometry(RING_R - 0.05, RING_R + 0.05, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }),
    )
    track.rotation.x = -Math.PI / 2
    track.position.y = 0.02
    scene.add(track)
    this.ring.position.copy(new THREE.Vector3(0, 0, -0.1))
    scene.add(this.ring)

    // ── Halo du joueur dont c'est le tour.
    this.seatHalo = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 48),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: 0xff3d7f, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.seatHalo.rotation.x = -Math.PI / 2
    this.seatHalo.position.y = 0.03
    scene.add(this.seatHalo)

    // ── La pioche : une seule plaque dont l'épaisseur suit le nombre de cartes.
    this.deck = new THREE.Mesh(this.cardGeo, [this.art.back, this.art.back, this.art.edge])
    this.deck.rotation.set(-Math.PI / 2, 0, 0.08)
    this.deck.castShadow = true
    this.deck.receiveShadow = true
    scene.add(this.deck)
    this.setDeckCount(108)

    // ── Particules d'action + poussière qui flotte dans la lumière.
    scene.add(this.particles.points)
    this.dust = this.makeDust()
    scene.add(this.dust)

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.loop()
  }

  // ─── Construction ─────────────────────────────────────────────────────────

  private feltTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = c.height = 1024
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(512, 512, 60, 512, 512, 560)
    g.addColorStop(0, '#2a2140')
    g.addColorStop(0.55, '#1a1428')
    g.addColorStop(1, '#0e0b16')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 1024)
    // Grain de feutrine.
    const img = ctx.getImageData(0, 0, 1024, 1024)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
    // Le logo du jeu imprimé dans la feutrine, très discret.
    ctx.save()
    ctx.translate(512, 512)
    ctx.rotate(-0.35)
    ctx.font = 'italic 900 150px "Archivo Variable", "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    ctx.fillText('UNO', 0, 250)
    ctx.restore()
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  private makeDust(): THREE.Points {
    const n = 220
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30
      pos[i * 3 + 1] = Math.random() * 12
      pos[i * 3 + 2] = (Math.random() - 0.5) * 22
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.09,
      color: 0xd8ccff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: makeGlowTexture(),
    })
    return new THREE.Points(geo, mat)
  }

  private setDeckCount(n: number) {
    const layers = Math.max(1, Math.min(n, 108))
    this.deck.visible = n > 0
    this.deck.scale.set(CENTER_SCALE, CENTER_SCALE, (layers * DECK_LAYER) / CARD_T)
    this.deck.position.set(DECK_POS.x, (layers * DECK_LAYER) / 2, DECK_POS.z)
  }

  private deckTop(): THREE.Vector3 {
    return new THREE.Vector3(DECK_POS.x, this.deck.position.y * 2 + 0.01, DECK_POS.z)
  }

  private newCard(face: THREE.Material | null): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cardGeo, [face ?? this.art.back, this.art.back, this.art.edge])
    mesh.castShadow = true
    return mesh
  }

  private faceFor(card: TableCard): THREE.Material {
    return this.art.face(card, card.color === 'wild' ? (card.chosenColor ?? null) : null)
  }

  // ─── Sièges ───────────────────────────────────────────────────────────────

  private layoutSeats(order: string[], members: TableMember[]) {
    const ids = order.filter((id) => members.some((m) => m.id === id))
    for (const [id, seat] of this.seats) {
      if (!ids.includes(id)) {
        this.scene.remove(seat.fan, seat.avatar, seat.label.sprite)
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
        const fan = new THREE.Group()
        const hand = new THREE.Group()
        hand.rotation.x = -0.15
        fan.add(hand)
        const avatarMat = new THREE.SpriteMaterial({
          map: makeAvatarTexture(member.pseudo, member.color, member.photoUrl, () => {}),
          transparent: true,
          depthTest: false,
        })
        const avatar = new THREE.Sprite(avatarMat)
        avatar.renderOrder = 14
        const label = new SeatLabel()
        this.scene.add(fan, avatar, label.sprite)
        seat = { id, angle, pos, fan, hand, cards: [], shown: 0, avatar, label, member }
        this.seats.set(id, seat)
      }
      seat.angle = angle
      seat.pos = pos
      seat.member = member
      seat.fan.position.copy(pos)
      // L'éventail fait face à la caméra (et non au centre) : vu de la TV, chaque main se lit comme
      // une main de cartes, même sur les côtés de la table où elle était vue par la tranche.
      seat.fan.lookAt(CAMERA_HOME.x * 0.5 + pos.x * 0.5, CAMERA_HOME.y * 0.35, CAMERA_HOME.z)
      // Plus le siège est proche de la caméra, plus son avatar doit monter pour ne pas masquer la
      // table ; au fond, il reste près des cartes.
      // Avatar au-dessus de la main, étiquette entre les deux. Côté caméra, on recule l'ensemble
      // derrière la main pour ne pas la masquer.
      const near = (Math.sin(angle) + 1) / 2
      const back = near * 0.9
      seat.avatar.position.set(pos.x, 2.55 + near * 0.15, pos.z - back)
      seat.avatar.scale.setScalar(1.05)
      seat.label.sprite.position.set(pos.x, 1.82 + near * 0.15, pos.z - back + 0.15)
      seat.label.sprite.scale.set(2.5, 0.625, 1)
    })
  }

  /** Dispose l'éventail d'un siège pour `n` cartes (dos visibles des deux côtés). */
  private setFan(seat: Seat, n: number) {
    seat.shown = Math.max(0, n)
    const visible = Math.min(seat.shown, MAX_FAN)
    while (seat.cards.length < visible) {
      const card = this.newCard(this.art.back)
      card.scale.setScalar(FAN_SCALE)
      seat.hand.add(card)
      seat.cards.push(card)
    }
    while (seat.cards.length > visible) seat.hand.remove(seat.cards.pop()!)
    const step = visible > 1 ? Math.min(0.17, 1.15 / visible) : 0
    seat.cards.forEach((card, k) => {
      const a = (k - (visible - 1) / 2) * step
      // Rotation autour du bas de la carte : l'éventail s'ouvre comme dans une main.
      const h = (CARD_H * FAN_SCALE) / 2
      card.position.set(Math.sin(a) * h + a * 0.5, Math.cos(a) * h + 0.05, k * 0.004)
      card.rotation.set(0, 0, -a)
    })
  }

  private seatCardPose(seat: Seat): Pose {
    const ref = seat.cards[Math.floor(seat.cards.length / 2)]
    if (ref) return { pos: ref.getWorldPosition(new THREE.Vector3()), quat: ref.getWorldQuaternion(new THREE.Quaternion()), scale: FAN_SCALE }
    seat.fan.updateMatrixWorld()
    return { pos: seat.pos.clone().setY(0.7), quat: seat.hand.getWorldQuaternion(new THREE.Quaternion()), scale: FAN_SCALE }
  }

  private deckPose(): Pose {
    return { pos: this.deckTop(), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.08)), scale: CENTER_SCALE }
  }

  /** Où faire apparaître un texte qui concerne un siège : entre le siège et le centre, au-dessus
   * de la table. Directement au-dessus d'un siège du fond, il sortait par le haut de l'écran. */
  private textAnchor(seat: Seat): THREE.Vector3 {
    return seat.pos.clone().multiplyScalar(0.55).setY(3)
  }

  private refreshLabels() {
    const s = this.state
    if (!s) return
    for (const seat of this.seats.values()) {
      seat.label.draw(seat.member.pseudo, s.handCounts[seat.id] ?? seat.shown, {
        active: s.phase === 'playing' && s.currentId === seat.id,
        uno: s.unoSafeIds.includes(seat.id) && (s.handCounts[seat.id] ?? 0) <= 2,
        exposed: s.exposed === seat.id,
      })
    }
  }

  // ─── Défausse ─────────────────────────────────────────────────────────────

  private discardPose(card: TableCard, layer: number): Pose {
    const r = hash(card.id)
    const r2 = hash(card.id + 'b')
    const pos = new THREE.Vector3(DISCARD_POS.x + (r - 0.5) * 0.6, 0.02 + layer * 0.02, DISCARD_POS.z + (r2 - 0.5) * 0.5)
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (r - 0.5) * 1.1))
    return { pos, quat, scale: CENTER_SCALE }
  }

  /** Place la défausse sans animation (connexion en cours de partie, remélange). */
  private placeDiscards(cards: TableCard[]) {
    const keep = new Set(cards.map((c) => c.id))
    for (const [id, mesh] of this.discard) {
      if (!keep.has(id)) {
        this.scene.remove(mesh)
        this.discard.delete(id)
      }
    }
    cards.forEach((card, i) => {
      let mesh = this.discard.get(card.id)
      if (!mesh) {
        mesh = this.newCard(this.faceFor(card))
        this.discard.set(card.id, mesh)
        this.scene.add(mesh)
      }
      ;(mesh.material as THREE.Material[])[0] = this.faceFor(card)
      const pose = this.discardPose(card, i)
      mesh.position.copy(pose.pos)
      mesh.quaternion.copy(pose.quat)
      mesh.scale.setScalar(CENTER_SCALE)
      mesh.receiveShadow = true
    })
  }

  // ─── Animations ───────────────────────────────────────────────────────────

  private fly(
    mesh: THREE.Object3D,
    from: Pose,
    to: Pose,
    opts: { duration?: number; height?: number; spin?: number; delay?: number } = {},
  ): Promise<void> {
    const s0 = from.scale ?? 1
    const s1 = to.scale ?? 1
    const mid = from.pos.clone().lerp(to.pos, 0.5)
    mid.y += opts.height ?? 3.2
    const spinAxis = new THREE.Vector3(0, 1, 0)
    const spin = opts.spin ?? 0
    const q = new THREE.Quaternion()
    const qs = new THREE.Quaternion()
    mesh.position.copy(from.pos)
    mesh.quaternion.copy(from.quat)
    mesh.scale.setScalar(s0)
    mesh.visible = true
    return this.tweens.add(
      opts.duration ?? 620,
      (t) => {
        const a = 1 - t
        mesh.position.set(
          a * a * from.pos.x + 2 * a * t * mid.x + t * t * to.pos.x,
          a * a * from.pos.y + 2 * a * t * mid.y + t * t * to.pos.y,
          a * a * from.pos.z + 2 * a * t * mid.z + t * t * to.pos.z,
        )
        q.slerpQuaternions(from.quat, to.quat, t)
        qs.setFromAxisAngle(spinAxis, spin * (1 - t))
        mesh.quaternion.copy(qs.multiply(q))
        mesh.scale.setScalar(s0 + (s1 - s0) * t)
      },
      { delay: opts.delay, ease: ease.inOutCubic },
    )
  }

  private popText(text: string, color: string, at: THREE.Vector3, height = 1.5, hold = 1100) {
    const sprite = makeTextSprite(text, color, height)
    const base = sprite.scale.clone()
    sprite.position.copy(at)
    this.scene.add(sprite)
    sprite.scale.setScalar(0.001)
    void this.tweens
      .add(420, (t) => sprite.scale.copy(base).multiplyScalar(Math.max(0.001, t)), { ease: ease.outBack })
      .then(() => this.tweens.wait(hold))
      .then(() =>
        this.tweens.add(380, (t) => {
          sprite.material.opacity = 1 - t
          sprite.position.y = at.y + t * 0.8
        }),
      )
      .then(() => {
        this.scene.remove(sprite)
        disposeSprite(sprite)
      })
  }

  private shockwave(at: THREE.Vector3, color: THREE.ColorRepresentation, radius = 7) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 96), mat)
    ring.rotation.x = -Math.PI / 2
    ring.position.copy(at).setY(0.04)
    ring.scale.z = TABLE_RZ / TABLE_RX
    this.scene.add(ring)
    void this.tweens
      .add(900, (t) => {
        const s = 0.5 + t * radius
        ring.scale.set(s, s, 1)
        mat.opacity = 0.9 * (1 - t)
      }, { ease: ease.outCubic })
      .then(() => {
        this.scene.remove(ring)
        ring.geometry.dispose()
        mat.dispose()
      })
  }

  private colorOf(card: TableCard): string {
    if (card.color === 'wild') return card.chosenColor ? UNO_HEX[card.chosenColor] : '#ffffff'
    return UNO_HEX[card.color as PlayColor]
  }

  /** Une carte quitte la main de `seat` et vient se poser sur la défausse. */
  private async animatePlay(seat: Seat | undefined, card: TableCard, layer: number, delay: number) {
    const mesh = this.newCard(this.faceFor(card))
    // Invisible jusqu'au départ : une carte en attente (décalée) restait sinon plantée au centre.
    mesh.visible = false
    this.scene.add(mesh)
    this.discard.set(card.id, mesh)
    const from = seat ? this.seatCardPose(seat) : this.deckPose()
    if (seat) this.setFan(seat, seat.shown - 1)
    const to = this.discardPose(card, layer)
    // Retournement : la carte part dos visible et arrive face visible ; le demi-tour la montre.
    await this.fly(mesh, from, to, { duration: 640, height: 3.4, spin: Math.PI * 1.5, delay })
    mesh.receiveShadow = true
    const col = this.colorOf(card)
    this.particles.emit(to.pos.clone().setY(0.3), { count: 70, color: [col, '#ffffff'], speed: 6, up: 2.5, size: 0.4, life: 0.9 })
    this.shake = Math.max(this.shake, 0.12)
    this.sound('vote')

    if (card.value === 'wild4' || card.value === 'draw2') {
      this.popText(card.value === 'wild4' ? '+4' : '+2', col, to.pos.clone().setY(2.6), 1.9, 600)
      this.shake = 0.35
    }
    if (card.color === 'wild') {
      this.shockwave(to.pos, col, 9)
      this.particles.emit(to.pos.clone().setY(0.4), { count: 160, color: [UNO_HEX.red, UNO_HEX.yellow, UNO_HEX.green, UNO_HEX.blue], speed: 9, up: 4, size: 0.5, life: 1.4 })
    }
    if (card.value === 'reverse') this.animateReverse()
  }

  /** `n` cartes partent de la pioche vers `seat`. */
  private async animateDraw(seat: Seat, n: number, delay: number, penalty: boolean) {
    const flights: Promise<void>[] = []
    for (let k = 0; k < n; k++) {
      const mesh = this.newCard(this.art.back)
      mesh.visible = false
      this.scene.add(mesh)
      const from = this.deckPose()
      flights.push(
        this.tweens.wait(delay + k * 150).then(async () => {
          const to = this.seatCardPose(seat)
          await this.fly(mesh, from, to, { duration: 520, height: 2.6, spin: penalty ? Math.PI * 2 : Math.PI * 0.5 })
          this.scene.remove(mesh)
          this.setFan(seat, seat.shown + 1)
          this.refreshLabels()
          if (penalty) {
            this.particles.emit(to.pos, { count: 26, color: [UNO_HEX.red, '#ff8a8a'], speed: 3, up: 1.5, size: 0.35, life: 0.7 })
            this.shake = Math.max(this.shake, 0.18)
          }
          this.sound('tick')
        }),
      )
    }
    await Promise.all(flights)
  }

  private animateReverse() {
    this.targetRingSpeed = -this.targetRingSpeed
    this.ringSpeed = this.targetRingSpeed * 8
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      this.particles.emit(new THREE.Vector3(Math.cos(a) * RING_R, 0.3, Math.sin(a) * RING_R - 0.1), {
        count: 20,
        color: [`#${this.targetColor.getHexString()}`, '#ffffff'],
        speed: 3,
        up: 3,
        size: 0.32,
        life: 0.9,
      })
    }
    this.popText('INVERSION', `#${this.targetColor.getHexString()}`, new THREE.Vector3(0, 2.6, -0.1), 1.3, 500)
  }

  private deal(order: string[], counts: Record<string, number>) {
    // Distribution d'ouverture : une carte par joueur, tour après tour, comme à une vraie table.
    const target: Record<string, number> = {}
    for (const id of order) target[id] = counts[id] ?? 7
    for (const seat of this.seats.values()) this.setFan(seat, 0)
    const rounds = Math.max(...order.map((id) => target[id]))
    let k = 0
    for (let r = 0; r < rounds; r++) {
      for (const id of order) {
        const seat = this.seats.get(id)
        if (!seat || r >= target[id]) continue
        const delay = 300 + k * 75
        k++
        const mesh = this.newCard(this.art.back)
        mesh.visible = false
        this.scene.add(mesh)
        void this.tweens.wait(delay).then(async () => {
          mesh.visible = true
          await this.fly(mesh, this.deckPose(), this.seatCardPose(seat), { duration: 420, height: 2, spin: Math.PI })
          this.scene.remove(mesh)
          this.setFan(seat, seat.shown + 1)
          if (k % 3 === 0) this.sound('tick')
        })
      }
    }
  }

  // ─── Synchronisation avec l'état du serveur ───────────────────────────────

  sync(next: TableState, members: TableMember[]) {
    if (this.disposed) return
    const prev = this.state
    this.state = next
    this.layoutSeats(next.order, members)
    this.targetColor.set(UNO_HEX[next.currentColor])
    this.targetRingSpeed = 0.3 * next.direction
    if (!prev) this.ringSpeed = this.targetRingSpeed
    this.setDeckCount(next.deckCount)

    // Premier instantané : on construit la table telle quelle (ou on distribue si la partie
    // démarre à peine), sans rejouer d'historique.
    if (!prev) {
      for (const c of next.discards) this.seenDiscards.add(c.id)
      this.lastSeq = next.lastEvent?.seq ?? 0
      if (next.phase === 'intro') this.deal(next.order, next.handCounts)
      else for (const seat of this.seats.values()) this.setFan(seat, next.handCounts[seat.id] ?? 0)
      this.placeDiscards(next.discards)
      this.color.copy(this.targetColor)
      this.refreshLabels()
      if (next.phase === 'ended' && next.winner) this.startCelebration(next.winner)
      return
    }

    // 1. Nouvelles cartes sur la défausse → elles partent de la main de leur joueur.
    const fresh = next.discards.filter((c) => !this.seenDiscards.has(c.id))
    const counts = { ...next.handCounts }
    let playDelay = 0
    let actorDrop: string | null = null
    fresh.forEach((card) => {
      this.seenDiscards.add(card.id)
      const ev = next.lastEvent
      const byEvent = ev?.type === 'play' || ev?.type === 'win' ? ev.memberId : null
      const shrunk = next.order.find((id) => (counts[id] ?? 0) < (this.seats.get(id)?.shown ?? 0))
      const actor = byEvent ?? shrunk ?? null
      actorDrop = actor
      const layer = next.discards.findIndex((c) => c.id === card.id)
      void this.animatePlay(actor ? this.seats.get(actor) : undefined, card, layer, playDelay)
      playDelay += 250
    })
    // Les cartes qui ont quitté la défausse (pioche remélangée) disparaissent sans animation.
    const keep = new Set(next.discards.map((c) => c.id))
    for (const [id, mesh] of this.discard) {
      if (!keep.has(id)) {
        this.scene.remove(mesh)
        this.discard.delete(id)
      }
    }
    // Reteinte du joker du dessus si sa couleur vient d'être annoncée.
    next.discards.forEach((card) => {
      const mesh = this.discard.get(card.id)
      if (mesh && card.color === 'wild') (mesh.material as THREE.Material[])[0] = this.faceFor(card)
    })

    // 2. Mains qui grossissent → cartes depuis la pioche (après la carte jouée, s'il y en a une).
    const ev = next.lastEvent
    const newEvent = ev && ev.seq !== this.lastSeq
    for (const seat of this.seats.values()) {
      const target = counts[seat.id] ?? 0
      const diff = target - seat.shown
      if (diff > 0) {
        const penalty = !!newEvent && ev!.type === 'penalty' && ev!.memberId === seat.id
        const hit = fresh.some((c) => c.value === 'draw2' || c.value === 'wild4')
        void this.animateDraw(seat, diff, fresh.length ? 700 : 0, penalty || hit)
        if (hit && seat.id !== actorDrop) {
          this.particles.emit(seat.pos.clone().setY(1.2), { count: 60, color: [UNO_HEX.red, '#ffffff'], speed: 5, up: 3, size: 0.42, life: 1 })
        }
      } else if (diff < 0 && seat.id !== actorDrop) {
        this.setFan(seat, target)
      }
    }

    // 3. Événements nommés.
    if (newEvent && ev) {
      this.lastSeq = ev.seq
      const seat = this.seats.get(ev.memberId)
      const above = seat ? this.textAnchor(seat) : new THREE.Vector3(0, 3, 0)
      if (ev.type === 'uno') {
        this.popText('UNO !', UNO_HEX.yellow, above, 2, 900)
        if (seat) this.particles.emit(seat.pos.clone().setY(1.6), { count: 120, color: [UNO_HEX.yellow, '#fff3b0', UNO_HEX.red], speed: 7, up: 5, size: 0.45, life: 1.3 })
        this.sound('reveal')
      } else if (ev.type === 'penalty') {
        this.popText('CONTRE-UNO !', UNO_HEX.red, above, 1.5, 900)
        this.sound('lose')
      } else if (ev.type === 'skip') {
        this.popText('PASSE', '#F2EFE9', above, 1.3, 600)
      } else if (ev.type === 'play') {
        const card = next.discards[next.discards.length - 1]
        if (card?.value === 'skip') {
          // Le joueur sauté est celui qui suivait l'auteur de la carte.
          const i = next.order.indexOf(ev.memberId)
          const n = next.order.length
          const skipped = this.seats.get(next.order[(((i + next.direction) % n) + n) % n])
          if (skipped) void this.tweens.wait(650).then(() => this.popText('PASSE !', UNO_HEX[next.currentColor], this.textAnchor(skipped), 1.5, 700))
        }
      }
    }

    // 4. Changement de couleur → onde depuis la défausse.
    if (prev.currentColor !== next.currentColor && !fresh.some((c) => c.color === 'wild')) {
      this.shockwave(DISCARD_POS, UNO_HEX[next.currentColor], 6)
    }

    if (next.phase === 'ended' && next.winner && prev.phase !== 'ended') {
      void this.tweens.wait(700).then(() => this.startCelebration(next.winner!))
    }
    this.refreshLabels()
  }

  private startCelebration(winnerId: string) {
    const seat = this.seats.get(winnerId)
    if (!seat) return
    this.sound('win')
    // Caméra : un travelling mesuré vers le gagnant — on garde toute la table dans le cadre, la
    // fête se lit sur les visages de tous, pas seulement du sien.
    this.cameraGoal = {
      pos: CAMERA_HOME.clone().lerp(new THREE.Vector3(seat.pos.x * 0.9, 9.5, seat.pos.z + 8.5), 0.45),
      target: seat.pos.clone().multiplyScalar(0.5).setY(1),
    }
    this.popText('VICTOIRE !', '#D9A441', this.textAnchor(seat).setY(3.6), 1.6, 4000)
    let n = 0
    this.celebrate = window.setInterval(() => {
      if (this.disposed || n++ > 14) {
        if (this.celebrate) window.clearInterval(this.celebrate)
        this.celebrate = null
        return
      }
      const p = seat.pos.clone().multiplyScalar(0.6).add(new THREE.Vector3((Math.random() - 0.5) * 6, 0.5, (Math.random() - 0.5) * 3))
      this.particles.emit(p, {
        count: 140,
        color: [UNO_HEX.red, UNO_HEX.yellow, UNO_HEX.green, UNO_HEX.blue, '#ffffff'],
        speed: 8,
        up: 9,
        spread: 0.9,
        gravity: 6,
        size: 0.5,
        life: 2,
      })
    }, 520)
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.managed.resize()
    this.camera.aspect = w / h
    // Écran plus étroit que 16/9 : on recule un peu pour garder toute la table dans le cadre.
    this.camera.fov = w / h < 1.6 ? 40 * (1.6 / (w / h)) ** 0.8 : 40
    this.camera.updateProjectionMatrix()
    this.particles.setPixelScale(this.managed.renderer.domElement.height)
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    // Plein régime pendant l'action, demi-cadence au repos (la table ne fait alors que respirer).
    const active = this.tweens.busy || this.particles.active || this.shake > 0.01 || this.celebrate !== null
    if (!this.shouldRender(now, active) || !this.managed.canRender()) return
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now

    this.tweens.tick(now)
    this.particles.tick(dt)

    // Couleur de jeu : bordure, anneau, lumière centrale glissent vers la nouvelle teinte.
    this.color.lerp(this.targetColor, 1 - Math.exp(-dt * 4))
    ;(this.rimGlow.material as THREE.MeshBasicMaterial).color.copy(this.color)
    this.ringMat.color.copy(this.color)
    this.centerLight.color.copy(this.color).lerp(new THREE.Color(0xffffff), 0.55)
    this.ringSpeed += (this.targetRingSpeed - this.ringSpeed) * (1 - Math.exp(-dt * 1.6))
    this.ring.rotation.y -= this.ringSpeed * dt
    ;(this.rimGlow.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(now / 600) * 0.2

    // Halo du joueur dont c'est le tour : il glisse d'un siège à l'autre.
    const cur = this.state?.phase === 'playing' ? this.state.currentId : null
    const seat = cur ? this.seats.get(cur) : null
    this.seatHalo.visible = !!seat
    if (seat) {
      if (this.haloSeat !== seat.id) {
        if (this.haloSeat === null) this.haloPos.copy(seat.pos)
        this.haloSeat = seat.id
        ;(this.seatHalo.material as THREE.MeshBasicMaterial).color.set(seat.member.color)
        this.seatLight.color.set(seat.member.color)
      }
      this.haloPos.lerp(seat.pos, 1 - Math.exp(-dt * 7))
      this.seatHalo.position.set(this.haloPos.x, 0.03, this.haloPos.z)
      const pulse = 1 + Math.sin(now / 280) * 0.08
      this.seatHalo.scale.set(pulse, pulse, 1)
      this.seatLight.position.set(this.haloPos.x * 0.85, 3.2, this.haloPos.z * 0.85)
      this.seatLight.intensity = 26 + Math.sin(now / 280) * 6
    } else {
      this.seatLight.intensity = 0
    }

    // Poussière en suspension.
    const dust = this.dust.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < dust.count; i++) {
      let y = dust.getY(i) + dt * 0.18
      if (y > 12) y = 0
      dust.setY(i, y)
    }
    dust.needsUpdate = true

    // Caméra : respiration lente + secousse sur les coups forts + travelling de victoire.
    this.camera.position.lerp(this.cameraGoal.pos, 1 - Math.exp(-dt * 1.4))
    this.cameraTarget.lerp(this.cameraGoal.target, 1 - Math.exp(-dt * 1.4))
    const sway = new THREE.Vector3(Math.sin(now / 4200) * 0.35, Math.sin(now / 3100) * 0.15, 0)
    const jolt = new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0)
    this.shake *= Math.exp(-dt * 6)
    const base = this.camera.position.clone()
    this.camera.position.add(sway).add(jolt)
    this.camera.lookAt(this.cameraTarget)
    this.managed.renderer.render(this.scene, this.camera)
    this.camera.position.copy(base)
  }

  get fatal() {
    return this.managed.isFatal()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    if (this.celebrate) window.clearInterval(this.celebrate)
    this.resizeObserver.disconnect()
    this.tweens.flush()
    for (const seat of this.seats.values()) seat.label.dispose()
    this.particles.dispose()
    disposeScene(this.scene)
    this.art.dispose()
    this.cardGeo.dispose()
    this.managed.dispose()
  }
}
