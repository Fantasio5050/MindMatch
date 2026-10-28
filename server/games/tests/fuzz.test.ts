/**
 * Fuzz de robustesse : aucun jeu ne doit lever d'exception, quelles que soient les actions reçues.
 *
 * Une exception dans un module remonte dans le gestionnaire socket.io : sans garde, c'est le
 * processus serveur entier qui tombe — toutes les salles en même temps. Les charges utiles viennent
 * des téléphones, donc de n'importe qui : elles sont ici volontairement absurdes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AVAILABLE_GAME_IDS, getGame } from '../registry'
import { makeRoom, expireTimers } from './harness'
import type { TraitKey } from '../../../src/types'

const TRAITS: TraitKey[] = ['creativity', 'logic', 'ambition', 'empathy', 'independence', 'sociability', 'organization']

const here = path.dirname(fileURLToPath(import.meta.url))
const gamesDir = path.join(here, '..')

// Tous les identifiants entre quotes des modules : un sur-ensemble des types d'actions réels.
const ACTION_TYPES = [
  ...new Set(
    readdirSync(gamesDir)
      .filter((f) => f.endsWith('.ts'))
      .flatMap((f) => readFileSync(path.join(gamesDir, f), 'utf8').match(/'[a-z][a-z0-9-]*'/g) ?? [])
      .map((s) => s.slice(1, -1)),
  ),
]

function rng(seed: number) {
  let x = seed >>> 0 || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
}

function payloads(r: () => number, ids: string[], view: unknown): unknown[] {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const id = () => pick([...ids, 'ghost', ''])
  // Identifiants piochés dans la vue (cartes de la main, options…) : sinon le fuzz ne jouerait jamais
  // de coup valide et resterait bloqué au premier écran.
  const seen = JSON.stringify(view ?? {}).match(/"id":"([^"]+)"/g)?.map((s) => s.slice(6, -1)) ?? ['x']
  const any = () => pick(seen)
  return [
    undefined, null, 0, -1, 1e12, NaN, 'x', [], {}, [1, 2],
    { targetId: id() }, { targetId: id(), target1: id(), target2: id() },
    { targetIds: [id(), id()] }, { cardId: any() }, { cardId: any(), chosenColor: pick(['red', 'blue', 'purple', null]) },
    { choice: pick(['truth', 'dare', 'double-dare', 'A', 'B', 'x', 3]) }, { side: pick(['A', 'B', 'C']) },
    { value: pick(['yes', 'no', 1, null]) }, { approved: pick([true, false, 'oui']) },
    { amount: pick([0, -5, 20, 40, 1e9, NaN, '100', null]) }, { bet: pick([0, 1, 5, -2, 1e9]) },
    { word: pick(['chat', '', ' ', 'a b', '<x>', 'é'.repeat(80)]) }, { text: pick(['', 'hello', 'x'.repeat(5000)]) },
    { guess: pick(['', 'pomme', 42]) }, { guesses: { [id()]: any() } }, { index: pick([0, 1, 99, -1, 'a']) },
    { assisted: pick([true, false]) }, { heal: true }, { optionId: any() }, { constraintId: any() },
    { horse: pick([0, 1, 7, 'x']), amount: pick([1, 3, 100]) }, { pawnId: any() }, { count: pick([1, 2, 99]) },
    { square: pick([0, 1, 3, 5, 12, 39, -1, 40, 'x', null]) },
    {
      to: id(),
      give: { cash: pick([0, 50, 1e9, -5, NaN]), squares: [pick([1, 3, 5, 99, -1])], jailCards: pick([0, 1, -1]) },
      get: pick([undefined, { cash: 10, squares: [], jailCards: 0 }, 'x']),
    },
  ]
}

for (const gameId of AVAILABLE_GAME_IDS) {
  test(`fuzz : ${gameId} ne lève jamais d'exception`, () => {
    const game = getGame(gameId)!
    const players = Math.max(game.minPlayers, 8)
    const r = rng(gameId.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7))
    const phases = new Set<string>()
    for (const config of [undefined, null, 42, { pack: 'trash' }, { rounds: -3, cycles: 1e9, turnSeconds: 'x' }]) {
      const room = makeRoom(players, { adult: true })
      // Profil de personnalité requis par certains jeux (Devine ma réponse, Profil secret…).
      for (const m of room.group.members) {
        m.scores = Object.fromEntries(TRAITS.map((t, i) => [t, 30 + i * 9])) as never
        m.archetypeId = 'explorer'
        m.finishedAt = 1
      }
      try {
        room.start(gameId, config)
      } catch (e) {
        if (e instanceof Error && /joueurs|test|profil/i.test(e.message)) continue // canStart refusé : légitime
        throw e
      }
      for (let i = 0; i < 300; i++) {
        if (process.env.FUZZ_STATS) phases.add(`${room.status}:${room.phase}`)
        const roll = r()
        if (roll < 0.06) room.advance()
        else if (roll < 0.09) expireTimers(room)
        else {
          const who = room.ids[Math.floor(r() * room.ids.length)]
          const type = ACTION_TYPES[Math.floor(r() * ACTION_TYPES.length)]
          const pool = payloads(r, room.ids, room.view(who))
          room.act(who, type, pool[Math.floor(r() * pool.length)])
        }
        for (const viewer of [null, room.ids[0], room.ids[1]]) room.view(viewer)
        if (room.status === 'ended') break
      }
    }
    if (process.env.FUZZ_STATS) console.log(`STATS ${gameId}: ${[...phases].join(' ')}`)
    assert.ok(true)
  })
}
