/**
 * Monopoly : les règles qui comptent à table — achat, loyer, doubles, prison, enchères, dettes et
 * faillite, constructions équilibrées, échanges, cartes — et le secret des paquets.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeRoom, leaks } from './harness'
import { BOARD, START_CASH } from '../../../src/data/monopoly'
import type { MonoState } from '../../../src/party/games/monopoly/types'

type S = MonoState & { secrets: { chance: number[]; chest: number[] } }

/** Fait tomber les prochains dés sur les valeurs voulues. */
function withDice<T>(values: number[], fn: () => T): T {
  const original = Math.random
  const queue = [...values]
  Math.random = () => {
    const v = queue.shift()
    return v === undefined ? original() : (v - 1) / 6 + 0.01
  }
  try {
    return fn()
  } finally {
    Math.random = original
  }
}

function setup(players = 3) {
  const room = makeRoom(players)
  room.start('monopoly')
  assert.equal(room.phase, 'intro')
  room.advance()
  assert.equal(room.phase, 'turn')
  const s = () => room.raw<S>()
  const cur = () => s().players[s().turn]
  return { room, s, cur }
}

test('départ : 1 500 € chacun, sur la case Départ, au premier de jouer', () => {
  const { s, cur } = setup(4)
  assert.equal(s().players.length, 4)
  for (const p of s().players) {
    assert.equal(p.cash, START_CASH)
    assert.equal(p.pos, 0)
  }
  assert.equal(s().step, 'roll')
  assert.ok(cur())
})

test('achat, loyer, et loyer doublé sur un groupe complet', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  withDice([1, 2], () => room.act(a, 'roll')) // → 3 : Rue Lecourbe (60)
  assert.equal(s().step, 'buy')
  room.act(a, 'buy')
  assert.equal(s().owners[3], a)
  assert.equal(s().players.find((p) => p.id === a)!.cash, START_CASH - 60)
  assert.equal(s().step, 'done')
  room.act(a, 'end-turn')
  const b = cur().id
  assert.notEqual(a, b)
  withDice([1, 2], () => room.act(b, 'roll'))
  assert.equal(s().players.find((p) => p.id === b)!.cash, START_CASH - 4)
  assert.equal(s().players.find((p) => p.id === a)!.cash, START_CASH - 60 + 4)
  // Groupe complet : loyer nu doublé.
  s().owners[1] = a
  room.act(b, 'end-turn')
  s().step = 'done' // a passe son tour
  room.act(a, 'end-turn')
  s().players.find((p) => p.id === b)!.pos = 0
  withDice([1, 2], () => room.act(b, 'roll'))
  assert.equal(s().events.at(-1)?.type, 'rent')
  const rent = s().events.at(-1) as { amount: number }
  assert.equal(rent.amount, 8)
})

test('un double fait rejouer, trois doubles envoient en prison', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  withDice([3, 3], () => room.act(a, 'roll')) // 6 : Rue de Vaugirard
  if (s().step === 'buy') room.act(a, 'decline')
  if (s().step === 'auction') room.advance()
  assert.equal(s().step, 'roll')
  withDice([2, 2], () => room.act(a, 'roll'))
  if (s().step === 'buy') room.act(a, 'decline')
  if (s().step === 'auction') room.advance()
  if (s().step === 'card') room.act(a, 'ack')
  withDice([1, 1], () => room.act(a, 'roll'))
  const p = s().players.find((x) => x.id === a)!
  assert.equal(p.inJail, true)
  assert.equal(p.pos, 10)
  assert.equal(s().step, 'done')
})

test('prison : caution, ou trois essais puis caution forcée', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  const p = () => s().players.find((x) => x.id === a)!
  Object.assign(p(), { inJail: true, pos: 10 })
  s().step = 'jail'
  room.act(a, 'pay-bail')
  assert.equal(p().inJail, false)
  assert.equal(p().cash, START_CASH - 50)
  assert.equal(s().pot, 50)
  assert.equal(s().step, 'roll')

  Object.assign(p(), { inJail: true, pos: 10, jailTurns: 2 })
  s().step = 'jail'
  withDice([1, 2], () => room.act(a, 'roll'))
  assert.equal(p().inJail, false)
  assert.equal(p().pos, 13)
})

test('enchères : celui qui refuse met la case aux enchères, le plus offrant l’emporte', () => {
  const { room, s, cur } = setup(3)
  const a = cur().id
  const [b, c] = s().players.map((p) => p.id).filter((id) => id !== a)
  withDice([3, 6], () => room.act(a, 'roll')) // 9 : Avenue de la République
  room.act(a, 'decline')
  assert.equal(s().step, 'auction')
  room.act(b, 'bid', { amount: 50 })
  room.act(c, 'bid', { amount: 40 }) // trop bas : ignoré
  room.act(c, 'bid', { amount: 80 })
  room.act(a, 'pass')
  room.act(b, 'pass')
  assert.equal(s().owners[9], c)
  assert.equal(s().players.find((p) => p.id === c)!.cash, START_CASH - 80)
  assert.equal(s().step, 'done')
})

test('dette puis faillite : le créancier récupère tout, la partie se termine', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  const b = s().players.find((p) => p.id !== a)!.id
  s().owners[39] = b
  s().owners[37] = b
  s().houses[39] = 5
  s().houses[37] = 5
  s().owners[1] = a
  const pa = s().players.find((p) => p.id === a)!
  pa.cash = 100
  pa.pos = 33
  withDice([2, 4], () => room.act(a, 'roll')) // 39 : Rue de la Paix avec hôtel, 2 000 €
  assert.equal(s().step, 'debt')
  room.act(a, 'pay-debt') // pas assez : refusé
  assert.equal(s().step, 'debt')
  room.act(a, 'bankrupt')
  assert.equal(room.status, 'ended')
  assert.equal(s().winner, b)
  assert.equal(s().owners[1], b)
})

test('construction équilibrée sur un groupe complet', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  s().owners[1] = a
  s().owners[3] = a
  room.act(a, 'build', { square: 1 })
  assert.equal(s().houses[1], 1)
  room.act(a, 'build', { square: 1 }) // écart de deux maisons : refusé
  assert.equal(s().houses[1], 1)
  room.act(a, 'build', { square: 3 })
  room.act(a, 'build', { square: 1 })
  assert.equal(s().houses[1], 2)
  room.act(a, 'mortgage', { square: 3 }) // maisons dans le groupe : refusé
  assert.ok(!s().mortgaged[3])
  room.act(a, 'sell', { square: 1 })
  assert.equal(s().houses[1], 1)
})

test('échange accepté : propriétés et argent changent de mains', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  const b = s().players.find((p) => p.id !== a)!.id
  s().owners[5] = a
  s().owners[15] = b
  room.act(a, 'propose-trade', { to: b, give: { cash: 100, squares: [5], jailCards: 0 }, get: { cash: 0, squares: [15], jailCards: 0 } })
  assert.ok(s().trade)
  room.act(a, 'accept-trade') // seul le destinataire accepte
  assert.ok(s().trade)
  room.act(b, 'accept-trade')
  assert.equal(s().owners[5], b)
  assert.equal(s().owners[15], a)
  assert.equal(s().players.find((p) => p.id === b)!.cash, START_CASH + 100)
})

test('carte « Avancez jusqu’à la case Départ » : +200 €', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  s().secrets.chance.unshift(0)
  withDice([3, 4], () => room.act(a, 'roll')) // 7 : Chance
  assert.equal(BOARD[7].kind, 'chance')
  assert.equal(s().step, 'card')
  room.act(a, 'ack')
  const p = s().players.find((x) => x.id === a)!
  assert.equal(p.pos, 0)
  assert.equal(p.cash, START_CASH + 200)
})

test('les écrans ne voient jamais l’ordre des paquets', () => {
  const { room, s } = setup(2)
  const order = JSON.stringify(s().secrets.chance)
  for (const viewer of [null, room.ids[0], room.ids[1]]) {
    const v = room.view<Record<string, unknown>>(viewer)
    assert.equal(v.secrets, undefined)
    assert.ok(!leaks(v, order))
  }
})

test('l’hôte termine : le plus riche gagne', () => {
  const { room, s } = setup(3)
  s().players[1].cash = 5000
  room.act(room.host, 'finish')
  assert.equal(room.status, 'ended')
  assert.equal(s().winner, s().players[1].id)
})

test('caution forcée sans argent : le pion avance une fois la dette réglée', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  const p = () => s().players.find((x) => x.id === a)!
  Object.assign(p(), { inJail: true, pos: 10, jailTurns: 2, cash: 20 })
  s().owners[11] = a
  s().step = 'jail'
  withDice([1, 2], () => room.act(a, 'roll'))
  assert.equal(s().step, 'debt')
  assert.equal(p().pos, 10)
  room.act(a, 'mortgage', { square: 11 }) // +70 €
  room.act(a, 'pay-debt')
  assert.equal(p().pos, 13)
  assert.ok(s().events.some((e) => e.type === 'free' && e.how === 'forced'))
})

test('loyer réglé après une dette : l’événement loyer est bien raconté', () => {
  const { room, s, cur } = setup(2)
  const a = cur().id
  const b = s().players.find((x) => x.id !== a)!.id
  s().owners[39] = b
  s().owners[37] = b
  s().houses[39] = 2
  s().houses[37] = 2
  s().owners[1] = a
  Object.assign(s().players.find((x) => x.id === a)!, { cash: 500, pos: 33 })
  withDice([2, 4], () => room.act(a, 'roll')) // 39 : 600 € avec deux maisons
  assert.equal(s().step, 'debt')
  room.act(a, 'mortgage', { square: 1 }) // +30 €
  s().players.find((x) => x.id === a)!.cash += 100
  room.act(a, 'pay-debt')
  const last = s().events.at(-1)!
  assert.equal(last.type, 'rent')
  assert.equal(s().players.find((x) => x.id === b)!.cash, START_CASH + 600)
})

test('enchères : un joueur parti du groupe n’est pas attendu', () => {
  const { room, s, cur } = setup(3)
  const a = cur().id
  const [b, c] = s().players.map((p) => p.id).filter((id) => id !== a)
  room.group.members = room.group.members.filter((m) => m.id !== c)
  withDice([3, 6], () => room.act(a, 'roll'))
  room.act(a, 'decline')
  room.act(b, 'bid', { amount: 50 })
  room.act(a, 'pass')
  assert.equal(s().owners[9], b)
})
