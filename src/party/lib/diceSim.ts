import * as THREE from 'three'

/**
 * Simulation physique de dés, calculée d'avance puis rejouée image par image.
 *
 * Un dé truqué par animation (une rotation qui ralentit) se voit tout de suite : il ne rebondit
 * pas, ne bute pas sur les bords, ne bascule pas d'une arête sur une face. Ici chaque dé est un
 * vrai solide (impulsions aux coins contre le sol et les parois, frottement, rebonds entre dés),
 * simulé à 240 Hz et enregistré à 60 images par seconde.
 *
 * Le résultat est imposé par le serveur, pas par la physique : `planRoll` rejoue le lancer avec
 * d'autres conditions initiales jusqu'à ce que la face voulue finisse d'elle-même en haut. Le
 * spectateur voit un lancer physique honnête qui tombe pile sur le tirage du serveur.
 *
 * Déterministe pour une graine donnée : deux écrans qui rejouent le même lancer voient le même roulé.
 */

export interface DieInit {
  pos: THREE.Vector3
  vel: THREE.Vector3
  spin: THREE.Vector3
  quat?: THREE.Quaternion
}

export interface DiceArena {
  /** Demi-largeur intérieure (x) et demi-profondeur intérieure (z) du bac. */
  halfX: number
  halfZ: number
  floorY?: number
}

export interface SimImpact {
  /** Instant de l'impact, en secondes depuis le lâcher. */
  t: number
  die: number
  strength: number
  surface: 'floor' | 'wall' | 'die'
  pos: THREE.Vector3
}

export interface SimResult {
  fps: number
  frames: number
  dice: number
  /** frames × dés × 7 : px, py, pz, qx, qy, qz, qw. */
  data: Float32Array
  impacts: SimImpact[]
  /** Pour chaque dé, l'axe local du solide tourné vers le haut au repos. */
  upAxis: THREE.Vector3[]
  /** Durée totale, en secondes. */
  duration: number
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normale locale de chaque valeur sur l'habillage (ordre des faces d'une BoxGeometry :
 * +x, −x, +y, −y, +z, −z → 3, 4, 1, 6, 2, 5 ; les faces opposées font toujours 7). */
export const FACE_VALUES = [3, 4, 1, 6, 2, 5] as const
export const FACE_NORMALS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(0, 1, 0),
  6: new THREE.Vector3(0, -1, 0),
  3: new THREE.Vector3(1, 0, 0),
  4: new THREE.Vector3(-1, 0, 0),
  2: new THREE.Vector3(0, 0, 1),
  5: new THREE.Vector3(0, 0, -1),
}

/** Rotation de l'habillage qui amène la face `value` sur l'axe `upAxis` du solide. Toujours une
 * symétrie du cube (quart ou demi-tour autour d'un axe), donc invisible pendant le roulé. */
export function faceRotation(value: number, upAxis: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(FACE_NORMALS[value] ?? FACE_NORMALS[1], upAxis)
}

const AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
]
const UP = new THREE.Vector3(0, 1, 0)

function upAxisOf(q: THREE.Quaternion): THREE.Vector3 {
  let best = AXES[2]
  let bestY = -Infinity
  const v = new THREE.Vector3()
  for (const a of AXES) {
    const y = v.copy(a).applyQuaternion(q).y
    if (y > bestY) {
      bestY = y
      best = a
    }
  }
  return best.clone()
}

interface Body {
  p: THREE.Vector3
  v: THREE.Vector3
  q: THREE.Quaternion
  w: THREE.Vector3
  asleep: boolean
  still: number
  lastImpact: number
  onFloor: number
}

const SUBSTEPS_PER_FRAME = 4
const FPS = 60
const DT = 1 / (FPS * SUBSTEPS_PER_FRAME)
const MAX_SECONDS = 6
const SETTLE_FRAMES = 8

export function simulateDice(inits: DieInit[], arena: DiceArena, size = 1): SimResult {
  const floorY = arena.floorY ?? 0
  const half = size / 2
  // Coins légèrement rentrés : les arêtes du dé sont arrondies, il roule mieux qu'un cube vif.
  const hc = half * 0.9
  const corners: THREE.Vector3[] = []
  for (const x of [-hc, hc]) for (const y of [-hc, hc]) for (const z of [-hc, hc]) corners.push(new THREE.Vector3(x, y, z))
  const gravity = 40 * size
  const invMass = 1
  const invI = 6 / (size * size)

  const bodies: Body[] = inits.map((d) => ({
    p: d.pos.clone(),
    v: d.vel.clone(),
    q: (d.quat ?? new THREE.Quaternion()).clone(),
    w: d.spin.clone(),
    asleep: false,
    still: 0,
    lastImpact: -1,
    onFloor: 0,
  }))

  const frames: number[] = []
  const impacts: SimImpact[] = []
  const record = () => {
    for (const b of bodies) frames.push(b.p.x, b.p.y, b.p.z, b.q.x, b.q.y, b.q.z, b.q.w)
  }

  const r = new THREE.Vector3()
  const pc = new THREE.Vector3()
  const vc = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const rn = new THREE.Vector3()
  const vt = new THREE.Vector3()
  const dq = new THREE.Quaternion()

  const planes: { n: THREE.Vector3; d: number; surface: 'floor' | 'wall'; e: number; mu: number }[] = [
    { n: new THREE.Vector3(0, 1, 0), d: floorY, surface: 'floor', e: 0.38, mu: 0.36 },
    { n: new THREE.Vector3(1, 0, 0), d: -arena.halfX, surface: 'wall', e: 0.5, mu: 0.25 },
    { n: new THREE.Vector3(-1, 0, 0), d: -arena.halfX, surface: 'wall', e: 0.5, mu: 0.25 },
    { n: new THREE.Vector3(0, 0, 1), d: -arena.halfZ, surface: 'wall', e: 0.5, mu: 0.25 },
    { n: new THREE.Vector3(0, 0, -1), d: -arena.halfZ, surface: 'wall', e: 0.5, mu: 0.25 },
  ]

  record()
  let t = 0
  let step = 0
  const maxSteps = Math.round(MAX_SECONDS / DT)
  for (; step < maxSteps; step++) {
    t = step * DT
    for (const b of bodies) {
      if (b.asleep) continue
      b.v.y -= gravity * DT
      b.p.addScaledVector(b.v, DT)
      dq.set(b.w.x * DT * 0.5, b.w.y * DT * 0.5, b.w.z * DT * 0.5, 0).multiply(b.q)
      b.q.set(b.q.x + dq.x, b.q.y + dq.y, b.q.z + dq.z, b.q.w + dq.w).normalize()
      b.onFloor = 0
    }

    // Contacts coins / parois : impulsions séquentielles, deux passes.
    for (let iter = 0; iter < 2; iter++) {
      bodies.forEach((b, bi) => {
        if (b.asleep) return
        for (const plane of planes) {
          let maxPen = 0
          for (const c of corners) {
            r.copy(c).applyQuaternion(b.q)
            pc.copy(b.p).add(r)
            const pen = plane.d - plane.n.dot(pc)
            if (pen <= 0) continue
            if (plane.surface === 'floor' && iter === 0) b.onFloor++
            maxPen = Math.max(maxPen, pen)
            vc.copy(b.w).cross(r).add(b.v)
            const vn = vc.dot(plane.n)
            if (vn >= 0) continue
            rn.copy(r).cross(plane.n)
            const kN = invMass + invI * rn.lengthSq()
            const e = -vn > 1.4 ? plane.e : 0
            const j = (-(1 + e) * vn) / kN
            b.v.addScaledVector(plane.n, j * invMass)
            b.w.addScaledVector(rn, invI * j)
            if (iter === 0 && -vn > 1.6 && t - b.lastImpact > 0.045) {
              b.lastImpact = t
              impacts.push({ t, die: bi, strength: Math.min(1, -vn / (14 * size)), surface: plane.surface, pos: pc.clone() })
            }
            // Frottement de Coulomb.
            vc.copy(b.w).cross(r).add(b.v)
            vt.copy(vc).addScaledVector(plane.n, -vc.dot(plane.n))
            const speed = vt.length()
            if (speed > 1e-5) {
              vt.divideScalar(speed)
              tmp.copy(r).cross(vt)
              const kT = invMass + invI * tmp.lengthSq()
              const jt = Math.max(-plane.mu * j, -speed / kT)
              b.v.addScaledVector(vt, jt * invMass)
              b.w.addScaledVector(tmp, invI * jt)
            }
          }
          if (maxPen > 0 && iter === 1) b.p.addScaledVector(plane.n, maxPen)
        }
      })
    }

    // Dés entre eux : sphères englobantes, assez pour qu'ils s'écartent et s'entrechoquent.
    for (let i = 0; i < bodies.length; i++) {
      for (let k = i + 1; k < bodies.length; k++) {
        const a = bodies[i]
        const c = bodies[k]
        if (a.asleep && c.asleep) continue
        tmp.copy(c.p).sub(a.p)
        const dist = tmp.length()
        const minD = size * 1.04
        if (dist >= minD || dist < 1e-6) continue
        tmp.divideScalar(dist)
        const pen = minD - dist
        a.p.addScaledVector(tmp, -pen / 2)
        c.p.addScaledVector(tmp, pen / 2)
        const vr = vc.copy(c.v).sub(a.v).dot(tmp)
        if (vr < -0.08 * size) {
          const j = (-(1 + 0.45) * vr) / 2
          a.v.addScaledVector(tmp, -j)
          c.v.addScaledVector(tmp, j)
          // Un choc entre dés les fait aussi tourner.
          a.w.addScaledVector(rn.set(tmp.z, 0, -tmp.x), j * 1.5)
          c.w.addScaledVector(rn, -j * 1.5)
          a.asleep = c.asleep = false
          a.still = c.still = 0
          if (-vr > 1.6) impacts.push({ t, die: i, strength: Math.min(1, -vr / (14 * size)), surface: 'die', pos: a.p.clone().add(c.p).multiplyScalar(0.5) })
        }
      }
    }

    // Amortissement : l'air, puis la feutrine qui freine un dé qui roule.
    let allAsleep = true
    for (const b of bodies) {
      if (b.asleep) continue
      b.v.multiplyScalar(1 - 0.05 * DT)
      b.w.multiplyScalar(1 - 0.12 * DT)
      if (b.onFloor > 0) {
        b.w.multiplyScalar(1 - 1.5 * DT)
        b.v.x *= 1 - 0.45 * DT
        b.v.z *= 1 - 0.45 * DT
      }
      // À plat sur une face (centre à hauteur d'une demi-arête) et presque immobile. Le contact au
      // repos tremble d'un ou deux coins d'une sous-étape à l'autre : on ne remet le compteur à zéro
      // que sur un vrai mouvement.
      const v2 = b.v.lengthSq()
      const w2 = b.w.lengthSq()
      const flat = b.p.y - floorY < hc * 1.1
      if (flat && v2 < (0.12 * size) ** 2 && w2 < 0.4 ** 2) b.still += DT
      else if (!flat || v2 > (0.3 * size) ** 2 || w2 > 1) b.still = 0
      if (b.still > 0.16) {
        b.asleep = true
        b.v.set(0, 0, 0)
        b.w.set(0, 0, 0)
      } else allAsleep = false
    }

    if ((step + 1) % SUBSTEPS_PER_FRAME === 0) record()
    if (allAsleep) break
  }

  // Mise à plat finale : quelques images pour poser exactement le dé sur sa face (invisible à l'œil
  // quand il est déjà presque à plat, indispensable s'il s'est arrêté calé contre une paroi).
  const upAxis = bodies.map((b) => upAxisOf(b.q))
  const targets = bodies.map((b, i) => {
    const world = upAxis[i].clone().applyQuaternion(b.q)
    const q = new THREE.Quaternion().setFromUnitVectors(world, UP).multiply(b.q)
    const p = b.p.clone()
    p.y = floorY + half
    p.x = THREE.MathUtils.clamp(p.x, -arena.halfX + half, arena.halfX - half)
    p.z = THREE.MathUtils.clamp(p.z, -arena.halfZ + half, arena.halfZ - half)
    return { p, q, p0: b.p.clone(), q0: b.q.clone() }
  })
  for (let f = 1; f <= SETTLE_FRAMES; f++) {
    const k = f / SETTLE_FRAMES
    const s = k * k * (3 - 2 * k)
    bodies.forEach((b, i) => {
      b.p.lerpVectors(targets[i].p0, targets[i].p, s)
      b.q.slerpQuaternions(targets[i].q0, targets[i].q, s)
    })
    record()
  }

  const frameCount = frames.length / (7 * bodies.length)
  return {
    fps: FPS,
    frames: frameCount,
    dice: bodies.length,
    data: new Float32Array(frames),
    impacts,
    upAxis,
    duration: frameCount / FPS,
  }
}

/** Pose d'un dé à l'image `frame` (bornée) d'une simulation. */
export function poseAt(sim: SimResult, die: number, frame: number, pos: THREE.Vector3, quat: THREE.Quaternion) {
  const f = Math.max(0, Math.min(sim.frames - 1, frame))
  const o = (f * sim.dice + die) * 7
  const d = sim.data
  pos.set(d[o], d[o + 1], d[o + 2])
  quat.set(d[o + 3], d[o + 4], d[o + 5], d[o + 6])
}

/** Pose interpolée à l'instant `t` (secondes) : lisse même si la TV saute des images. */
export function poseAtTime(sim: SimResult, die: number, t: number, pos: THREE.Vector3, quat: THREE.Quaternion) {
  const x = Math.max(0, t * sim.fps)
  const f0 = Math.floor(x)
  const k = x - f0
  poseAt(sim, die, f0, pos, quat)
  if (k > 0 && f0 + 1 < sim.frames) {
    const o = ((f0 + 1) * sim.dice + die) * 7
    const d = sim.data
    pos.lerp(_p.set(d[o], d[o + 1], d[o + 2]), k)
    quat.slerp(_q.set(d[o + 3], d[o + 4], d[o + 5], d[o + 6]), k)
  }
}
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()

export interface RollPlan {
  sim: SimResult
  /** Par dé : rotation d'habillage à appliquer au lâcher, ou null si la physique tombe juste. */
  remaps: (THREE.Quaternion | null)[]
}

/**
 * Trouve un lancer qui tombe tout seul sur les valeurs voulues.
 *
 * Plutôt que de repeindre le dé (ses faces sauteraient à l'écran), on rejoue la simulation avec
 * d'autres conditions initiales jusqu'à ce que la face voulue, telle qu'elle est peinte en ce
 * moment, finisse en haut : une chance sur six par essai pour un dé. Si aucun essai ne convient
 * (rare, ou plusieurs dés), on garde le meilleur et on retouche l'habillage des dés restants au
 * lâcher, quand ils tournent trop vite pour qu'on le voie.
 *
 * `make(essai)` fournit les conditions initiales de chaque essai (déterministes pour un essai donné).
 */
export function planRoll(
  values: number[],
  skins: THREE.Quaternion[],
  make: (attempt: number) => DieInit[],
  arena: DiceArena,
  size = 1,
  maxTries = 80,
): RollPlan {
  let best: { sim: SimResult; ok: boolean[] } | null = null
  const n = new THREE.Vector3()
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const sim = simulateDice(make(attempt), arena, size)
    const ok = values.map((v, i) => n.copy(FACE_NORMALS[v] ?? FACE_NORMALS[1]).applyQuaternion(skins[i]).dot(sim.upAxis[i]) > 0.99)
    const score = ok.filter(Boolean).length
    if (!best || score > best.ok.filter(Boolean).length) best = { sim, ok }
    if (score === values.length) break
  }
  const { sim, ok } = best!
  return { sim, remaps: values.map((v, i) => (ok[i] ? null : faceRotation(v, sim.upAxis[i]))) }
}
