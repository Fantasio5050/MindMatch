import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { HORSES, PMU_TRACK_LEN } from './types'
import type { PmuRaceEvent } from './types'
import { computePlayback, horseVisualPosition } from './timeline'

/** Scène 3D du PMU (three.js impératif) : hippodrome nocturne sous projecteurs, 4 chevaux
 * low-poly animés, caméra cinématique qui suit le leader. Chargée en lazy uniquement sur la TV —
 * les téléphones ne téléchargent jamais three.js. */

const STEP_X = 4.6 // longueur d'une case en unités monde
const LANE_Z = 2.3 // écart entre couloirs
const START_X = 0
const FINISH_X = PMU_TRACK_LEN * STEP_X

interface SceneProps {
  /** null / [] tant que la course n'a pas commencé -> mode paddock (chevaux au départ). */
  events: PmuRaceEvent[] | null
  raceStartedAt: number | null
  winnerSuit: number | null
}

function laneZ(suit: number): number {
  return (suit - 1.5) * LANE_Z
}

function makeSymbolSprite(symbol: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(64, 64, 56, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(12, 8, 22, 0.85)'
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.font = 'bold 72px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(symbol, 64, 70)
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  sprite.scale.set(1.5, 1.5, 1)
  return sprite
}

function makeCheckerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 32
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#16121f'
      ctx.fillRect(x * 8, y * 8, 8, 8)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  return tex
}

interface HorseRig {
  group: THREE.Group
  legs: THREE.Object3D[]
  body: THREE.Object3D
  phase: number
}

function makeHorse(color: string, symbol: string): HorseRig {
  const group = new THREE.Group()
  const coat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.7 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x241a30, roughness: 0.8 })
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.45, emissive: new THREE.Color(color).multiplyScalar(0.25) })

  const body = new THREE.Group()

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 0.7), coat)
  torso.position.y = 1.0
  body.add(torso)

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.4), coat)
  neck.position.set(0.75, 1.5, 0)
  neck.rotation.z = -0.5
  body.add(neck)

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.34), coat)
  head.position.set(1.12, 1.82, 0)
  head.rotation.z = -0.25
  body.add(head)

  const earGeo = new THREE.ConeGeometry(0.07, 0.2, 4)
  for (const dz of [-0.1, 0.1]) {
    const ear = new THREE.Mesh(earGeo, dark)
    ear.position.set(0.95, 2.05, dz)
    body.add(ear)
  }

  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.12), dark)
  mane.position.set(0.62, 1.65, 0)
  mane.rotation.z = -0.5
  body.add(mane)

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.14), dark)
  tail.position.set(-0.98, 1.15, 0)
  tail.rotation.z = 0.5
  body.add(tail)

  // Jockey : petit bonhomme à la casaque de la couleur du cheval.
  const jockeyBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), accent)
  jockeyBody.position.set(-0.05, 1.6, 0)
  body.add(jockeyBody)
  const jockeyHead = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.8 }))
  jockeyHead.position.set(-0.05, 1.95, 0)
  body.add(jockeyHead)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), accent)
  cap.position.set(-0.05, 1.98, 0)
  body.add(cap)

  group.add(body)

  const legGeo = new THREE.BoxGeometry(0.16, 0.85, 0.16)
  legGeo.translate(0, -0.425, 0) // pivot à la hanche
  const legs: THREE.Object3D[] = []
  for (const [lx, lz] of [
    [0.62, 0.22],
    [0.62, -0.22],
    [-0.62, 0.22],
    [-0.62, -0.22],
  ]) {
    const leg = new THREE.Mesh(legGeo, coat)
    leg.position.set(lx, 0.85, lz)
    group.add(leg)
    legs.push(leg)
  }

  const sprite = makeSymbolSprite(symbol, color)
  sprite.position.set(0, 3.0, 0)
  group.add(sprite)

  return { group, legs, body, phase: Math.random() * Math.PI * 2 }
}

export default function RaceScene3D({ events, raceStartedAt, winnerSuit }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ events, raceStartedAt, winnerSuit })
  stateRef.current = { events, raceStartedAt, winnerSuit }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0714)
    scene.fog = new THREE.Fog(0x0b0714, 30, 85)

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200)

    // --- Lumières : nuit de gala, projecteurs violets/roses assortis à l'app. ---
    scene.add(new THREE.AmbientLight(0x9988bb, 0.85))
    const moon = new THREE.DirectionalLight(0xbbaaff, 1.5)
    moon.position.set(-10, 25, 15)
    scene.add(moon)
    const glowPink = new THREE.PointLight(0xe879f9, 60, 60)
    glowPink.position.set(FINISH_X, 8, -8)
    scene.add(glowPink)
    const glowPurple = new THREE.PointLight(0x8b5cf6, 60, 60)
    glowPurple.position.set(START_X + 6, 8, 8)
    scene.add(glowPurple)

    // --- Sol + piste. ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 160),
      new THREE.MeshStandardMaterial({ color: 0x101c14, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(FINISH_X / 2, -0.02, 0)
    scene.add(ground)

    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(FINISH_X + 14, LANE_Z * 4 + 1.6),
      new THREE.MeshStandardMaterial({ color: 0x3d2b23, roughness: 1 }),
    )
    track.rotation.x = -Math.PI / 2
    track.position.set(FINISH_X / 2, 0, 0)
    scene.add(track)

    // Lignes de rangées (cases) + rails latéraux.
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x6b5545 })
    for (let step = 0; step <= PMU_TRACK_LEN; step++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, LANE_Z * 4 + 1.6), lineMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(step * STEP_X, 0.01, 0)
      scene.add(line)
    }
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf4f2f8, roughness: 0.5 })
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(FINISH_X + 14, 0.09, 0.09), railMat)
      rail.position.set(FINISH_X / 2, 0.75, side * (LANE_Z * 2 + 0.8))
      scene.add(rail)
      for (let x = -6; x <= FINISH_X + 7; x += 3.2) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.09), railMat)
        post.position.set(x, 0.375, side * (LANE_Z * 2 + 0.8))
        scene.add(post)
      }
    }

    // Ligne d'arrivée : deux poteaux + banderole à damier.
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0x89216b })
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.6, 10), poleMat)
      pole.position.set(FINISH_X, 2.8, side * (LANE_Z * 2 + 1.1))
      scene.add(pole)
    }
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_Z * 4 + 2.2, 1.1),
      new THREE.MeshBasicMaterial({ map: makeCheckerTexture(), side: THREE.DoubleSide }),
    )
    banner.rotation.y = Math.PI / 2
    banner.position.set(FINISH_X, 4.9, 0)
    scene.add(banner)
    const finishStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, LANE_Z * 4 + 1.6),
      new THREE.MeshBasicMaterial({ map: makeCheckerTexture() }),
    )
    finishStrip.rotation.x = -Math.PI / 2
    finishStrip.position.set(FINISH_X, 0.02, 0)
    scene.add(finishStrip)

    // Petite foule : gradins de cubes colorés qui sautillent.
    const crowd: THREE.Mesh[] = []
    const crowdColors = [0xf472b6, 0x60a5fa, 0xfbbf24, 0x34d399, 0xa78bfa, 0xf87171]
    for (let i = 0; i < 90; i++) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.5),
        new THREE.MeshStandardMaterial({ color: crowdColors[i % crowdColors.length], roughness: 0.8 }),
      )
      const row = Math.floor(i / 30)
      cube.position.set(-4 + (i % 30) * ((FINISH_X + 10) / 30), 0.9 + row * 0.9, -(LANE_Z * 2 + 2.6 + row * 1.1))
      scene.add(cube)
      crowd.push(cube)
    }

    // --- Les 4 chevaux. ---
    const horses = HORSES.map((h) => {
      const rig = makeHorse(h.color, h.symbol)
      rig.group.position.set(START_X, 0, laneZ(h.suit))
      scene.add(rig.group)
      return rig
    })

    const clock = new THREE.Clock()
    const camPos = new THREE.Vector3(START_X - 9, 6.5, 13)
    const camTarget = new THREE.Vector3(START_X + 5, 1.2, 0)
    let disposed = false

    function animate() {
      if (disposed) return
      requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const { events: raceEvents, raceStartedAt: startedAt, winnerSuit: winner } = stateRef.current
      const racing = !!raceEvents && raceEvents.length > 0 && startedAt !== null
      const playback = racing ? computePlayback(raceEvents, Date.now() - startedAt) : null

      let leaderX = START_X
      for (const h of HORSES) {
        const rig = horses[h.suit]
        const visual = playback ? horseVisualPosition(playback, h.suit) : 0
        const x = START_X + visual * STEP_X
        rig.group.position.x = x
        if (x > leaderX) leaderX = x

        const isMover = playback?.current && playback.current.type !== 'finish' && playback.current.suit === h.suit
        const running = playback && !playback.countdown && !playback.done
        const speed = isMover ? 17 : running ? 9 : 0
        if (speed > 0) {
          for (let i = 0; i < rig.legs.length; i++) {
            rig.legs[i].rotation.z = Math.sin(t * speed + rig.phase + (i % 2) * Math.PI) * (isMover ? 0.75 : 0.35)
          }
          rig.body.position.y = Math.abs(Math.sin(t * speed + rig.phase)) * (isMover ? 0.16 : 0.06)
        } else {
          for (const leg of rig.legs) leg.rotation.z *= 0.9
          rig.body.position.y = Math.sin(t * 1.6 + rig.phase) * 0.03 + 0.03 // respiration au paddock
        }

        // Danse de la victoire pour le vainqueur une fois la course finie.
        if (playback?.done && winner === h.suit) {
          rig.group.position.y = Math.abs(Math.sin(t * 5)) * 0.5
          rig.group.rotation.y = Math.sin(t * 2.5) * 0.3
        } else {
          rig.group.position.y = 0
          rig.group.rotation.y = 0
        }
      }

      // Foule qui sautille pendant la course.
      if (playback && !playback.countdown) {
        for (let i = 0; i < crowd.length; i++) {
          const base = 0.9 + Math.floor(i / 30) * 0.9
          crowd[i].position.y = base + Math.abs(Math.sin(t * 4 + i * 1.3)) * 0.18
        }
      }

      // --- Caméra. ---
      let wantedPos: THREE.Vector3
      let wantedTarget: THREE.Vector3
      if (!racing || !playback) {
        // Paddock : lente orbite autour de la ligne de départ.
        const a = t * 0.18
        wantedPos = new THREE.Vector3(START_X + 3 + Math.sin(a) * 11, 5.5 + Math.sin(t * 0.4) * 0.6, Math.cos(a) * 11 + 4)
        wantedTarget = new THREE.Vector3(START_X + 1.5, 1.2, 0)
      } else if (playback.countdown) {
        wantedPos = new THREE.Vector3(START_X - 8, 4.5, 10)
        wantedTarget = new THREE.Vector3(START_X + 4, 1.4, 0)
      } else if (playback.done) {
        wantedPos = new THREE.Vector3(FINISH_X - 3, 4.5, 10.5)
        wantedTarget = new THREE.Vector3(FINISH_X - 1, 1.6, 0)
      } else {
        wantedPos = new THREE.Vector3(leaderX - 5.5, 6.2, 12.5)
        wantedTarget = new THREE.Vector3(leaderX + 3.5, 1.1, 0)
      }
      camPos.lerp(wantedPos, 0.045)
      camTarget.lerp(wantedTarget, 0.065)
      camera.position.copy(camPos)
      camera.lookAt(camTarget)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else if (material) material.dispose()
      })
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={containerRef} className="absolute inset-0" />
}
