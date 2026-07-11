import type { Question } from '../types'

export const questions: Question[] = [
  // ---------- PERSONNALITÉ ----------
  {
    id: 'q1',
    category: 'personality',
    prompt: 'Un week-end libre, sans aucune obligation, tu choisis...',
    options: [
      { id: 'a', emoji: '🎒', label: "Partir à l'aventure sans plan précis", weights: { creativity: 2, independence: 1 } },
      { id: 'b', emoji: '📋', label: 'Organiser un programme parfait avec des amis', weights: { organization: 2, sociability: 1 } },
      { id: 'c', emoji: '📚', label: 'Rester chez toi sur un projet perso', weights: { logic: 1, independence: 2 } },
      { id: 'd', emoji: '🎉', label: 'Monter une sortie de groupe mémorable', weights: { sociability: 2, ambition: 1 } },
    ],
  },
  {
    id: 'q2',
    category: 'personality',
    prompt: 'Face à un problème compliqué, ta première réaction est de...',
    options: [
      { id: 'a', emoji: '📊', label: 'Analyser froidement les données', weights: { logic: 2 } },
      { id: 'b', emoji: '🗣️', label: "Demander conseil autour de toi", weights: { sociability: 1, empathy: 1 } },
      { id: 'c', emoji: '💡', label: 'Chercher une solution hors des sentiers battus', weights: { creativity: 2 } },
      { id: 'd', emoji: '🚀', label: 'Foncer et ajuster en marchant', weights: { ambition: 1, independence: 1 } },
    ],
  },
  {
    id: 'q3',
    category: 'personality',
    prompt: 'Dans un groupe, on te décrit souvent comme...',
    options: [
      { id: 'a', emoji: '✨', label: "Celui/celle qui a toujours une idée originale", weights: { creativity: 2 } },
      { id: 'b', emoji: '🧱', label: 'Le pilier fiable et organisé', weights: { organization: 2 } },
      { id: 'c', emoji: '🔥', label: "Le moteur qui pousse tout le monde à avancer", weights: { ambition: 2 } },
      { id: 'd', emoji: '💛', label: "L'oreille attentive", weights: { empathy: 2 } },
    ],
  },
  {
    id: 'q4',
    category: 'personality',
    prompt: 'Ta chambre ou ton bureau ressemble plutôt à...',
    options: [
      { id: 'a', emoji: '🎨', label: 'Un joyeux bazar créatif', weights: { creativity: 2, organization: -1 } },
      { id: 'b', emoji: '🧹', label: 'Un espace minutieusement rangé', weights: { organization: 2 } },
      { id: 'c', emoji: '🎯', label: "Un mur d'objectifs et de plannings", weights: { ambition: 1, organization: 1 } },
      { id: 'd', emoji: '🌍', label: "Peu importe, tu y es rarement", weights: { independence: 1, sociability: 1 } },
    ],
  },
  {
    id: 'q5',
    category: 'personality',
    prompt: 'Ce qui te motive le plus le matin, c\'est...',
    options: [
      { id: 'a', emoji: '⚡', label: 'Un nouveau défi à relever', weights: { ambition: 2 } },
      { id: 'b', emoji: '🤝', label: 'Le plaisir de retrouver les autres', weights: { sociability: 2 } },
      { id: 'c', emoji: '🦅', label: 'La liberté de faire ce que tu veux', weights: { independence: 2 } },
      { id: 'd', emoji: '📅', label: 'Une routine qui te rassure', weights: { organization: 2 } },
    ],
  },
  {
    id: 'q6',
    category: 'personality',
    prompt: 'Quand un ami traverse une mauvaise passe, tu...',
    options: [
      { id: 'a', emoji: '👂', label: "L'écoutes longuement, sans juger", weights: { empathy: 2 } },
      { id: 'b', emoji: '📝', label: 'Lui proposes un plan d\'action concret', weights: { logic: 1, ambition: 1 } },
      { id: 'c', emoji: '🎢', label: "L'emmènes te changer les idées", weights: { sociability: 1, creativity: 1 } },
      { id: 'd', emoji: '🌿', label: "Lui laisses de l'espace, en restant disponible", weights: { independence: 1, empathy: 1 } },
    ],
  },
  {
    id: 'q7',
    category: 'personality',
    prompt: 'Ton rapport aux règles :',
    options: [
      { id: 'a', emoji: '🎭', label: 'Elles existent pour être réinventées', weights: { creativity: 2, independence: 1 } },
      { id: 'b', emoji: '🏛️', label: 'Elles structurent, donc elles sont utiles', weights: { organization: 2, logic: 1 } },
      { id: 'c', emoji: '🤔', label: 'Tu les suis si elles ont du sens', weights: { logic: 2 } },
      { id: 'd', emoji: '🚪', label: 'Peu importe, tu traces ta route', weights: { independence: 2 } },
    ],
  },
  {
    id: 'q8',
    category: 'personality',
    prompt: 'Ce que tu préfères dans un projet de groupe :',
    options: [
      { id: 'a', emoji: '💭', label: 'Apporter les idées', weights: { creativity: 2 } },
      { id: 'b', emoji: '🗂️', label: 'Coordonner et cadrer', weights: { organization: 2, ambition: 1 } },
      { id: 'c', emoji: '❤️', label: "Souder l'équipe", weights: { sociability: 2, empathy: 1 } },
      { id: 'd', emoji: '🏁', label: "Garder le cap sur l'objectif", weights: { ambition: 2, logic: 1 } },
    ],
  },
  {
    id: 'q9',
    category: 'personality',
    prompt: "Face à l'échec, tu...",
    options: [
      { id: 'a', emoji: '🔍', label: 'Analyses ce qui a cloché point par point', weights: { logic: 2 } },
      { id: 'b', emoji: '🎯', label: 'Rebondis vite vers un nouvel objectif', weights: { ambition: 2 } },
      { id: 'c', emoji: '💬', label: 'En parles avec tes proches', weights: { sociability: 1, empathy: 1 } },
      { id: 'd', emoji: '🚶', label: 'Le vis en solo, le temps de digérer', weights: { independence: 2 } },
    ],
  },
  {
    id: 'q10',
    category: 'personality',
    prompt: 'On te complimente souvent pour...',
    options: [
      { id: 'a', emoji: '🌈', label: 'Ton imagination débordante', weights: { creativity: 2 } },
      { id: 'b', emoji: '🛡️', label: 'Ta fiabilité à toute épreuve', weights: { organization: 2 } },
      { id: 'c', emoji: '🫶', label: 'Ta capacité à comprendre les autres', weights: { empathy: 2 } },
      { id: 'd', emoji: '⚡', label: 'Ton énergie contagieuse en groupe', weights: { sociability: 2 } },
    ],
  },

  // ---------- VALEURS ----------
  {
    id: 'q11',
    category: 'values',
    prompt: 'Ce qui compte le plus dans une amitié :',
    options: [
      { id: 'a', emoji: '🗝️', label: "L'honnêteté brute", weights: { logic: 1, independence: 1 } },
      { id: 'b', emoji: '💞', label: 'Le soutien inconditionnel', weights: { empathy: 2 } },
      { id: 'c', emoji: '🎢', label: 'Le fun et l\'aventure partagée', weights: { creativity: 1, sociability: 1 } },
      { id: 'd', emoji: '⏳', label: 'La fiabilité dans le temps', weights: { organization: 2 } },
    ],
  },
  {
    id: 'q12',
    category: 'values',
    prompt: 'Entre liberté et sécurité, tu choisis...',
    options: [
      { id: 'a', emoji: '🦅', label: 'La liberté, toujours', weights: { independence: 2 } },
      { id: 'b', emoji: '🏠', label: 'La sécurité, sans hésiter', weights: { organization: 1, empathy: 1 } },
      { id: 'c', emoji: '⚖️', label: 'Un équilibre réfléchi', weights: { logic: 1, organization: 1 } },
      { id: 'd', emoji: '🎲', label: 'Ça dépend du moment', weights: { creativity: 1 } },
    ],
  },
  {
    id: 'q13',
    category: 'values',
    prompt: 'Réussir sa vie, c\'est avant tout...',
    options: [
      { id: 'a', emoji: '🏆', label: 'Réaliser de grandes choses', weights: { ambition: 2 } },
      { id: 'b', emoji: '👨‍👩‍👧', label: 'Être entouré des bonnes personnes', weights: { sociability: 2, empathy: 1 } },
      { id: 'c', emoji: '🧭', label: 'Vivre selon ses propres règles', weights: { independence: 2 } },
      { id: 'd', emoji: '🎨', label: 'Créer quelque chose qui te ressemble', weights: { creativity: 2 } },
    ],
  },
  {
    id: 'q14',
    category: 'values',
    prompt: 'Ce que tu ne pardonnes pas :',
    options: [
      { id: 'a', emoji: '🚫', label: 'Le mensonge', weights: { logic: 1, empathy: 1 } },
      { id: 'b', emoji: '💔', label: 'La trahison', weights: { empathy: 1, independence: 1 } },
      { id: 'c', emoji: '😑', label: 'La médiocrité par manque d\'effort', weights: { ambition: 2 } },
      { id: 'd', emoji: '🌪️', label: 'Le désordre permanent', weights: { organization: 2 } },
    ],
  },
  {
    id: 'q15',
    category: 'values',
    prompt: 'Ta plus grande peur :',
    options: [
      { id: 'a', emoji: '📉', label: 'Stagner, ne jamais progresser', weights: { ambition: 2 } },
      { id: 'b', emoji: '🫥', label: 'Être incompris', weights: { empathy: 2 } },
      { id: 'c', emoji: '⛓️', label: 'Perdre ta liberté', weights: { independence: 2 } },
      { id: 'd', emoji: '🌀', label: 'Le chaos incontrôlable', weights: { organization: 2 } },
    ],
  },
  {
    id: 'q16',
    category: 'values',
    prompt: 'Une cause qui te touche particulièrement :',
    options: [
      { id: 'a', emoji: '⚖️', label: 'La justice sociale', weights: { empathy: 2, ambition: 1 } },
      { id: 'b', emoji: '🗽', label: "La liberté d'expression", weights: { independence: 2, creativity: 1 } },
      { id: 'c', emoji: '🎓', label: "L'éducation et la rigueur", weights: { logic: 2, organization: 1 } },
      { id: 'd', emoji: '🤲', label: 'L\'entraide de proximité', weights: { sociability: 2, empathy: 1 } },
    ],
  },
  {
    id: 'q17',
    category: 'values',
    prompt: "Ton rapport à l'argent :",
    options: [
      { id: 'a', emoji: '🎫', label: 'Un outil pour vivre des expériences', weights: { creativity: 1, independence: 1 } },
      { id: 'b', emoji: '🏦', label: 'Une sécurité à construire méthodiquement', weights: { organization: 2 } },
      { id: 'c', emoji: '📈', label: 'Un moyen d\'atteindre tes ambitions', weights: { ambition: 2 } },
      { id: 'd', emoji: '🎁', label: 'Peu important tant que tes proches vont bien', weights: { empathy: 2, sociability: 1 } },
    ],
  },
  {
    id: 'q18',
    category: 'values',
    prompt: 'Ce que tu admires le plus chez quelqu\'un :',
    options: [
      { id: 'a', emoji: '🌟', label: 'Son originalité', weights: { creativity: 2 } },
      { id: 'b', emoji: '💪', label: 'Sa détermination', weights: { ambition: 2 } },
      { id: 'c', emoji: '🤍', label: 'Sa gentillesse', weights: { empathy: 2 } },
      { id: 'd', emoji: '🧊', label: 'Son sang-froid rationnel', weights: { logic: 2 } },
    ],
  },
  {
    id: 'q19',
    category: 'values',
    prompt: 'Tu penses que le monde a surtout besoin de...',
    options: [
      { id: 'a', emoji: '🎨', label: 'Plus de créativité', weights: { creativity: 2 } },
      { id: 'b', emoji: '💗', label: 'Plus de bienveillance', weights: { empathy: 2 } },
      { id: 'c', emoji: '📐', label: 'Plus de rigueur', weights: { logic: 1, organization: 1 } },
      { id: 'd', emoji: '🔥', label: "Plus d'audace", weights: { ambition: 1, independence: 1 } },
    ],
  },

  // ---------- DILEMMES ----------
  {
    id: 'q20',
    category: 'dilemma',
    prompt: 'Stabilité ou liberté : tu choisis un métier...',
    options: [
      { id: 'a', emoji: '🏢', label: 'Stable et prévisible', weights: { organization: 2 } },
      { id: 'b', emoji: '🌊', label: 'Libre, même incertain', weights: { independence: 2 } },
      { id: 'c', emoji: '🚀', label: "Ambitieux, quitte à sacrifier l'équilibre", weights: { ambition: 2 } },
      { id: 'd', emoji: '🤝', label: 'Qui a du sens humainement', weights: { empathy: 2 } },
    ],
  },
  {
    id: 'q21',
    category: 'dilemma',
    prompt: 'Un ami te ment pour te protéger. Tu...',
    options: [
      { id: 'a', emoji: '💛', label: 'Comprends son intention', weights: { empathy: 2 } },
      { id: 'b', emoji: '🔎', label: 'Es déçu, la vérité prime', weights: { logic: 2 } },
      { id: 'c', emoji: '🤷', label: "T'en moques, tant qu'il n'y a pas de conséquence", weights: { independence: 1, creativity: 1 } },
      { id: 'd', emoji: '💬', label: 'En parles calmement pour clarifier', weights: { sociability: 1, organization: 1 } },
    ],
  },
  {
    id: 'q22',
    category: 'dilemma',
    prompt: 'Un job bien payé mais ennuyeux, ou un job passionnant mal payé :',
    options: [
      { id: 'a', emoji: '🔥', label: 'Le job passionnant, sans hésiter', weights: { creativity: 2, independence: 1 } },
      { id: 'b', emoji: '💼', label: "Le job bien payé, la sécurité d'abord", weights: { organization: 2 } },
      { id: 'c', emoji: '📊', label: "Ça dépend du potentiel d'évolution", weights: { ambition: 2 } },
      { id: 'd', emoji: '👥', label: 'Celui qui laisse du temps pour les autres', weights: { sociability: 1, empathy: 1 } },
    ],
  },
  {
    id: 'q23',
    category: 'dilemma',
    prompt: 'Un projet de groupe part dans le mur. Tu...',
    options: [
      { id: 'a', emoji: '🧯', label: 'Reprends les rênes pour le sauver', weights: { ambition: 2, organization: 1 } },
      { id: 'b', emoji: '💡', label: 'Proposes une idée radicalement différente', weights: { creativity: 2 } },
      { id: 'c', emoji: '🫂', label: "Rassures l'équipe avant tout", weights: { empathy: 2 } },
      { id: 'd', emoji: '🚶‍♂️', label: 'Laisses les autres gérer, tu passes à autre chose', weights: { independence: 2 } },
    ],
  },
  {
    id: 'q24',
    category: 'dilemma',
    prompt: 'Voyager seul ou en groupe :',
    options: [
      { id: 'a', emoji: '🎒', label: 'Seul, pour la liberté totale', weights: { independence: 2 } },
      { id: 'b', emoji: '👯', label: 'En groupe, pour le partage', weights: { sociability: 2 } },
      { id: 'c', emoji: '🗺️', label: "Peu importe si c'est bien organisé", weights: { organization: 2 } },
      { id: 'd', emoji: '🎈', label: 'En groupe, mais en improvisant', weights: { creativity: 1, sociability: 1 } },
    ],
  },
  {
    id: 'q25',
    category: 'dilemma',
    prompt: 'Avoir raison ou préserver la relation :',
    options: [
      { id: 'a', emoji: '📏', label: 'Avoir raison, la vérité compte', weights: { logic: 2 } },
      { id: 'b', emoji: '💞', label: 'Préserver la relation', weights: { empathy: 2 } },
      { id: 'c', emoji: '🎭', label: 'Trouver un compromis créatif', weights: { creativity: 1, empathy: 1 } },
      { id: 'd', emoji: '🌬️', label: "Passer à autre chose, peu importe", weights: { independence: 2 } },
    ],
  },
  {
    id: 'q26',
    category: 'dilemma',
    prompt: 'Suivre une passion risquée ou un plan de carrière sûr :',
    options: [
      { id: 'a', emoji: '🎨', label: 'La passion, coûte que coûte', weights: { creativity: 2, independence: 1 } },
      { id: 'b', emoji: '🧱', label: 'Le plan sûr, patiemment', weights: { organization: 2 } },
      { id: 'c', emoji: '🎯', label: 'La passion, mais avec un plan solide', weights: { ambition: 2, logic: 1 } },
      { id: 'd', emoji: '👨‍👩‍👧‍👦', label: 'Ce que le groupe valide', weights: { sociability: 2 } },
    ],
  },
  {
    id: 'q27',
    category: 'dilemma',
    prompt: 'Face à une injustice, tu...',
    options: [
      { id: 'a', emoji: '⚡', label: 'Agis immédiatement, quitte à déranger', weights: { ambition: 1, empathy: 1 } },
      { id: 'b', emoji: '🧠', label: "Analyses la situation avant d'agir", weights: { logic: 2 } },
      { id: 'c', emoji: '📣', label: 'Cherches à rassembler du soutien', weights: { sociability: 2 } },
      { id: 'd', emoji: '🚪', label: "T'en occupes à ta façon, seul", weights: { independence: 2 } },
    ],
  },
  {
    id: 'q28',
    category: 'dilemma',
    prompt: 'Briller seul ou faire briller l\'équipe :',
    options: [
      { id: 'a', emoji: '🏅', label: "Briller seul, c'est plus honnête", weights: { ambition: 2, independence: 1 } },
      { id: 'b', emoji: '🎊', label: "Faire briller l'équipe", weights: { sociability: 2, empathy: 1 } },
      { id: 'c', emoji: '📐', label: "Peu importe, tant que le résultat est bon", weights: { logic: 1, organization: 1 } },
      { id: 'd', emoji: '🌀', label: 'Trouver une façon originale de faire les deux', weights: { creativity: 2 } },
    ],
  },

  // ---------- PRÉFÉRENCES ----------
  {
    id: 'q29',
    category: 'preference',
    prompt: 'Ta soirée idéale :',
    options: [
      { id: 'a', emoji: '🕯️', label: 'Petit comité, discussions profondes', weights: { empathy: 1, logic: 1 } },
      { id: 'b', emoji: '🎉', label: 'Grande fête, plein de monde', weights: { sociability: 2 } },
      { id: 'c', emoji: '🎭', label: 'Activité créative improvisée', weights: { creativity: 2 } },
      { id: 'd', emoji: '🛋️', label: 'Soirée tranquille, seul ou à deux', weights: { independence: 2 } },
    ],
  },
  {
    id: 'q30',
    category: 'preference',
    prompt: 'Ton style de film préféré :',
    options: [
      { id: 'a', emoji: '🛸', label: 'Science-fiction qui questionne le monde', weights: { logic: 1, creativity: 1 } },
      { id: 'b', emoji: '😂', label: 'Comédie légère entre amis', weights: { sociability: 2 } },
      { id: 'c', emoji: '🏆', label: "Biopic sur un destin exceptionnel", weights: { ambition: 2 } },
      { id: 'd', emoji: '🎭', label: 'Drame émotionnel profond', weights: { empathy: 2 } },
    ],
  },
  {
    id: 'q31',
    category: 'preference',
    prompt: 'Ta méthode de travail :',
    options: [
      { id: 'a', emoji: '✅', label: 'Listes, plannings, deadlines', weights: { organization: 2 } },
      { id: 'b', emoji: '💫', label: 'Inspiration du moment', weights: { creativity: 2 } },
      { id: 'c', emoji: '⏰', label: 'Sous pression, à la dernière minute', weights: { independence: 1, ambition: 1 } },
      { id: 'd', emoji: '👥', label: 'En équipe, ça avance plus vite', weights: { sociability: 2 } },
    ],
  },
  {
    id: 'q32',
    category: 'preference',
    prompt: 'Le compliment qui te touche le plus :',
    options: [
      { id: 'a', emoji: '🌈', label: '"Tu es tellement original(e)"', weights: { creativity: 2 } },
      { id: 'b', emoji: '🛡️', label: '"On peut toujours compter sur toi"', weights: { organization: 2 } },
      { id: 'c', emoji: '🚀', label: '"Tu iras loin"', weights: { ambition: 2 } },
      { id: 'd', emoji: '💛', label: '"Tu me comprends si bien"', weights: { empathy: 2 } },
    ],
  },
  {
    id: 'q33',
    category: 'preference',
    prompt: 'Ton animal totem serait...',
    options: [
      { id: 'a', emoji: '🦊', label: 'Le renard, malin et créatif', weights: { creativity: 2 } },
      { id: 'b', emoji: '🐺', label: 'Le loup solitaire, libre', weights: { independence: 2 } },
      { id: 'c', emoji: '🐝', label: 'L\'abeille, organisée et productive', weights: { organization: 2 } },
      { id: 'd', emoji: '🐬', label: 'Le dauphin, sociable et joueur', weights: { sociability: 2 } },
    ],
  },
  {
    id: 'q34',
    category: 'preference',
    prompt: 'Dans les transports en commun, tu...',
    options: [
      { id: 'a', emoji: '👀', label: 'Observes les gens et imagines leurs histoires', weights: { creativity: 2 } },
      { id: 'b', emoji: '🕐', label: 'Planifies ton trajet à la minute près', weights: { organization: 2 } },
      { id: 'c', emoji: '💬', label: "Discutes avec un inconnu si l'occasion se présente", weights: { sociability: 2 } },
      { id: 'd', emoji: '🎧', label: 'Profites du silence, dans ta bulle', weights: { independence: 2 } },
    ],
  },
  {
    id: 'q35',
    category: 'preference',
    prompt: "Ta réaction face à un imprévu de dernière minute :",
    options: [
      { id: 'a', emoji: '🎲', label: 'Tu improvises avec plaisir', weights: { creativity: 2 } },
      { id: 'b', emoji: '😰', label: 'Tu paniques un peu, tu aimes prévoir', weights: { organization: 2 } },
      { id: 'c', emoji: '🔥', label: 'Tu vois ça comme un défi excitant', weights: { ambition: 1, independence: 1 } },
      { id: 'd', emoji: '📞', label: "Tu appelles quelqu'un pour t'aider à gérer", weights: { sociability: 1, empathy: 1 } },
    ],
  },
  {
    id: 'q36',
    category: 'preference',
    prompt: "Ce que tu recherches le plus chez un binôme de projet :",
    options: [
      { id: 'a', emoji: '🧭', label: 'Quelqu\'un de fiable et méthodique', weights: { organization: 2 } },
      { id: 'b', emoji: '🎨', label: 'Quelqu\'un de créatif et inspirant', weights: { creativity: 2 } },
      { id: 'c', emoji: '🚀', label: "Quelqu'un d'ambitieux qui pousse vers le haut", weights: { ambition: 2 } },
      { id: 'd', emoji: '💛', label: "Quelqu'un à l'écoute et bienveillant", weights: { empathy: 2 } },
    ],
  },
]
