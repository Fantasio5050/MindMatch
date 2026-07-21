// Charge un éventuel fichier .env AVANT tout le reste (db, spotify… lisent process.env au chargement).
// En Docker, les variables viennent de docker-compose ; ce fichier .env est simplement absent.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createGroup,
  joinGroup,
  getGroup,
  saveAnswer,
  finishMember,
  updateMemberPhoto,
  findAuthorizedMember,
  isApiError,
} from './store'
import { attachRealtime } from './realtime'
import { readDb, getRecentGameHistory } from './db'
import { spotifyConfigHandler, spotifySearchHandler } from './spotify'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const DIST_DIR = path.join(__dirname, '..', 'dist')

const app = express()
app.use(cors())
// Default 100kb is too small for a (client-compressed) profile photo data URL.
app.use(express.json({ limit: '2mb' }))

const httpServer = http.createServer(app)
const { broadcastRoom } = attachRealtime(httpServer)

const api = express.Router()

api.post('/groups', (req, res) => {
  const { groupName, pseudo } = req.body ?? {}
  if (typeof groupName !== 'string' || typeof pseudo !== 'string' || !pseudo.trim()) {
    return res.status(400).json({ error: 'groupName et pseudo sont requis.' })
  }
  const result = createGroup(groupName, pseudo)
  res.status(201).json(result)
})

api.post('/groups/join', (req, res) => {
  const { code, pseudo } = req.body ?? {}
  if (typeof code !== 'string' || typeof pseudo !== 'string' || !pseudo.trim()) {
    return res.status(400).json({ error: 'code et pseudo sont requis.' })
  }
  const result = joinGroup(code, pseudo)
  if (isApiError(result)) return res.status(result.status).json({ error: result.error })
  broadcastRoom(result.group.id)
  res.status(201).json(result)
})

api.get('/groups/:groupId', (req, res) => {
  const { groupId } = req.params
  const memberId = typeof req.query.memberId === 'string' ? req.query.memberId : null
  const memberToken = typeof req.query.memberToken === 'string' ? req.query.memberToken : null
  const result = getGroup(groupId, memberId, memberToken)
  if (isApiError(result)) return res.status(result.status).json({ error: result.error })
  res.json({ group: result })
})

api.put('/groups/:groupId/members/:memberId/answer', (req, res) => {
  const { groupId, memberId } = req.params
  const { memberToken, questionId, optionId } = req.body ?? {}
  if (typeof memberToken !== 'string' || typeof questionId !== 'string' || typeof optionId !== 'string') {
    return res.status(400).json({ error: 'memberToken, questionId et optionId sont requis.' })
  }
  const result = saveAnswer(groupId, memberId, memberToken, questionId, optionId)
  if (isApiError(result)) return res.status(result.status).json({ error: result.error })
  broadcastRoom(groupId)
  res.json(result)
})

api.post('/groups/:groupId/members/:memberId/finish', (req, res) => {
  const { groupId, memberId } = req.params
  const { memberToken } = req.body ?? {}
  if (typeof memberToken !== 'string') {
    return res.status(400).json({ error: 'memberToken est requis.' })
  }
  const result = finishMember(groupId, memberId, memberToken)
  if (isApiError(result)) return res.status(result.status).json({ error: result.error })
  broadcastRoom(groupId)
  res.json(result)
})

api.put('/groups/:groupId/members/:memberId/photo', (req, res) => {
  const { groupId, memberId } = req.params
  const { memberToken, photoUrl } = req.body ?? {}
  if (typeof memberToken !== 'string' || (photoUrl !== null && typeof photoUrl !== 'string')) {
    return res.status(400).json({ error: 'memberToken et photoUrl (ou null) sont requis.' })
  }
  const result = updateMemberPhoto(groupId, memberId, memberToken, photoUrl)
  if (isApiError(result)) return res.status(result.status).json({ error: result.error })
  broadcastRoom(groupId)
  res.json(result)
})

api.get('/groups/:groupId/history', (req, res) => {
  const { groupId } = req.params
  const memberId = typeof req.query.memberId === 'string' ? req.query.memberId : ''
  const memberToken = typeof req.query.memberToken === 'string' ? req.query.memberToken : ''
  const authResult = findAuthorizedMember(readDb(), groupId, memberId, memberToken)
  if (isApiError(authResult)) return res.status(authResult.status).json({ error: authResult.error })
  res.json({ history: getRecentGameHistory(groupId) })
})

// Mode Soirée — source Spotify (recherche du catalogue côté serveur, sans exposer les identifiants).
api.get('/spotify/config', spotifyConfigHandler)
api.get('/spotify/search', spotifySearchHandler)

app.use('/api', api)

app.use(express.static(DIST_DIR))
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) res.status(404).send('Build introuvable — lance `npm run build` avant `npm start`.')
  })
})

httpServer.listen(PORT, () => {
  console.log(`MindMatch server listening on http://localhost:${PORT}`)
})
