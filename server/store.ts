import { readDb, writeDb, deleteMember as deleteMemberRow } from './db'
import type { StoredGroup, StoredMember } from './types'
import type { Group, Member, PartySession } from '../src/types'
import { computeScores, getArchetypeId } from '../src/lib/scoring'
import { questions } from '../src/data/questions'

const MEMBER_COLORS = ['#f472b6', '#60a5fa', '#fb923c', '#34d399', '#a78bfa', '#fbbf24', '#38bdf8', '#f87171']
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomString(length: number, alphabet: string): string {
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function makeId(): string {
  return randomString(12, 'abcdefghijklmnopqrstuvwxyz0123456789')
}

function makeToken(): string {
  return randomString(32, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
}

function generateUniqueCode(db: { groups: StoredGroup[] }): string {
  let code = randomString(5, CODE_CHARS)
  while (db.groups.some((g) => g.code === code)) {
    code = randomString(5, CODE_CHARS)
  }
  return code
}

export type ApiError = { error: string; status: number }

export function isApiError(x: unknown): x is ApiError {
  return typeof x === 'object' && x !== null && 'error' in x && 'status' in x
}

export function sanitizeMember(member: StoredMember, isSelf: boolean): Member {
  const { token, answers, ...rest } = member
  void token
  return {
    ...rest,
    answers: isSelf ? answers : {},
  }
}

/**
 * Hides per-player secret state from everyone except its owner, following platform-wide
 * conventions any game module can opt into just by naming its roundData fields this way.
 *
 * Règle sociale du produit : **l'action est publique, le choix reste privé.**
 * Savoir que Léo a voté est un fait social — c'est ce qui permet au téléphone de rester une
 * fenêtre sur la soirée (« Léo a choisi », « on attend Marie ») au lieu d'un écran d'attente mort.
 * Savoir POUR QUI il a voté détruirait le jeu. On diffuse donc les CLÉS, jamais les VALEURS.
 *
 *  - `roundData.votes: Record<memberId, choice>` -> replaced with `votedCount` +
 *    `votedMemberIds` (qui a voté) + `yourVote` (ton propre choix, et lui seul).
 *  - `roundData.hands: Record<memberId, card[]>` -> replaced with `yourHand` (keeps card hands
 *    private to their owner, e.g. for Pyramide).
 *  - `roundData.submissions: Record<memberId, text>` -> replaced with `submittedCount` +
 *    `yourSubmission` (same idea as votes, for free-text answers, e.g. Qui a écrit ça ?).
 *  - `roundData.guesses: Record<memberId, ...>` -> replaced with `guessedCount` +
 *    `guessedMemberIds` + `yourGuesses` (comme `votes`, mais pour un tour où chacun dépose
 *    plusieurs choix, e.g. l'attribution phrase par phrase dans Qui a écrit ça ?).
 *  - `roundData.secrets: {...}` -> stripped entirely for every client, including its own owner
 *    (for state nobody should see yet, e.g. the mystery member's identity in Profil secret). The
 *    game module is responsible for moving values out of `secrets` into a public field once they
 *    become safe to reveal.
 */
function sanitizeParty(party: PartySession, requestingMemberId: string | null): PartySession {
  let roundData = party.roundData
  if (!roundData || typeof roundData !== 'object') return party

  if ('votes' in roundData) {
    const { votes, ...rest } = roundData as { votes: Record<string, string> } & Record<string, unknown>
    roundData = {
      ...rest,
      votedCount: Object.keys(votes).length,
      // Les clés (qui a voté) partent, les valeurs (pour qui) restent au serveur.
      votedMemberIds: Object.keys(votes),
      yourVote: requestingMemberId ? (votes[requestingMemberId] ?? null) : null,
    }
  }

  if (roundData && typeof roundData === 'object' && 'hands' in roundData) {
    const { hands, ...rest } = roundData as { hands: Record<string, unknown> } & Record<string, unknown>
    let yourHand = requestingMemberId ? (hands[requestingMemberId] ?? []) : []
    // `handsHidden: true` (e.g. Pyramide after the memorize window) keeps even the owner blind:
    // only card ids/slot count survive, so peeking at the network payload reveals nothing.
    if (rest.handsHidden && Array.isArray(yourHand)) {
      yourHand = yourHand.map((c: { id: string }) => ({ id: c.id }))
    }
    roundData = {
      ...rest,
      yourHand,
    }
  }

  if (roundData && typeof roundData === 'object' && 'submissions' in roundData) {
    const { submissions, ...rest } = roundData as { submissions: Record<string, string> } & Record<string, unknown>
    roundData = {
      ...rest,
      submittedCount: Object.keys(submissions).length,
      // Même règle : on sait QUI a rendu sa copie, jamais ce qu'elle contient. Dans « Qui a écrit
      // ça ? », savoir que Léo a rendu son texte ne dit pas lequel des textes mélangés est le sien.
      submittedMemberIds: Object.keys(submissions),
      yourSubmission: requestingMemberId ? (submissions[requestingMemberId] ?? null) : null,
    }
  }

  if (roundData && typeof roundData === 'object' && 'guesses' in roundData) {
    const { guesses, ...rest } = roundData as {
      guesses: Record<string, unknown>
    } & Record<string, unknown>
    // Même règle que `votes`, pour les jeux où un joueur dépose PLUSIEURS choix dans un tour
    // (« Qui a écrit ça ? » : une attribution par phrase). La table brute partait en clair : tout
    // le monde pouvait lire, dans la charge socket, qui avait accusé qui — avant la révélation.
    roundData = {
      ...rest,
      guessedCount: Object.keys(guesses).length,
      guessedMemberIds: Object.keys(guesses),
      yourGuesses: requestingMemberId ? (guesses[requestingMemberId] ?? {}) : {},
    }
  }

  if (roundData && typeof roundData === 'object' && 'secrets' in roundData) {
    const { secrets, ...rest } = roundData as { secrets: unknown } & Record<string, unknown>
    // `secrets` est toujours supprimé pour tout le monde (y compris la TV). Chaque joueur ne reçoit
    // que la part qui le concerne, dérivée ici selon des conventions nommées :
    //  - `authorByIndex` -> `yourEntryIndex` (Qui a écrit ça ? : masquer sa propre phrase).
    //  - `wordByMember`  -> `yourWord` (L'Intrus : son mot secret ; `null` = Mr. White, qui n'en a
    //    pas — d'où la distinction volontaire entre valeur nulle et clé absente).
    //  - `truthByMember` -> `yourTruth` (L'Intrus : la vérité complète, servie aux seuls éliminés).
    const derived: Record<string, unknown> = {}
    if (requestingMemberId && secrets && typeof secrets === 'object') {
      if ('authorByIndex' in secrets) {
        const authorByIndex = (secrets as { authorByIndex: Record<number, string> }).authorByIndex
        for (const [idx, authorId] of Object.entries(authorByIndex)) {
          if (authorId === requestingMemberId) {
            derived.yourEntryIndex = Number(idx)
            break
          }
        }
      }
      if ('wordByMember' in secrets) {
        const wordByMember = (secrets as { wordByMember: Record<string, string | null> }).wordByMember
        if (requestingMemberId in wordByMember) derived.yourWord = wordByMember[requestingMemberId]
      }
      if ('truthByMember' in secrets) {
        const truthByMember = (secrets as { truthByMember: Record<string, unknown> }).truthByMember
        if (requestingMemberId in truthByMember) derived.yourTruth = truthByMember[requestingMemberId]
      }
    }
    roundData = { ...rest, ...derived }
  }

  return { ...party, roundData }
}

export function sanitizeGroup(group: StoredGroup, requestingMemberId: string | null): Group {
  return {
    ...group,
    members: group.members.map((m) => sanitizeMember(m, m.id === requestingMemberId)),
    party: sanitizeParty(group.party, requestingMemberId),
  }
}

export function createGroup(groupName: string, pseudo: string): { group: Group; memberId: string; memberToken: string } {
  const db = readDb()
  const groupId = makeId()
  const memberId = makeId()
  const token = makeToken()

  const member: StoredMember = {
    id: memberId,
    pseudo: pseudo.trim().slice(0, 24),
    color: MEMBER_COLORS[0],
    answers: {},
    quizAttempt: 0,
    scores: null,
    archetypeId: null,
    finishedAt: null,
    xp: 0,
    badges: [],
    gameStats: {},
    token,
    photoUrl: null,
  }

  const group: StoredGroup = {
    id: groupId,
    code: generateUniqueCode(db),
    name: groupName.trim().slice(0, 40) || 'Mon groupe',
    createdAt: Date.now(),
    members: [member],
    party: {
      status: 'lobby',
      hostMemberId: memberId,
      currentGameId: null,
      phase: null,
      round: 0,
      roundData: null,
      participantIds: [],
    },
    adultModeEnabled: false,
    music: null,
  }

  db.groups.push(group)
  writeDb(db)

  return { group: sanitizeGroup(group, memberId), memberId, memberToken: token }
}

export function joinGroup(
  code: string,
  pseudo: string,
): { group: Group; memberId: string; memberToken: string } | ApiError {
  const db = readDb()
  const normalized = code.trim().toUpperCase()
  const group = db.groups.find((g) => g.code === normalized)
  if (!group) return { error: 'Code introuvable. Vérifie et réessaie.', status: 404 }

  const trimmedPseudo = pseudo.trim().slice(0, 24)
  if (group.members.some((m) => m.pseudo.toLowerCase() === trimmedPseudo.toLowerCase())) {
    return { error: 'Ce pseudo est déjà pris dans ce groupe.', status: 409 }
  }

  const memberId = makeId()
  const token = makeToken()
  const member: StoredMember = {
    id: memberId,
    pseudo: trimmedPseudo,
    color: MEMBER_COLORS[group.members.length % MEMBER_COLORS.length],
    answers: {},
    quizAttempt: 0,
    scores: null,
    archetypeId: null,
    finishedAt: null,
    xp: 0,
    badges: [],
    gameStats: {},
    token,
    photoUrl: null,
  }
  group.members.push(member)
  writeDb(db)

  return { group: sanitizeGroup(group, memberId), memberId, memberToken: token }
}

export function findAuthorizedMember(
  db: { groups: StoredGroup[] },
  groupId: string,
  memberId: string,
  memberToken: string,
): { group: StoredGroup; member: StoredMember } | ApiError {
  const group = db.groups.find((g) => g.id === groupId)
  if (!group) return { error: 'Groupe introuvable.', status: 404 }
  const member = group.members.find((m) => m.id === memberId)
  if (!member) return { error: 'Membre introuvable.', status: 404 }
  if (member.token !== memberToken) return { error: 'Non autorisé.', status: 403 }
  return { group, member }
}

export function getGroup(groupId: string, memberId: string | null, memberToken: string | null): Group | ApiError {
  const db = readDb()
  const group = db.groups.find((g) => g.id === groupId)
  if (!group) return { error: 'Groupe introuvable.', status: 404 }

  let verifiedMemberId: string | null = null
  if (memberId && memberToken) {
    const member = group.members.find((m) => m.id === memberId)
    if (member && member.token === memberToken) verifiedMemberId = memberId
  }
  return sanitizeGroup(group, verifiedMemberId)
}

export function saveAnswer(
  groupId: string,
  memberId: string,
  memberToken: string,
  questionId: string,
  optionId: string,
): { ok: true } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result

  const question = questions.find((q) => q.id === questionId)
  if (!question || !question.options.some((o) => o.id === optionId)) {
    return { error: 'Question ou réponse invalide.', status: 400 }
  }
  if (result.member.finishedAt) {
    return { error: 'Questionnaire déjà terminé.', status: 409 }
  }

  result.member.answers[questionId] = optionId
  writeDb(db)
  return { ok: true }
}

/**
 * Refaire le test.
 *
 * Le salon proposait déjà « refaire le test », mais le serveur refusait toute réponse une fois
 * `finishedAt` posé : le bouton menait à une erreur 409. Avec le tirage aléatoire, un second
 * passage a maintenant un vrai intérêt — il fallait donc que ce soit réellement possible.
 *
 * On repart d'une ardoise vide ET on incrémente `quizAttempt` : c'est ce compteur qui sème le
 * tirage, donc ce qui garantit un jeu de questions différent du précédent.
 */
export function restartMemberQuiz(
  groupId: string,
  memberId: string,
  memberToken: string,
): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result

  result.member.answers = {}
  result.member.scores = null
  result.member.archetypeId = null
  result.member.finishedAt = null
  result.member.quizAttempt = (result.member.quizAttempt ?? 0) + 1
  writeDb(db)

  return { group: sanitizeGroup(result.group, memberId) }
}

const MAX_PHOTO_LENGTH = 500_000 // ~500KB of base64, plenty for a client-compressed avatar photo

export function updateMemberPhoto(
  groupId: string,
  memberId: string,
  memberToken: string,
  photoUrl: string | null,
): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result

  if (photoUrl !== null) {
    if (typeof photoUrl !== 'string' || !photoUrl.startsWith('data:image/') || photoUrl.length > MAX_PHOTO_LENGTH) {
      return { error: 'Photo invalide ou trop volumineuse.', status: 400 }
    }
  }

  result.member.photoUrl = photoUrl
  writeDb(db)
  return { group: sanitizeGroup(result.group, memberId) }
}

/**
 * Lets the host remove a member entirely — the escape hatch for the "closed the tab, came back,
 * had to pick a new pseudo, old ghost member stuck in the room/game forever" scenario. The ghost
 * is deleted outright (not just marked offline) so every game module's own completion checks
 * (which iterate `group.members` or `party.participantIds`) stop waiting on someone who no longer
 * exists, instead of hanging the round forever.
 */
export function kickMember(
  groupId: string,
  hostMemberId: string,
  hostToken: string,
  targetMemberId: string,
): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, hostMemberId, hostToken)
  if (isApiError(result)) return result
  const { group } = result

  if (group.party.hostMemberId !== hostMemberId) {
    return { error: "Seul·e l'hôte peut exclure un joueur.", status: 403 }
  }
  if (targetMemberId === hostMemberId) {
    return { error: "Tu ne peux pas t'exclure toi-même.", status: 400 }
  }
  const targetIndex = group.members.findIndex((m) => m.id === targetMemberId)
  if (targetIndex === -1) {
    return { error: 'Membre introuvable.', status: 404 }
  }

  group.members.splice(targetIndex, 1)
  group.party.participantIds = group.party.participantIds.filter((id) => id !== targetMemberId)
  writeDb(db)
  deleteMemberRow(targetMemberId)

  return { group: sanitizeGroup(group, hostMemberId) }
}

export function finishMember(
  groupId: string,
  memberId: string,
  memberToken: string,
): { group: Group } | ApiError {
  const db = readDb()
  const result = findAuthorizedMember(db, groupId, memberId, memberToken)
  if (isApiError(result)) return result

  const scores = computeScores(result.member.answers)
  result.member.scores = scores
  result.member.archetypeId = getArchetypeId(scores)
  result.member.finishedAt = Date.now()
  writeDb(db)

  return { group: sanitizeGroup(result.group, memberId) }
}
