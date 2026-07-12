import SqliteDatabase from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database, StoredGroup, StoredMember, GameHistoryEntry } from './types'
import type { PartyStatus } from '../src/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.MINDMATCH_DB_PATH || path.join(__dirname, 'data', 'db.sqlite3')

const dir = path.dirname(DB_PATH)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const sqlite = new SqliteDatabase(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    adult_mode_enabled INTEGER NOT NULL DEFAULT 0,
    party_status TEXT NOT NULL DEFAULT 'lobby',
    party_host_member_id TEXT NOT NULL,
    party_current_game_id TEXT,
    party_phase TEXT,
    party_round INTEGER NOT NULL DEFAULT 0,
    party_round_data TEXT
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    pseudo TEXT NOT NULL,
    color TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '{}',
    scores TEXT,
    archetype_id TEXT,
    finished_at INTEGER,
    xp INTEGER NOT NULL DEFAULT 0,
    badges TEXT NOT NULL DEFAULT '[]',
    game_stats TEXT NOT NULL DEFAULT '{}',
    token TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);

  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    game_name TEXT NOT NULL,
    ended_at INTEGER NOT NULL,
    rounds_played INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_history_group ON game_history(group_id, ended_at DESC);
`)

interface GroupRow {
  id: string
  code: string
  name: string
  created_at: number
  adult_mode_enabled: number
  party_status: string
  party_host_member_id: string
  party_current_game_id: string | null
  party_phase: string | null
  party_round: number
  party_round_data: string | null
}

interface MemberRow {
  id: string
  group_id: string
  pseudo: string
  color: string
  answers: string
  scores: string | null
  archetype_id: string | null
  finished_at: number | null
  xp: number
  badges: string
  game_stats: string
  token: string
}

function rowToMember(row: MemberRow): StoredMember {
  return {
    id: row.id,
    pseudo: row.pseudo,
    color: row.color,
    answers: JSON.parse(row.answers),
    scores: row.scores ? JSON.parse(row.scores) : null,
    archetypeId: row.archetype_id,
    finishedAt: row.finished_at,
    xp: row.xp,
    badges: JSON.parse(row.badges),
    gameStats: JSON.parse(row.game_stats),
    token: row.token,
  }
}

function rowToGroup(row: GroupRow, members: StoredMember[]): StoredGroup {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    createdAt: row.created_at,
    adultModeEnabled: !!row.adult_mode_enabled,
    members,
    party: {
      status: row.party_status as PartyStatus,
      hostMemberId: row.party_host_member_id,
      currentGameId: row.party_current_game_id,
      phase: row.party_phase,
      round: row.party_round,
      roundData: row.party_round_data ? JSON.parse(row.party_round_data) : null,
    },
  }
}

const selectGroups = sqlite.prepare('SELECT * FROM groups')
const selectMembers = sqlite.prepare('SELECT * FROM members')

export function readDb(): Database {
  const groupRows = selectGroups.all() as GroupRow[]
  const memberRows = selectMembers.all() as MemberRow[]

  const membersByGroup = new Map<string, StoredMember[]>()
  for (const row of memberRows) {
    const list = membersByGroup.get(row.group_id) ?? []
    list.push(rowToMember(row))
    membersByGroup.set(row.group_id, list)
  }

  return { groups: groupRows.map((row) => rowToGroup(row, membersByGroup.get(row.id) ?? [])) }
}

const upsertGroup = sqlite.prepare(`
  INSERT INTO groups (id, code, name, created_at, adult_mode_enabled, party_status, party_host_member_id, party_current_game_id, party_phase, party_round, party_round_data)
  VALUES (@id, @code, @name, @created_at, @adult_mode_enabled, @party_status, @party_host_member_id, @party_current_game_id, @party_phase, @party_round, @party_round_data)
  ON CONFLICT(id) DO UPDATE SET
    code = excluded.code,
    name = excluded.name,
    adult_mode_enabled = excluded.adult_mode_enabled,
    party_status = excluded.party_status,
    party_host_member_id = excluded.party_host_member_id,
    party_current_game_id = excluded.party_current_game_id,
    party_phase = excluded.party_phase,
    party_round = excluded.party_round,
    party_round_data = excluded.party_round_data
`)

const upsertMember = sqlite.prepare(`
  INSERT INTO members (id, group_id, pseudo, color, answers, scores, archetype_id, finished_at, xp, badges, game_stats, token)
  VALUES (@id, @group_id, @pseudo, @color, @answers, @scores, @archetype_id, @finished_at, @xp, @badges, @game_stats, @token)
  ON CONFLICT(id) DO UPDATE SET
    pseudo = excluded.pseudo,
    color = excluded.color,
    answers = excluded.answers,
    scores = excluded.scores,
    archetype_id = excluded.archetype_id,
    finished_at = excluded.finished_at,
    xp = excluded.xp,
    badges = excluded.badges,
    game_stats = excluded.game_stats,
    token = excluded.token
`)

const writeTx = sqlite.transaction((db: Database) => {
  for (const group of db.groups) {
    upsertGroup.run({
      id: group.id,
      code: group.code,
      name: group.name,
      created_at: group.createdAt,
      adult_mode_enabled: group.adultModeEnabled ? 1 : 0,
      party_status: group.party.status,
      party_host_member_id: group.party.hostMemberId,
      party_current_game_id: group.party.currentGameId,
      party_phase: group.party.phase,
      party_round: group.party.round,
      party_round_data: group.party.roundData ? JSON.stringify(group.party.roundData) : null,
    })
    for (const member of group.members) {
      upsertMember.run({
        id: member.id,
        group_id: group.id,
        pseudo: member.pseudo,
        color: member.color,
        answers: JSON.stringify(member.answers),
        scores: member.scores ? JSON.stringify(member.scores) : null,
        archetype_id: member.archetypeId,
        finished_at: member.finishedAt,
        xp: member.xp,
        badges: JSON.stringify(member.badges),
        game_stats: JSON.stringify(member.gameStats),
        token: member.token,
      })
    }
  }
})

export function writeDb(db: Database): void {
  writeTx(db)
}

const insertHistory = sqlite.prepare(`
  INSERT INTO game_history (group_id, game_id, game_name, ended_at, rounds_played)
  VALUES (@groupId, @gameId, @gameName, @endedAt, @roundsPlayed)
`)

/** Appends one durable "this game just finished" record — separate from the live, overwritten-on-next-game
 * `groups.party_round_data` blob, so a group's game history survives forever (an append-only log, not
 * part of the readDb()/writeDb() current-state snapshot). */
export function appendGameHistory(entry: Omit<GameHistoryEntry, 'id'>): void {
  insertHistory.run(entry)
}

const selectHistory = sqlite.prepare(`
  SELECT id, group_id as groupId, game_id as gameId, game_name as gameName, ended_at as endedAt, rounds_played as roundsPlayed
  FROM game_history WHERE group_id = ? ORDER BY ended_at DESC LIMIT ?
`)

export function getRecentGameHistory(groupId: string, limit = 10): GameHistoryEntry[] {
  return selectHistory.all(groupId, limit) as GameHistoryEntry[]
}
