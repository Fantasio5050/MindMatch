export type ConstraintType =
  | 'question'      // Tu ne peux parler qu'en posant des questions
  | 'contradict'    // Tu dois contredire tout le monde
  | 'flirt'         // Tu dois draguer la personne à ta gauche sans le montrer
  | 'laugh'         // Tu dois rire toutes les 30 secondes
  | 'pirate'        // Tu parles comme un pirate
  | 'whisper'       // Tu ne parles qu'en chuchotant
  | 'compliment'    // Tu dois complimenter chaque joueur au moins une fois
  | 'negative'      // Tu ne peux dire que des choses négatives
  | 'foreign'       // Tu parles avec un accent étranger
  | 'robot'         // Tu parles comme un robot
  | 'song'          // Tu dois citer des paroles de chansons
  | 'riddle'        // Tu réponds toujours par une énigme
  | 'stutter'       // Tu bégayes sur les mots de plus de 5 lettres
  | 'repeat'        // Tu répètes la dernière phrase de la personne avant toi
  | 'ignore'        // Tu ignores une personne spécifique du groupe
  | 'agree'         // Tu es d'accord avec tout le monde
  | 'number'        // Tu dois inclure un nombre dans chaque phrase
  | 'animal'        // Tu dois imiter un animal au début de chaque phrase
  | 'english'       // Tu mélanges français et anglais
  | 'slow'          // Tu parles très lentement

export interface QuiproquoConstraint {
  id: string
  type: ConstraintType
  text: string
  description: string
}

export const QUIPROQUO_CONSTRAINTS: QuiproquoConstraint[] = [
  { id: 'qc-1', type: 'question', text: 'Tu ne peux parler qu\'en posant des questions', description: 'Chaque phrase que tu dis doit être une question.' },
  { id: 'qc-2', type: 'contradict', text: 'Tu dois contredire tout le monde', description: 'Peu importe ce qu\'on dit, tu n\'es pas d\'accord.' },
  { id: 'qc-3', type: 'flirt', text: 'Tu dois draguer la personne à ta gauche', description: 'Subtilement. Sans que ça se voie trop.' },
  { id: 'qc-4', type: 'laugh', text: 'Tu dois rire toutes les 30 secondes', description: 'Un petit rire, pas un éclat. Toutes les 30 secondes.' },
  { id: 'qc-5', type: 'pirate', text: 'Tu parles comme un pirate', description: 'Matelot, bateau, rhum, trésor… Utilise le vocabulaire !' },
  { id: 'qc-6', type: 'whisper', text: 'Tu ne parles qu\'en chuchotant', description: 'Tout ce que tu dis doit être chuchoté.' },
  { id: 'qc-7', type: 'compliment', text: 'Tu dois complimenter chaque joueur au moins une fois', description: 'Un compliment sincère pour chacun pendant la conversation.' },
  { id: 'qc-8', type: 'negative', text: 'Tu ne peux dire que des choses négatives', description: 'Tout est nul, tout est horrible, tout est catastrophique.' },
  { id: 'qc-9', type: 'foreign', text: 'Tu parles avec un accent étranger', description: 'Choisis un accent (anglais, espagnol, russe…) et garde-le.' },
  { id: 'qc-10', type: 'robot', text: 'Tu parles comme un robot', description: 'Monotone, précis, sans émotion. BIP BOOP.' },
  { id: 'qc-11', type: 'song', text: 'Tu dois citer des paroles de chansons', description: 'Chaque phrase doit contenir une citation de chanson.' },
  { id: 'qc-12', type: 'riddle', text: 'Tu réponds toujours par une énigme', description: 'Au lieu de répondre directement, pose une énigme.' },
  { id: 'qc-13', type: 'stutter', text: 'Tu bégayes sur les mots de plus de 5 lettres', description: 'Les mots longs te posent problème…' },
  { id: 'qc-14', type: 'repeat', text: 'Tu répètes la dernière phrase de la personne avant toi', description: 'Avant de parler, répète ce que vient de dire la personne précédente.' },
  { id: 'qc-15', type: 'ignore', text: 'Tu ignores une personne du groupe', description: 'Tu choisis secrètement quelqu\'un et tu fais comme s\'il n\'existait pas.' },
  { id: 'qc-16', type: 'agree', text: 'Tu es d\'accord avec tout le monde', description: 'Oui, absolument, tout à fait, c\'est ça, parfaitement.' },
  { id: 'qc-17', type: 'number', text: 'Tu dois inclure un nombre dans chaque phrase', description: 'Un nombre, n\'importe lequel, dans chaque phrase.' },
  { id: 'qc-18', type: 'animal', text: 'Tu imites un animal au début de chaque phrase', description: 'Meuh, woof, miaou, coin coin… avant chaque phrase.' },
  { id: 'qc-19', type: 'english', text: 'Tu mélanges français et anglais', description: 'Every phrase contains some words in English, you see?' },
  { id: 'qc-20', type: 'slow', text: 'Tu parles très lentement', description: 'Trèèèès lentement. Chaque mot est séparé par une pause.' },
]

export const QUIPROQUO_TOPICS: string[] = [
  'Quel est le meilleur fast-food ?',
  'Faut-il interdire Netflix ?',
  'Décris ton dernier rêve',
  'Quel est le pire trait de caractère chez quelqu\'un ?',
  'Si tu pouvais changer une loi, laquelle ?',
  'Quel est le pire cadeau que tu aies reçu ?',
  'Que penses-tu des réseaux sociaux ?',
  'Quel est ton plus grand talent inutile ?',
  'Faut-il faire la vaisselle tout de suite ou plus tard ?',
  'Quel est le pire film que tu aies vu ?',
  'Que ferais-tu avec 1 million d\'euros ?',
  'Quel est le meilleur animal de compagnie ?',
  'Faut-il mettre l\'ananas sur la pizza ?',
  'Que penses-tu des gens qui parlent au cinéma ?',
  'Quel est le pire moyen de transport ?',
  'Que penses-tu du lundi ?',
  'Quel est le pire habit pour un premier rendez-vous ?',
  'Faut-il mettre des chaussettes dans le lit ?',
  'Quel est le meilleur super-pouvoir ?',
  'Que penses-tu des gens qui mettent l\'alarme 10 fois ?',
]

export const DISCUSSION_TIME_SEC = 120