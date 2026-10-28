/**
 * Audit visuel : chaque jeu, chaque phase, sur deux TV (1080p, 720p) et deux téléphones.
 *
 *   npm run audit:visual              tous les jeux
 *   npm run audit:visual -- uno poker quelques jeux
 *
 * Prérequis : l'API et le front tournent sur la MÊME base que ce script (MINDMATCH_DB_PATH),
 * comme le fait `test-e2e-docker.sh`. Ce script :
 *  1. crée une vraie salle de 8 joueurs (via l'API) et ouvre les 4 écrans dans Chromium ;
 *  2. explore les phases du jeu EN PROCESSUS (même boucle que server/party.ts, actions tirées de
 *     la vue de chaque joueur) — bien plus rapide et plus complet que de cliquer ;
 *  3. à chaque nouvelle phase, écrit l'état dans la base de la salle, provoque une diffusion, et
 *     capture les 4 écrans + mesure les débordements (texte coupé, scroll horizontal).
 *
 * Sorties : AUDIT_OUT (défaut : ./visual-audit/) — PNG par écran + report.json.
 */
import { chromium, type Browser, type Page } from '@playwright/test'
import { io } from 'socket.io-client'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { readDb, writeDb } from '../server/db'
import { getGame, AVAILABLE_GAME_IDS } from '../server/games/registry'
import { sanitizeGroup } from '../server/store'
import { questions } from '../src/data/questions'
import { computeScores, getArchetypeId } from '../src/lib/scoring'
import type { Group, PartySession } from '../src/types'
import type { StoredGroup } from '../server/types'

const WEB = process.env.TEST_BASE_URL ?? 'http://localhost:5173'
const API = `http://localhost:${process.env.PORT ?? 3001}`
const OUT = process.env.AUDIT_OUT ?? path.resolve('visual-audit')
const SETTLE_MS = Number(process.env.AUDIT_SETTLE_MS ?? 1900)
const NAMES = ['Alice', 'Bruno', 'Chloé', 'Dimitri', 'Emma', 'Farid', 'Gaëlle', 'Hugo']

const SCREENS = [
  { key: 'tv1080', kind: 'tv', viewport: { width: 1920, height: 1080 } },
  { key: 'tv720', kind: 'tv', viewport: { width: 1280, height: 720 } },
  { key: 'host', kind: 'phone', viewport: { width: 390, height: 844 } },
  { key: 'player', kind: 'phone', viewport: { width: 390, height: 844 } },
] as const

interface Issue {
  game: string
  phase: string
  screen: string
  kind: string
  detail: string
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${url} → ${r.status} ${await r.text()}`)
  return (await r.json()) as T
}

function rng(seed: number) {
  let x = seed >>> 0 || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
}

/** Charges utiles plausibles, tirées de ce que le joueur voit (ids de cartes, de joueurs…). */
function candidates(view: unknown, ids: string[], r: () => number): unknown[] {
  const json = JSON.stringify(view ?? {})
  const seen = [...new Set(json.match(/"id":"([^"]+)"/g)?.map((s) => s.slice(6, -1)) ?? [])]
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const id = () => pick(ids)
  return [
    {}, { targetId: id() }, { target1: id(), target2: id() }, { targetIds: [id(), id()] },
    { cardId: pick(seen.length ? seen : ['x']) }, { cardId: pick(seen.length ? seen : ['x']), chosenColor: pick(['red', 'blue', 'green', 'yellow']) },
    { choice: pick(['truth', 'dare', 'A', 'B']) }, { side: pick(['A', 'B']) }, { value: pick(['yes', 'no']) },
    { approved: r() > 0.3 }, { amount: pick([20, 40, 100]) }, { bet: pick([1, 2, 5]) }, { word: pick(['soudain', 'chat', 'puis', 'la']) },
    { text: 'Une phrase de test assez longue pour voir le retour à la ligne.' }, { guess: 'pomme' },
    { guesses: Object.fromEntries(ids.map((t) => [t, pick(seen.length ? seen : ['x'])])) },
    { index: pick([0, 1, 2]) }, { assisted: r() > 0.5 }, { optionId: pick(seen.length ? seen : ['x']) },
    { horse: pick([0, 1, 2, 3]), amount: pick([1, 2]) },
  ]
}

const ACTION_TYPES_BY_GAME = new Map<string, string[]>()
async function actionTypes(gameId: string): Promise<string[]> {
  if (ACTION_TYPES_BY_GAME.has(gameId)) return ACTION_TYPES_BY_GAME.get(gameId)!
  const { readFileSync, readdirSync } = await import('node:fs')
  const dir = path.resolve('server/games')
  const file = readdirSync(dir).filter((f) => f.endsWith('.ts')).find((f) => {
    const src = readFileSync(path.join(dir, f), 'utf8')
    return new RegExp(`id: '${gameId}'`).test(src)
  })
  const src = file ? readFileSync(path.join(dir, file), 'utf8') : ''
  const types = [...new Set((src.match(/type === '([a-z0-9-]+)'/g) ?? []).map((m) => m.split("'")[1]))]
  const all = types.length ? types : ['vote', 'ready', 'submit', 'play', 'next']
  ACTION_TYPES_BY_GAME.set(gameId, all)
  return all
}

/** Débordements visibles : scroll horizontal, et éléments porteurs de texte coupés par un ancêtre
 * `overflow: hidden` ou par le bord de l'écran. */
async function measure(page: Page): Promise<{ kind: string; detail: string }[]> {
  return page.evaluate(() => {
    const out: { kind: string; detail: string }[] = []
    const W = window.innerWidth
    const H = window.innerHeight
    if (document.documentElement.scrollWidth > W + 1) {
      out.push({ kind: 'scroll-x', detail: `largeur ${document.documentElement.scrollWidth}px > ${W}px` })
    }
    const clipped = new Set<string>()
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1)
      if (!hasText) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue
      const text = (el.textContent ?? '').trim().slice(0, 40)
      // Un conteneur qui défile (rangée d'adversaires, main de cartes) a le droit de déborder.
      let scroller: HTMLElement | null = el.parentElement
      while (scroller && scroller !== document.body) {
        const ss = getComputedStyle(scroller)
        if (/(auto|scroll)/.test(ss.overflowX + ss.overflowY)) break
        scroller = scroller.parentElement
      }
      if (scroller && scroller !== document.body) continue
      if (r.right > W + 2 || r.left < -2) clipped.add(`hors écran (x) « ${text} »`)
      // Ancêtre qui coupe.
      let p = el.parentElement
      while (p && p !== document.body) {
        const ps = getComputedStyle(p)
        if (ps.overflow === 'hidden' || ps.overflowY === 'hidden' || ps.overflowX === 'hidden') {
          const pr = p.getBoundingClientRect()
          if (r.bottom > pr.bottom + 3 || r.top < pr.top - 3 || r.right > pr.right + 3 || r.left < pr.left - 3) {
            clipped.add(`coupé « ${text} »`)
          }
          break
        }
        p = p.parentElement
      }
      // Texte tronqué par line-clamp / ellipsis : signalé seulement s'il déborde vraiment.
      if ((cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
        clipped.add(`tronqué « ${text} »`)
      }
      if (r.top > H + 2 && cs.position === 'fixed') clipped.add(`fixe hors écran « ${text} »`)
    }
    for (const c of clipped) out.push({ kind: 'clip', detail: c })
    return out
  })
}

async function setupRoom(adult: boolean) {
  const host = await post<{ group: Group; memberId: string; memberToken: string }>('/api/groups', { groupName: 'Audit', pseudo: NAMES[0] })
  const players = [{ memberId: host.memberId, memberToken: host.memberToken }]
  for (const name of NAMES.slice(1)) {
    const j = await post<{ memberId: string; memberToken: string }>('/api/groups/join', { code: host.group.code, pseudo: name })
    players.push(j)
  }
  // Test de personnalité « terminé » pour tout le monde, réponses au hasard.
  const db = readDb({ groupId: host.group.id })
  const g = db.groups[0]
  const r = rng(42)
  for (const m of g.members) {
    for (const q of questions) m.answers[q.id] = q.options[Math.floor(r() * q.options.length)].id
    m.scores = computeScores(m.answers)
    m.archetypeId = getArchetypeId(m.scores)
    m.finishedAt = Date.now()
  }
  g.adultModeEnabled = adult
  writeDb(db)
  return { groupId: host.group.id, code: host.group.code, players }
}

async function main() {
  const only = process.argv.slice(2)
  const games = only.length ? only : AVAILABLE_GAME_IDS
  mkdirSync(OUT, { recursive: true })
  const issues: Issue[] = []
  const shots: { game: string; phase: string; files: Record<string, string> }[] = []

  const room = await setupRoom(true)
  const browser: Browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  })
  const pages: Record<string, Page> = {}
  for (const s of SCREENS) {
    const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: 1 })
    if (s.kind === 'phone') {
      const who = s.key === 'host' ? room.players[0] : room.players[1]
      await ctx.addInitScript(
        ([ident]) => {
          localStorage.setItem('mindmatch-storage', JSON.stringify({ state: { identity: ident }, version: 0 }))
          localStorage.setItem('mindmatch-sfx-muted', '1')
        },
        [{ groupId: room.groupId, memberId: who.memberId, memberToken: who.memberToken }],
      )
    }
    const page = await ctx.newPage()
    page.on('pageerror', (e) => issues.push({ game: '-', phase: '-', screen: s.key, kind: 'pageerror', detail: e.message }))
    await page.goto(s.kind === 'tv' ? `${WEB}/#/screen/${room.code}` : `${WEB}/#/play`)
    pages[s.key] = page
  }

  // Une socket « hôte » sert à provoquer une diffusion après chaque injection d'état.
  const poke = io(API, { auth: { groupId: room.groupId, memberId: room.players[0].memberId, memberToken: room.players[0].memberToken }, transports: ['websocket'] })
  await new Promise<void>((res) => poke.on('connect', () => res()))

  for (const gameId of games) {
    const game = getGame(gameId)
    if (!game) continue
    const dir = path.join(OUT, gameId)
    mkdirSync(dir, { recursive: true })
    const db = readDb({ groupId: room.groupId })
    const g: StoredGroup = db.groups[0]
    const ids = g.members.map((m) => m.id)
    const r = rng(gameId.length * 977)

    const write = (session: PartySession) => {
      g.party = JSON.parse(JSON.stringify(session))
      writeDb({ groups: [g] })
    }
    const settle = (session: PartySession) => {
      let s = session
      if (game.isRoundComplete(g as unknown as Group, s)) s = game.resolveRound(g as unknown as Group, s).session
      g.party = JSON.parse(JSON.stringify(s))
    }

    const start: PartySession = { status: 'lobby', hostMemberId: ids[0], currentGameId: gameId, phase: null, round: 0, roundData: null, participantIds: ids }
    const canStart = game.canStart?.(g as unknown as Group)
    if (canStart) {
      issues.push({ game: gameId, phase: '-', screen: '-', kind: 'canStart', detail: canStart })
      continue
    }
    settle(game.initRound(g as unknown as Group, start, undefined).session)

    const seen = new Set<string>()
    let n = 0
    const snap = async () => {
      const key = `${g.party.status}:${g.party.phase}`
      if (seen.has(key)) return
      seen.add(key)
      write(g.party)
      poke.emit('party:action', { type: '__audit_refresh__', payload: null })
      await new Promise((res) => setTimeout(res, SETTLE_MS))
      const files: Record<string, string> = {}
      for (const s of SCREENS) {
        const file = path.join(dir, `${String(n).padStart(2, '0')}-${(g.party.phase ?? 'none').replace(/[^a-z0-9-]/gi, '_')}-${s.key}.png`)
        await pages[s.key].screenshot({ path: file })
        files[s.key] = file
        for (const m of await measure(pages[s.key])) issues.push({ game: gameId, phase: key, screen: s.key, ...m })
      }
      shots.push({ game: gameId, phase: key, files })
      n++
    }

    await snap()
    const types = await actionTypes(gameId)
    for (let i = 0; i < 1500 && g.party.status !== 'ended' && seen.size < 9; i++) {
      const roll = r()
      if (roll < 0.05) {
        const gg = g as unknown as Group
        settle(game.isAwaitingInput(gg, g.party) ? game.resolveRound(gg, g.party).session : game.initRound(gg, g.party).session)
      } else {
        const who = ids[Math.floor(r() * ids.length)]
        const view = sanitizeGroup(g, who).party.roundData
        const pool = candidates(view, ids, r)
        const type = types[Math.floor(r() * types.length)]
        settle(game.handleAction(g as unknown as Group, g.party, who, { type, payload: pool[Math.floor(r() * pool.length)] }).session)
      }
      await snap()
    }
    // Fin de partie : on force les avancées de l'hôte si l'exploration ne l'a pas atteinte.
    for (let i = 0; i < 200 && g.party.status !== 'ended'; i++) {
      const gg = g as unknown as Group
      settle(game.isAwaitingInput(gg, g.party) ? game.resolveRound(gg, g.party).session : game.initRound(gg, g.party).session)
    }
    await snap()
    console.log(`${gameId}: ${[...seen].join(' · ')}`)
  }

  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ shots, issues }, null, 2))
  console.log(`\n${shots.length} captures, ${issues.length} signalements → ${OUT}`)
  poke.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
