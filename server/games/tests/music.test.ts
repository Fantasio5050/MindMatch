/**
 * Mode Soirée : la file équitable, le vote pour passer entre membres CONNECTÉS, la platine liée à sa
 * connexion, la fin de morceau qui suit le suivant annoncé, les réactions, « jouer ensuite », le
 * mode continu, les droits de l'hôte, l'ancre de lecture et le récap.
 *
 * Tout passe par la vraie base (SQLite en mémoire, `MINDMATCH_DB_PATH=:memory:`) et les vraies
 * fonctions appelées par le serveur temps réel — sans socket : une « connexion » de platine n'est
 * ici qu'un identifiant.
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createGroup, joinGroup, sanitizeGroup, isApiError } from '../../store'
import { readDb, readMusic, writeDb } from '../../db'
import {
  startMusic,
  stopMusic,
  musicAction,
  claimPlatine,
  platineEvent,
  platineStatus,
  releasePlatineSocket,
  recheckSkip,
  resetPlatineBindings,
  type MusicResult,
  type MusicOk,
} from '../../music'
import {
  orderedQueue,
  peekNext,
  skipThreshold,
  anchorPosition,
  cleanDedication,
  normalizeMusicSession,
  queueEtas,
  youtubePlaylistUrl,
  tidyYouTubeTitle,
  parseYouTubeId,
  MAX_DEDICATION,
  REACTIONS_PER_MEMBER_CAP,
} from '../../../src/lib/jukebox'
import { parseIsoDuration } from '../../youtube'
import type { MusicSession } from '../../../src/types'

const NAMES = ['Alice', 'Bruno', 'Chloé', 'Dina', 'Eve', 'Farid']
let seq = 0
/** Un identifiant YouTube valide et unique (11 caractères). */
const yt = () => `vid${String(seq++).padStart(8, '0')}`

function ok(r: MusicResult): MusicOk {
  if (isApiError(r)) assert.fail(`refusé : ${r.error}`)
  return r
}
function refused(r: MusicResult, status?: number): void {
  assert.ok(isApiError(r), 'aurait dû être refusé')
  if (status) assert.equal(r.status, status)
}

function setup(players = 3, source: 'youtube' | 'spotify' = 'youtube') {
  const created = createGroup('Soirée', NAMES[0])
  const g = created.group.id
  const m = [{ id: created.memberId, token: created.memberToken }]
  for (const name of NAMES.slice(1, players)) {
    const j = joinGroup(created.group.code, name)
    if (isApiError(j)) throw new Error(j.error)
    m.push({ id: j.memberId, token: j.memberToken })
  }
  const t0 = 1_000_000
  ok(startMusic(g, m[0].id, m[0].token, source, t0))
  let online = m.map((x) => x.id)
  const s = () => readMusic(g) as MusicSession
  return {
    g,
    m,
    t0,
    s,
    setOnline(ids: string[]) {
      online = ids
    },
    act(k: number, type: string, payload?: unknown, now = t0) {
      return musicAction(g, m[k].id, m[k].token, type, payload, { onlineIds: online }, now)
    },
    add(k: number, extra: Record<string, unknown> = {}) {
      const r = ok(musicAction(g, m[k].id, m[k].token, 'add', { source, sourceId: yt(), title: `Titre ${seq}`, artist: 'Artiste', durationMs: 180_000, ...extra }, { onlineIds: online }, t0))
      return r.trackId as string
    },
  }
}

beforeEach(() => resetPlatineBindings())

test('file équitable : chacun son tour, les votes départagent, « jouer ensuite » passe devant', () => {
  const { s, add, act } = setup(3)
  const a1 = add(0)
  assert.equal(s().current?.id, a1, 'le premier ajout part directement en lecture')
  const a2 = add(0)
  const a3 = add(0)
  const b1 = add(1)
  const c1 = add(2)
  // Alice a déjà eu son tour : Bruno et Chloé passent avant ses deux autres morceaux.
  assert.deepEqual(orderedQueue(s()).map((t) => t.id), [b1, c1, a2, a3])
  // Un vote ne départage qu'à profondeur égale.
  ok(act(0, 'bump', { trackId: c1 }))
  assert.deepEqual(orderedQueue(s()).map((t) => t.id), [c1, b1, a2, a3])
  refused(act(0, 'bump', { trackId: a2 }), 400) // pas pour soi
  assert.equal(orderedQueue(s())[0].id, c1)
  // L'hôte épingle : le dernier épinglé passe en premier.
  ok(act(0, 'playNext', { trackId: a3 }, 1_000_001))
  ok(act(0, 'playNext', { trackId: b1 }, 1_000_002))
  assert.deepEqual(orderedQueue(s()).map((t) => t.id).slice(0, 2), [b1, a3])
  assert.equal(peekNext(s())?.id, b1)
  // Second appui : retour dans l'ordre équitable.
  ok(act(0, 'playNext', { trackId: b1 }))
  assert.equal(orderedQueue(s())[0].id, a3)
  refused(act(1, 'playNext', { trackId: c1 }), 403)
  // Plafond par personne et doublons.
  refused(act(1, 'add', { source: 'youtube', sourceId: s().queue[0].sourceId }), 409)
})

test('vote pour passer : le seuil se calcule sur les membres connectés', () => {
  assert.equal(skipThreshold(1), 1)
  assert.equal(skipThreshold(2), 2)
  assert.equal(skipThreshold(3), 2)
  assert.equal(skipThreshold(5), 3)

  const room = setup(5)
  const first = room.add(0)
  const second = room.add(1)
  room.add(2)
  // Les cinq sont là : il faut 3 voix. Chloé et Dina votent…
  ok(room.act(2, 'voteSkip'))
  ok(room.act(3, 'voteSkip'))
  assert.equal(room.s().current?.id, first)
  const vote = room.s().feed.findLast((e) => e.kind === 'skipVote')
  assert.equal(vote?.count, 2)
  assert.equal(vote?.needed, 3)
  assert.equal(room.s().feed.filter((e) => e.kind === 'skipVote').length, 1, 'une seule ligne de fil par vote en cours')
  // … puis s'en vont : leurs voix ne comptent plus, le seuil tombe à 2 pour les trois restants.
  room.setOnline([room.m[0].id, room.m[1].id, room.m[4].id])
  ok(room.act(0, 'voteSkip'))
  assert.equal(room.s().current?.id, first, '1 voix connectée sur 2')
  ok(room.act(1, 'voteSkip'))
  assert.equal(room.s().current?.id, second)
  assert.deepEqual(room.s().skipVotes, [])

  // Seul connecté : on passe tout seul.
  room.setOnline([room.m[4].id])
  ok(room.act(4, 'voteSkip'))
  assert.notEqual(room.s().current?.id, second)
})

test('vote pour passer : un départ peut suffire à atteindre le seuil', () => {
  const room = setup(3)
  const first = room.add(0)
  room.add(1)
  ok(room.act(0, 'voteSkip')) // 1/2 entre trois connectés
  assert.equal(room.s().current?.id, first)
  assert.equal(recheckSkip(room.g, room.m.map((x) => x.id), 3), false)
  // Bruno et Chloé partent : Alice est seule, sa voix suffit.
  assert.equal(recheckSkip(room.g, [room.m[0].id], 3), true)
  assert.notEqual(room.s().current?.id, first)
})

test('platine liée à sa connexion : revendication, faux signaux, hors ligne, reprise', () => {
  const room = setup(3)
  room.add(0)
  room.add(1)
  assert.deepEqual(platineStatus(room.g), { online: false, kind: null })

  ok(claimPlatine(room.g, 'sock-1', { platineId: 'platine-aaa' }))
  assert.deepEqual(platineStatus(room.g), { online: true, kind: 'device' })
  assert.equal(room.s().feed.at(-1)?.kind, 'platineOn')

  // Un autre appareil qui ne connaît que le code ne peut ni voler la place…
  refused(claimPlatine(room.g, 'sock-2', { platineId: 'platine-bbb' }), 409)
  // … ni signaler une fin ou une position.
  const current = room.s().current!.id
  refused(platineEvent(room.g, 'sock-2', 'ended', { trackId: current }), 403)
  refused(platineEvent(room.g, 'sock-2', 'position', { trackId: current, positionMs: 5000, playing: true }), 403)
  assert.equal(room.s().current?.id, current)

  // La vraie platine, elle, avance.
  ok(platineEvent(room.g, 'sock-1', 'ended', { trackId: current }))
  assert.notEqual(room.s().current?.id, current)

  // Le lien de l'hôte (clé secrète) reprend la main sur une platine en ligne.
  const key = room.s().platineKey!
  const taken = ok(claimPlatine(room.g, 'sock-2', { platineId: 'platine-bbb', key }))
  assert.equal(taken.displacedSocketId, 'sock-1')
  refused(platineEvent(room.g, 'sock-1', 'skip', {}), 403)

  // La platine tombe : tout le monde le voit, la place est libre.
  assert.equal(releasePlatineSocket('sock-2'), room.g)
  assert.deepEqual(platineStatus(room.g), { online: false, kind: null })
  assert.equal(room.s().feed.at(-1)?.kind, 'platineOff')
  ok(claimPlatine(room.g, 'sock-3', { platineId: 'platine-ccc' }))
  // Le même appareil qui revient avec une nouvelle connexion reprend sa place.
  const back = ok(claimPlatine(room.g, 'sock-4', { platineId: 'platine-ccc' }))
  assert.equal(back.displacedSocketId, 'sock-3')

  // Ce que voient les téléphones : ni l'identifiant de la platine, ni la clé (sauf l'hôte).
  const group = readDb({ groupId: room.g }).groups[0]
  assert.equal(sanitizeGroup(group, room.m[1].id).music?.platineKey, undefined)
  assert.equal(sanitizeGroup(group, room.m[1].id).music?.platineId, null)
  assert.equal(sanitizeGroup(group, null).music?.platineKey, undefined)
  assert.equal(sanitizeGroup(group, room.m[0].id).music?.platineKey, key)
  assert.equal(sanitizeGroup(group, room.m[0].id).music?.pool, undefined)
})

test('le son sur la TV : choix de l’hôte, la TV prend la main, et la rend', () => {
  const room = setup(2)
  room.add(0)
  ok(claimPlatine(room.g, 'laptop', { platineId: 'platine-laptop' }))
  refused(claimPlatine(room.g, 'tv-1', { platineId: 'tv-screen-1', kind: 'tv' }), 403)
  refused(room.act(1, 'settings', { output: 'tv' }), 403)
  ok(room.act(0, 'settings', { output: 'tv' }))
  assert.equal(room.s().settings.output, 'tv')
  const tv = ok(claimPlatine(room.g, 'tv-1', { platineId: 'tv-screen-1', kind: 'tv' }))
  assert.equal(tv.displacedSocketId, 'laptop')
  assert.deepEqual(platineStatus(room.g), { online: true, kind: 'tv' })
  // Une seconde TV ne vole pas la place de la première.
  refused(claimPlatine(room.g, 'tv-2', { platineId: 'tv-screen-2', kind: 'tv' }), 409)
  // Le portable ne peut pas reprendre sans le lien de l'hôte tant que le son passe par la TV.
  refused(claimPlatine(room.g, 'laptop', { platineId: 'platine-laptop' }), 409)
  // Retour sur la platine : la TV est libérée tout de suite.
  const back = ok(room.act(0, 'settings', { output: 'device' }))
  assert.equal(back.displacedSocketId, 'tv-1')
  assert.deepEqual(platineStatus(room.g), { online: false, kind: null })
  ok(claimPlatine(room.g, 'laptop', { platineId: 'platine-laptop' }))

  // Spotify : pas de TV (la lecture passe par un compte connecté sur la platine).
  const sp = setup(2, 'spotify')
  refused(sp.act(0, 'settings', { output: 'tv' }), 400)
})

test('fin de morceau : le serveur avance vers le morceau que la platine a lancé', () => {
  const room = setup(3)
  const a1 = room.add(0)
  const b1 = room.add(1)
  const c1 = room.add(2)
  ok(claimPlatine(room.g, 'sock-1', { platineId: 'platine-aaa' }))
  assert.equal(orderedQueue(room.s())[0].id, b1)
  // Pendant le fondu, la platine a ouvert C1 (la file a bougé entre-temps) : on suit la platine.
  ok(platineEvent(room.g, 'sock-1', 'ended', { trackId: a1, nextTrackId: c1 }))
  assert.equal(room.s().current?.id, c1)
  assert.deepEqual(room.s().queue.map((t) => t.id), [b1])
  // Une fin tardive (l'ancien deck) est ignorée : pas de double saut.
  ok(platineEvent(room.g, 'sock-1', 'ended', { trackId: a1 }))
  assert.equal(room.s().current?.id, c1)
  // Suivant annoncé disparu entre-temps : on retombe sur la tête de file.
  ok(platineEvent(room.g, 'sock-1', 'ended', { trackId: c1, nextTrackId: 'tr-inconnu' }))
  assert.equal(room.s().current?.id, b1)
  // Vidéo injouable : on passe, et le fil le dit.
  ok(platineEvent(room.g, 'sock-1', 'ended', { trackId: b1, reason: 'unplayable' }))
  assert.ok(room.s().feed.some((e) => e.kind === 'unplayable'))
})

test('ancre de lecture : position, pause, reprise, durée découverte par la platine', () => {
  const room = setup(2)
  const t = room.t0
  const id = ok(musicAction(room.g, room.m[0].id, room.m[0].token, 'add', { source: 'youtube', sourceId: yt(), title: 'Lien collé' }, { onlineIds: [] }, t)).trackId
  assert.equal(room.s().current?.durationMs, null)
  assert.deepEqual(room.s().anchor, { positionMs: 0, at: t, playing: false })
  ok(claimPlatine(room.g, 'sock-1', { platineId: 'platine-aaa' }))
  const beat = ok(platineEvent(room.g, 'sock-1', 'position', { trackId: id, positionMs: 10_000, durationMs: 200_000, playing: true }, t + 1000))
  assert.equal(beat.broadcast, 'anchor', 'un battement ne rediffuse pas toute la salle')
  assert.equal(room.s().current?.durationMs, 200_000)
  assert.equal(anchorPosition(room.s().anchor, t + 6000), 15_000)
  // Pause de l'hôte : la position est figée.
  ok(room.act(0, 'setPlayback', { isPlaying: false }, t + 6000))
  assert.equal(room.s().isPlaying, false)
  assert.equal(anchorPosition(room.s().anchor, t + 60_000), 15_000)
  ok(room.act(0, 'setPlayback', { isPlaying: true }, t + 20_000))
  assert.equal(room.s().anchor?.positionMs, 15_000)
  // Une position pour un autre morceau est ignorée.
  ok(platineEvent(room.g, 'sock-1', 'position', { trackId: 'tr-autre', positionMs: 99_000, playing: true }, t + 21_000))
  assert.equal(room.s().anchor?.positionMs, 15_000)
  // Estimation des passages : le reste du morceau en cours, puis les durées des précédents.
  const b = room.add(1)
  const etas = queueEtas(room.s(), t + 20_000)
  assert.equal(etas[b], 185_000)
})

test('réactions : comptées par morceau, plafonnées par personne, gardées pour le récap', () => {
  const room = setup(3)
  room.add(0)
  const t = room.t0
  const r = ok(room.act(1, 'react', { emoji: '🔥' }, t))
  assert.equal(r.broadcast, 'none')
  assert.deepEqual(r.reaction?.counts, { '🔥': 1 })
  // Trop rapproché : ignoré, sans erreur.
  assert.equal(ok(room.act(1, 'react', { emoji: '🔥' }, t + 100)).reaction, undefined)
  refused(room.act(1, 'react', { emoji: '💩' }, t + 1000))
  for (let i = 1; i <= REACTIONS_PER_MEMBER_CAP + 5; i++) ok(room.act(1, 'react', { emoji: '❤️' }, t + i * 1000))
  const counts = room.s().current?.reactions ?? {}
  assert.equal((counts['🔥'] ?? 0) + (counts['❤️'] ?? 0), REACTIONS_PER_MEMBER_CAP, 'plafond par personne')
  ok(room.act(2, 'react', { emoji: '🙌' }, t + 60_000))
  assert.equal(room.s().djReactions[room.m[0].id], REACTIONS_PER_MEMBER_CAP + 1)
})

test('mode continu : file vide → on repioche le plus applaudi, sans compter dans le tour', () => {
  const room = setup(3)
  const t = room.t0
  const a1 = room.add(0)
  room.add(1)
  room.add(2)
  ok(room.act(1, 'react', { emoji: '🔥' }, t + 1000))
  ok(room.act(2, 'react', { emoji: '🔥' }, t + 2000))
  ok(room.act(0, 'hostSkip'))
  ok(room.act(0, 'hostSkip'))
  assert.equal(room.s().queue.length, 0)
  const auto = room.s().autoNext
  assert.ok(auto?.auto, 'une proposition du mode continu')
  assert.equal(auto?.title, room.s().history.find((h) => h.id === a1)?.title, 'le plus applaudi')
  assert.equal(peekNext(room.s())?.id, auto?.id)
  // Stable : de nouvelles réactions ne changent pas la proposition sous les pieds de la platine.
  ok(room.act(1, 'react', { emoji: '🙌' }, t + 9000))
  assert.equal(room.s().autoNext?.id, auto?.id)

  ok(claimPlatine(room.g, 'sock-1', { platineId: 'platine-aaa' }))
  const played = { ...room.s().playedCounts }
  ok(platineEvent(room.g, 'sock-1', 'ended', { trackId: room.s().current!.id, nextTrackId: auto!.id }))
  assert.equal(room.s().current?.id, auto?.id)
  assert.equal(room.s().current?.auto, true)
  assert.deepEqual(room.s().playedCounts, played, 'un repiochage ne compte dans le tour de personne')
  assert.equal(room.s().feed.findLast((e) => e.kind === 'auto')?.title, auto?.title)

  // Un ajout reprend la main sur le mode continu.
  const fresh = room.add(1)
  assert.equal(room.s().autoNext, null)
  assert.equal(peekNext(room.s())?.id, fresh)
  ok(room.act(1, 'remove', { trackId: fresh }))

  // Mode continu coupé : la file vide s'arrête.
  refused(room.act(1, 'settings', { continuous: false }), 403)
  ok(room.act(0, 'settings', { continuous: false }))
  assert.equal(room.s().autoNext, null)
  ok(platineEvent(room.g, 'sock-1', 'ended', { trackId: room.s().current!.id }))
  assert.equal(room.s().current, null)
  assert.equal(room.s().isPlaying, false)
})

test("droits de l'hôte : lecture, passage, réglages, retrait, fin de soirée", () => {
  const room = setup(3)
  room.add(0)
  const b1 = room.add(1)
  const c1 = room.add(2)
  for (const [type, payload] of [
    ['setPlayback', { isPlaying: false }],
    ['hostSkip', {}],
    ['settings', { volume: 10 }],
    ['playNext', { trackId: c1 }],
    ['dismiss', {}],
  ] as const) {
    refused(room.act(1, type, payload), 403)
  }
  refused(stopMusic(room.g, room.m[1].id, room.m[1].token), 403)
  refused(room.act(1, 'remove', { trackId: c1 }), 403)
  ok(room.act(2, 'remove', { trackId: c1 }))
  ok(room.act(0, 'remove', { trackId: b1 }))
  assert.equal(room.s().feed.at(-1)?.kind, 'remove', "l'hôte qui retire le morceau d'un autre, ça se voit")
  ok(room.act(0, 'settings', { volume: 140, crossfadeSec: 99, duck: false }))
  assert.equal(room.s().settings.volume, 100)
  assert.equal(room.s().settings.crossfadeSec, 12)
  assert.equal(room.s().settings.duck, false)
  // La platine active règle son volume et son fondu, pas le reste.
  ok(claimPlatine(room.g, 'sock-1', { platineId: 'platine-aaa' }))
  ok(platineEvent(room.g, 'sock-1', 'settings', { volume: 30, duck: true, continuous: false }))
  assert.equal(room.s().settings.volume, 30)
  assert.equal(room.s().settings.duck, false)
  assert.equal(room.s().settings.continuous, true)
})

test('dédicace : nettoyée, courte, jointe à l’ajout', () => {
  assert.equal(cleanDedication('  pour\nChloé​  qui adore\t '), 'pour Chloé qui adore')
  assert.equal(cleanDedication('   '), null)
  assert.equal(cleanDedication(42), null)
  assert.equal(Array.from(cleanDedication('é'.repeat(300)) ?? '').length, MAX_DEDICATION)
  const room = setup(2)
  room.add(0, { dedication: 'Pour\u0007 Bruno ' })
  assert.equal(room.s().current?.dedication, 'Pour Bruno')
  assert.equal(room.s().feed.find((e) => e.kind === 'add')?.detail, 'Pour Bruno')
})

test("rejouer depuis l'historique : le morceau repart au nom de celui qui le relance", () => {
  const room = setup(2)
  const a1 = room.add(0)
  room.add(0)
  ok(room.act(0, 'hostSkip'))
  const r = ok(room.act(1, 'replay', { trackId: a1 }))
  const copy = room.s().queue.find((t) => t.id === r.trackId)
  assert.equal(copy?.addedById, room.m[1].id)
  assert.equal(copy?.sourceId, room.s().history[0].sourceId)
  refused(room.act(1, 'replay', { trackId: a1 }), 409)
  assert.equal(room.s().feed.at(-1)?.kind, 'replay')
})

test('la musique continue pendant les jeux : lancement possible en pleine partie', () => {
  const created = createGroup('Jeux', 'Hôte')
  const db = readDb({ groupId: created.group.id })
  db.groups[0].party.status = 'playing'
  db.groups[0].party.currentGameId = 'uno'
  writeDb(db)
  ok(startMusic(created.group.id, created.memberId, created.memberToken, 'youtube'))
  refused(startMusic(created.group.id, created.memberId, created.memberToken, 'youtube'), 409)
})

test('fin de soirée : récap, platine libérée, export, puis l’hôte referme', () => {
  const room = setup(3)
  const t = room.t0
  const a1 = room.add(0)
  room.add(1)
  room.add(2)
  ok(room.act(1, 'react', { emoji: '🔥' }, t + 1000))
  ok(room.act(2, 'react', { emoji: '❤️' }, t + 2000))
  ok(room.act(0, 'hostSkip'))
  ok(room.act(0, 'react', { emoji: '🙌' }, t + 3000))
  ok(claimPlatine(room.g, 'sock-1', { platineId: 'platine-aaa' }))
  const stop = ok(stopMusic(room.g, room.m[0].id, room.m[0].token, t + 3_600_000))
  assert.equal(stop.displacedSocketId, 'sock-1')
  assert.deepEqual(platineStatus(room.g), { online: false, kind: null })
  const recap = room.s().recap!
  assert.ok(room.s().endedAt)
  assert.equal(recap.tracksPlayed, 2)
  assert.equal(recap.totalReactions, 3)
  assert.equal(recap.topTracks[0].title, room.s().history.find((h) => h.id === a1)?.title)
  assert.equal(recap.djs[0].memberId, room.m[0].id)
  assert.deepEqual(recap.djs.map((d) => d.memberId), [room.m[0].id, room.m[1].id])
  assert.equal(recap.playlist.length, 2)
  assert.equal(recap.endedAt - recap.startedAt > 0, true)
  const url = youtubePlaylistUrl(recap.playlist.map((p) => p.sourceId))
  assert.match(url, /^https:\/\/www\.youtube\.com\/watch_videos\?video_ids=vid\d{8},vid\d{8}$/)
  assert.equal(new URL(youtubePlaylistUrl(Array.from({ length: 80 }, () => yt()))).searchParams.get('video_ids')?.split(',').length, 50)

  refused(room.act(1, 'add', { source: 'youtube', sourceId: yt() }))
  refused(claimPlatine(room.g, 'sock-1', { platineId: 'platine-aaa' }))
  ok(room.act(0, 'dismiss'))
  assert.equal(readMusic(room.g), null)
})

test('rétro-compatibilité : une session enregistrée avant la refonte se relit et fonctionne', () => {
  const old = {
    source: 'youtube',
    hostMemberId: 'h',
    queue: [{ id: 'tr-1', source: 'youtube', sourceId: 'abcdefghijk', title: 'Ancien', artist: '', thumbnail: null, durationMs: null, addedById: 'h', bumpVotes: [], addedAt: 1 }],
    current: null,
    history: [],
    isPlaying: false,
    skipVotes: [],
    playedCounts: {},
    platineId: 'pl-x',
    currentStartedAt: null,
    startedAt: 5,
  }
  const s = normalizeMusicSession(old)!
  assert.equal(s.settings.continuous, true)
  assert.equal(s.settings.output, 'device')
  assert.deepEqual(s.feed, [])
  assert.equal(s.endedAt, null)
  assert.equal(typeof s.platineKey, 'string')
  assert.equal(orderedQueue(s)[0].id, 'tr-1')
  assert.equal(normalizeMusicSession({ source: 'deezer' }), null)

  // Et pour de vrai, en base : la session ancienne accepte les nouvelles actions.
  const created = createGroup('Ancienne', 'Hôte')
  const db = readDb({ groupId: created.group.id })
  db.groups[0].music = { ...old, hostMemberId: created.memberId } as unknown as MusicSession
  writeDb(db)
  const id = ok(musicAction(created.group.id, created.memberId, created.memberToken, 'add', { source: 'youtube', sourceId: yt(), title: 'Neuf' }, { onlineIds: [] })).trackId
  assert.ok(readMusic(created.group.id)?.queue.some((t) => t.id === id) || readMusic(created.group.id)?.current?.id === id)
  ok(musicAction(created.group.id, created.memberId, created.memberToken, 'react', { emoji: '🔥' }, { onlineIds: [] }))
})

test('YouTube sans réseau : liens reconnus, titres remis en forme, durées de l’API officielle', () => {
  for (const link of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x',
    'https://youtu.be/dQw4w9WgXcQ?t=3',
    'youtube.com/shorts/dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'dQw4w9WgXcQ',
  ]) {
    assert.equal(parseYouTubeId(link), 'dQw4w9WgXcQ', link)
  }
  assert.equal(parseYouTubeId('daft punk'), null)
  assert.deepEqual(tidyYouTubeTitle('Daft Punk - Get Lucky (Official Audio) ft. Pharrell', 'DaftPunkVEVO'), {
    title: 'Get Lucky ft. Pharrell',
    artist: 'Daft Punk',
  })
  assert.deepEqual(tidyYouTubeTitle('Alors on danse [Clip Officiel]', 'Stromae - Topic'), { title: 'Alors on danse', artist: 'Stromae' })
  assert.deepEqual(tidyYouTubeTitle('A - B - C', 'Chaîne'), { title: 'A - B - C', artist: 'Chaîne' })
  assert.equal(parseIsoDuration('PT3M12S'), 192_000)
  assert.equal(parseIsoDuration('PT1H2M'), 3_720_000)
  assert.equal(parseIsoDuration('P0D'), null)
  assert.equal(parseIsoDuration(undefined), null)
})
