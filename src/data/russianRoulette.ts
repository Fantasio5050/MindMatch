/** Roulette russe — jeu à boire hardcore (18+). Barillet de 6 chambres, une seule balle.
 * Chacun son tour appuie sur la détente : « clic » (soulagement) ou « BANG » (sanction lourde).
 * Les probabilités montent à chaque clic (la chambre avance, le barillet n'est pas re-mélangé),
 * jusqu'au coup fatal — puis on recharge et on repart. Partagé client/serveur. */

export const CHAMBER_COUNT = 6

/** Cul sec infligé au perdant qui refuse (ou ne peut pas relever) le gage du BANG. */
export const BANG_CULSEC_SIPS = 6

/** Petit shot de tension : quelques gorgées à chaque clic survécu, pour que personne ne parte
 * totalement indemne d'un tour à haut risque. */
export const CLICK_SIPS = 1

/** Gages hardcore tirés au sort quand la balle part. Le perdant peut les relever (honneur + XP)
 * ou refuser et cul sec. Contenu volontairement corsé — réservé au mode 18+. */
export const RUSSIAN_ROULETTE_GAGES: string[] = [
  'Cul sec, tout de suite. 🥃',
  'Envoie un message vocal gênant à la 3e personne de tes contacts.',
  'Bois cul sec ET offre une tournée de gorgées à qui tu veux.',
  'Imite quelqu\'un de la table jusqu\'à ce qu\'on devine qui c\'est.',
  'Raconte ton pire date. Sans mentir.',
  'Laisse ton voisin de droite écrire un statut sur ton téléphone.',
  'Fais un shot les yeux bandés servi par la table.',
  'Chante le refrain de ta honte musicale, debout.',
  'Donne ton téléphone déverrouillé à la table pendant 30 secondes.',
  'Avoue le dernier mensonge que tu as dit à quelqu\'un ici.',
  'Bois autant de gorgées que ton âge… divisé par 5, arrondi au-dessus.',
  'Fais 20 pompes ou cul sec.',
  'Échange un vêtement avec la personne en face pour le prochain tour.',
  'Appelle un·e ex et dis simplement « je pensais à toi ». (ou cul sec)',
  'Laisse la table choisir ton prochain défi.',
  'Montre la dernière photo de ta galerie. Sans tricher.',
  'Lis à voix haute ton dernier message envoyé. En entier.',
  'Cul sec, puis c\'est toi qui sers la prochaine tournée.',
  'Raconte la chose la plus gênante que tu aies faite en soirée.',
  'Laisse ton voisin de gauche envoyer UN message depuis ton téléphone.',
  'Avoue le crush le plus improbable que tu aies déjà eu.',
  'Fais un cul sec ou révèle ton fond d\'écran verrouillé à la table.',
  'Appelle la 5e personne de tes contacts et dis-lui que tu penses à elle.',
  'Nomme la personne de la table que tu inviterais en premier à un after… et pourquoi.',
  'Bois, puis imite quelqu\'un de la table jusqu\'à ce qu\'on devine.',
  'Raconte ton pire lendemain de cuite, sans rien épargner.',
  'Laisse la table lire à voix haute la dernière notif de ton téléphone.',
  'Cul sec les yeux fermés servi par ton voisin de droite.',
  'Avoue un truc que tu n\'as jamais dit à personne autour de cette table.',
  'Échange de place ET de verre avec la personne en face pour 3 tours.',
  'Fais une déclaration enflammée à la personne à ta droite, façon télénovela.',
  'Donne ton téléphone déverrouillé à la table pendant 20 secondes.',
  'Chante debout le refrain que la table te choisit, à fond.',
  'Bois autant de gorgées que de personnes qui te trouvent drôle (mains levées).',
  'Raconte la pire excuse que tu aies inventée pour zapper un plan.',
]
