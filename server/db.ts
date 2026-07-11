import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.MINDMATCH_DB_PATH || path.join(__dirname, 'data', 'db.json')

function ensureFile(): void {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ groups: [] } satisfies Database, null, 2))
  }
}

export function readDb(): Database {
  ensureFile()
  const raw = fs.readFileSync(DB_PATH, 'utf-8')
  try {
    return JSON.parse(raw) as Database
  } catch {
    return { groups: [] }
  }
}

export function writeDb(db: Database): void {
  ensureFile()
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}
