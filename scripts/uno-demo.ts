/**
 * Démo UNO : une vraie partie jouée par des « robots » via les sockets, pendant que la TV est
 * capturée en rafale. Sert à juger la scène 3D (animations, lisibilité) sans six téléphones.
 *
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE=… AUDIT_OUT=… npx tsx scripts/uno-demo.ts [joueurs] [coups]
 */
import { chromium } from '@playwright/test'
import { io, type Socket } from 'socket.io-client'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const WEB = process.env.TEST_BASE_URL ?? 'http://localhost:5173'
const API = `http://localhost:${process.env.PORT ?? 3001}`
const OUT = process.env.AUDIT_OUT ?? path.resolve('uno-demo')
const NAMES = ['Alice', 'Bruno', 'Chloé', 'Dimitri', 'Emma', 'Farid', 'Gaëlle', 'Hugo']
const players = Number(process.argv[2] ?? 6)
const moves = Number(process.argv[3] ?? 18)
/** FAST=1 : partie jouée vite, captures seulement sur les moments forts (UNO, Contre-UNO, fin). */
const FAST = process.env.FAST === '1'

interface View {
  phase: string
  myTurn: boolean
  playableIds: string[]
  hand: { id: string; color: string }[]
  hasDrawn: boolean
  mustCallUno: boolean
  canCatch: boolean
  exposed: string | null
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return (await r.json()) as T
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const host = await post<{ group: { id: string; code: string }; memberId: string; memberToken: string }>('/api/groups', { groupName: 'Démo UNO', pseudo: NAMES[0] })
  const ids = [{ memberId: host.memberId, memberToken: host.memberToken }]
  for (const n of NAMES.slice(1, players)) ids.push(await post('/api/groups/join', { code: host.group.code, pseudo: n }))

  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
  tv.on('console', (m) => m.type() === 'error' && console.log('[tv]', m.text()))
  tv.on('pageerror', (e) => console.log('[tv error]', e.message))
  await tv.goto(`${WEB}/#/screen/${host.group.code}`)

  const views = new Map<string, View>()
  const sockets: Socket[] = []
  for (const p of ids) {
    const s = io(API, { auth: { groupId: host.group.id, ...p }, transports: ['websocket'] })
    s.on('room:update', (msg: { group: { party: { roundData: View } } }) => views.set(p.memberId, msg.group.party.roundData))
    sockets.push(s)
  }
  await new Promise((r) => setTimeout(r, 1200))
  const hostSock = sockets[0]
  hostSock.emit('party:start', { gameId: 'uno' })
  let shot = 0
  const snap = async (label: string) => {
    await tv.screenshot({ path: path.join(OUT, `${String(shot++).padStart(3, '0')}-${label}.png`) })
  }
  // Distribution : rafale de captures pendant l'animation.
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 900))
    await snap('deal')
  }
  hostSock.emit('party:hostAdvance')
  await new Promise((r) => setTimeout(r, 1500))
  await snap('start')

  for (let m = 0; m < moves; m++) {
    const turn = ids.findIndex((p) => views.get(p.memberId)?.myTurn)
    if (turn < 0) break
    const v = views.get(ids[turn].memberId)!
    const sock = sockets[turn]
    if (v.mustCallUno) {
      // Un robot sur deux oublie d'annoncer : de quoi voir aussi le Contre-UNO.
      if (m % 2 === 0) {
        sock.emit('party:action', { type: 'call-uno', payload: {} })
        await new Promise((r) => setTimeout(r, 650))
        await snap(`m${m}-uno`)
      }
    }
    if (v.playableIds.length) {
      const card = v.hand.find((c) => c.id === v.playableIds[0])!
      sock.emit('party:action', { type: 'play-card', payload: { cardId: card.id, chosenColor: ['red', 'blue', 'green', 'yellow'][m % 4] } })
    } else sock.emit('party:action', { type: 'draw-card', payload: {} })
    if (FAST) {
      await new Promise((r) => setTimeout(r, 520))
      const anyone = views.get(ids[0].memberId) as unknown as { lastEvent?: { type: string }; phase: string }
      if (anyone?.lastEvent?.type === 'uno' || anyone?.lastEvent?.type === 'penalty') {
        await new Promise((r) => setTimeout(r, 450))
        await snap(`m${m}-${anyone.lastEvent.type}`)
      }
      if (anyone?.phase === 'ended') break
    } else {
      // Rafale : la carte en vol, l'atterrissage, puis l'état posé.
      await new Promise((r) => setTimeout(r, 280))
      await snap(`m${m}-a`)
      await new Promise((r) => setTimeout(r, 450))
      await snap(`m${m}-b`)
      await new Promise((r) => setTimeout(r, 900))
    }
    // Un joueur exposé : quelqu'un crie Contre-UNO.
    const catcher = ids.findIndex((p) => views.get(p.memberId)?.canCatch)
    const exposed = catcher >= 0 ? views.get(ids[catcher].memberId)?.exposed : null
    if (exposed) {
      sockets[catcher].emit('party:action', { type: 'catch-uno', payload: { targetId: exposed } })
      await new Promise((r) => setTimeout(r, 700))
      await snap(`m${m}-contre`)
    }
    const after = views.get(ids[turn].memberId)!
    if (after.hasDrawn) sock.emit('party:action', { type: 'pass', payload: {} })
  }
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 900))
    await snap('end')
  }
  for (const s of sockets) s.close()
  await browser.close()
  console.log(`${shot} captures → ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
