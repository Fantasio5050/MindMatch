import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { WHEEL_SEGMENT_DEG, type WheelSegment } from '../../../data/wheelSegments'
import { wheelAngleAt } from './spinMath'
import type { WheelSpin } from './types'

/** Roue Infernale en 3D (three.js impératif) : grande roue verticale de plateau TV, jante néon,
 * pointeur lumineux, estrade et projecteurs. Chargée en lazy — seule la TV télécharge three.js.
 * Convention d'angle identique à la roue SVG des téléphones : segment 0 en haut, rotation horaire
 * à angle croissant, donc l'atterrissage visuel correspond toujours au résultat serveur. */

const WHEEL_R = 5
const WHEEL_Y = 4.1

interface SceneProps {
  segments: WheelSegment[]
  spin: WheelSpin | null
  restAngle: number
}

function drawWheelTexture(segments: WheelSegment[]): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const r = size / 2 - 8

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const a1 = ((i * WHEEL_SEGMENT_DEG - 90) * Math.PI) / 180
    const a2 = (((i + 1) * WHEEL_SEGMENT_DEG - 90) * Math.PI) / 180
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.arc(c, c, r, a1, a2)
    ctx.closePath()
    ctx.fillStyle = seg.color
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#0b0714'
    ctx.stroke()

    // Emoji + libellé, orientés vers l'extérieur du segment. maxWidth borne le texte à la largeur
    // du segment pour que les libellés longs ne débordent jamais sur les voisins.
    const mid = a1 + (a2 - a1) / 2
    const maxTextWidth = 2 * Math.sin(((WHEEL_SEGMENT_DEG / 2) * Math.PI) / 180) * r * 0.62
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(mid + Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.font = '58px sans-serif'
    ctx.fillText(seg.emoji, 0, -r * 0.8)
    ctx.font = 'bold 28px sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(0,0,0,0.75)'
    ctx.shadowBlur = 6
    const words = seg.label.split(' ')
    if (seg.label.length > 11 && words.length >= 2) {
      const half = Math.ceil(words.length / 2)
      ctx.fillText(words.slice(0, half).join(' '), 0, -r * 0.62, maxTextWidth)
      ctx.fillText(words.slice(half).join(' '), 0, -r * 0.53, maxTextWidth)
    } else {
      ctx.fillText(seg.label, 0, -r * 0.58, maxTextWidth)
    }
    ctx.restore()
  }

  // Moyeu central.
  ctx.beginPath()
  ctx.arc(c, c, 74, 0, Math.PI * 2)
  ctx.fillStyle = '#16121f'
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = '#e879f9'
  ctx.stroke()
  ctx.font = '64px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🎡', c, c + 4)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export default function WheelScene3D({ segments, spin, restAngle }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ spin, restAngle })
  stateRef.current = { spin, restAngle }
  const segmentsKey = segments.map((s) => s.id).join('|')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0714)
    scene.fog = new THREE.Fog(0x0b0714, 22, 55)
    const camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 100)

    scene.add(new THREE.AmbientLight(0x9988bb, 0.9))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(6, 12, 14)
    scene.add(key)
    const glowPink = new THREE.PointLight(0xe879f9, 70, 45)
    glowPink.position.set(-8, 8, 6)
    scene.add(glowPink)
    const glowPurple = new THREE.PointLight(0x8b5cf6, 70, 45)
    glowPurple.position.set(8, 8, 6)
    scene.add(glowPurple)

    // Sol et estrade.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshStandardMaterial({ color: 0x151021, roughness: 0.9 }))
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 8.2, 0.5, 48),
      new THREE.MeshStandardMaterial({ color: 0x241a38, roughness: 0.7 }),
    )
    stage.position.y = 0.25
    scene.add(stage)
    const stageRing = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.09, 10, 64),
      new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xa8348f, emissiveIntensity: 1.4 }),
    )
    stageRing.rotation.x = -Math.PI / 2
    stageRing.position.y = 0.52
    scene.add(stageRing)

    // Pied de la roue.
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2c2140, roughness: 0.5 })
    for (const dx of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, WHEEL_Y, 0.45), legMat)
      leg.position.set(dx, WHEEL_Y / 2, -0.85)
      scene.add(leg)
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 12), legMat)
    axle.rotation.x = Math.PI / 2
    axle.position.set(0, WHEEL_Y, -0.6)
    scene.add(axle)

    // La roue elle-même (face texturée + fond + jante + picots).
    const wheelGroup = new THREE.Group()
    wheelGroup.position.set(0, WHEEL_Y, 0)
    scene.add(wheelGroup)

    const texture = drawWheelTexture(segments)
    const face = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R, 72), new THREE.MeshBasicMaterial({ map: texture }))
    wheelGroup.add(face)
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_R + 0.05, WHEEL_R + 0.05, 0.35, 72),
      new THREE.MeshStandardMaterial({ color: 0x1b1426, roughness: 0.6 }),
    )
    back.rotation.x = Math.PI / 2
    back.position.z = -0.2
    wheelGroup.add(back)
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(WHEEL_R + 0.08, 0.16, 12, 90),
      new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xa8348f, emissiveIntensity: 1.6, roughness: 0.35 }),
    )
    wheelGroup.add(rim)
    const pegMat = new THREE.MeshStandardMaterial({ color: 0xf4f2f8, emissive: 0x888888, emissiveIntensity: 0.5 })
    for (let i = 0; i < segments.length; i++) {
      const a = ((i * WHEEL_SEGMENT_DEG - 90) * Math.PI) / 180
      const peg = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), pegMat)
      peg.position.set(Math.cos(a) * (WHEEL_R - 0.22), -Math.sin(a) * (WHEEL_R - 0.22), 0.12)
      wheelGroup.add(peg)
    }

    // Pointeur fixe en haut.
    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 1.0, 4),
      new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xc026d3, emissiveIntensity: 1.8 }),
    )
    pointer.rotation.z = Math.PI // pointe vers le bas
    pointer.rotation.y = Math.PI / 4
    pointer.position.set(0, WHEEL_Y + WHEEL_R + 0.55, 0.1)
    scene.add(pointer)

    const clock = new THREE.Clock()
    const camPos = new THREE.Vector3(0, WHEEL_Y + 0.6, 18)
    const camTarget = new THREE.Vector3(0, WHEEL_Y - 0.2, 0)
    let disposed = false

    function animate() {
      if (disposed) return
      requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const { spin: activeSpin, restAngle: rest } = stateRef.current

      let angle = rest
      let spinningProgress: number | null = null
      if (activeSpin) {
        const at = wheelAngleAt(activeSpin, Date.now())
        angle = at.angle
        spinningProgress = at.done ? null : at.progress
      }
      // Rotation horaire à l'écran (face +Z) = rotation.z négative.
      wheelGroup.rotation.z = (-angle * Math.PI) / 180

      // Le pointeur frémit pendant la rotation.
      pointer.rotation.z = Math.PI + (spinningProgress !== null ? Math.sin(t * 40) * 0.12 * (1 - spinningProgress) : 0)

      // Caméra : léger balancement au repos, travelling avant pendant la décélération.
      const push = spinningProgress !== null ? spinningProgress * 1.6 : 0
      const wantedPos = new THREE.Vector3(Math.sin(t * 0.25) * 1.6, WHEEL_Y + 0.6 + Math.sin(t * 0.4) * 0.3, 18 - push)
      camPos.lerp(wantedPos, 0.04)
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
      texture.dispose()
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else if (material) material.dispose()
      })
      renderer.domElement.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentsKey])

  return <div ref={containerRef} className="absolute inset-0" />
}
