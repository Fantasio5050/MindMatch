/**
 * Le catalogue du salon (src/data/gameLibrary.ts) et le registre du serveur décrivent les mêmes
 * jeux. Ils ont divergé une fois (noms manquants, jeux 18+ lançables hors mode 18+) : ce test
 * empêche que ça recommence, et vérifie au passage les vignettes et la règle 18+ côté serveur.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AVAILABLE_GAME_IDS, getGame } from '../registry'
import { GAME_LIBRARY } from '../../../src/data/gameLibrary'
import { createGroup, joinGroup } from '../../store'
import { setAdultMode, startGame } from '../../party'
import { makeRoom } from './harness'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

test('chaque jeu du serveur est au catalogue, et inversement', () => {
  const library = GAME_LIBRARY.map((e) => e.id).sort()
  assert.deepEqual(library, [...AVAILABLE_GAME_IDS].sort())
})

test('catalogue et serveur sont d’accord sur le 18+ et le nombre de joueurs', () => {
  for (const entry of GAME_LIBRARY) {
    const game = getGame(entry.id)!
    assert.equal(!!game.adult, !!entry.adult, `${entry.id} : 18+ catalogue=${!!entry.adult} serveur=${!!game.adult}`)
    assert.equal(game.minPlayers, entry.minPlayers, `${entry.id} : minPlayers`)
  }
})

test('chaque jeu a ses vignettes', () => {
  for (const entry of GAME_LIBRARY) {
    for (const w of [320, 640]) {
      const file = path.join(root, 'public/game-thumbnails', `${entry.id}-${w}.webp`)
      assert.ok(existsSync(file), `vignette manquante : ${entry.id}-${w}.webp`)
    }
  }
})

test('un jeu 18+ ne se lance pas hors mode 18+', () => {
  const host = createGroup('Test 18+', 'Hôte')
  const other = joinGroup(host.group.code, 'Invité')
  assert.ok(!('error' in other))
  const refused = startGame(host.group.id, host.memberId, host.memberToken, 'lancer-de-des')
  assert.ok('error' in refused && refused.status === 403)
  setAdultMode(host.group.id, host.memberId, host.memberToken, true)
  const started = startGame(host.group.id, host.memberId, host.memberToken, 'lancer-de-des')
  assert.ok(!('error' in started))
})

test('Lancer de dés : chacun son tour, on boit ce qu’on fait', () => {
  const room = makeRoom(3, { adult: true })
  room.start('lancer-de-des')
  assert.equal(room.phase, 'intro')
  room.advance()
  assert.equal(room.phase, 'turn')
  type S = { order: string[]; currentIndex: number; lastRoll: { memberId: string; value: number; at: number } | null; totalSips: Record<string, number> }

  // Hors tour : refusé.
  room.act(room.ids[1], 'roll')
  assert.equal(room.raw<S>().lastRoll, null)

  const rollAs = (who: string) => {
    room.act(who, 'roll')
    const s = room.raw<S>()
    // Le délai entre deux lancers n'a rien à faire dans un test : on vieillit le lancer.
    if (s.lastRoll) s.lastRoll.at -= 60_000
    return s
  }
  let s = rollAs(room.ids[0])
  assert.equal(s.lastRoll?.memberId, room.ids[0])
  assert.ok(s.lastRoll!.value >= 1 && s.lastRoll!.value <= 6)
  assert.equal(s.totalSips[room.ids[0]], s.lastRoll!.value)
  assert.equal(s.currentIndex, 1)

  // Deux lancers coup sur coup : le second est ignoré tant que le dé roule encore.
  room.act(room.ids[1], 'roll')
  room.act(room.ids[2], 'roll')
  s = room.raw<S>()
  assert.equal(s.lastRoll?.memberId, room.ids[1])
  s.lastRoll!.at -= 60_000

  // L'hôte passe un absent, puis termine.
  room.advance()
  assert.equal(room.raw<S>().currentIndex, 0)
  room.act(room.ids[1], 'finish')
  assert.equal(room.status, 'playing')
  room.act(room.host, 'finish')
  assert.equal(room.status, 'ended')
})
