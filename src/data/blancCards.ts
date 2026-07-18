/** « Le Grand Blanc » — party game de cartes à trous inspiré de Blanc Manger Coco / Juduku (18+).
 *
 * Chaque manche : une carte NOIRE (une phrase avec un trou « ___ ») est révélée. Chacun choisit,
 * dans sa main de cartes BLANCHES, la réponse la plus drôle pour combler le trou. On mélange les
 * réponses (anonymes), tout le monde vote pour la plus drôle (pas la sienne), l'auteur·rice de la
 * gagnante marque des points. Contenu volontairement trash — réservé au mode 18+.
 *
 * Partagé client/serveur : le serveur pioche/mélange, le client n'affiche que sa propre main
 * (via la convention `hands` -> `yourHand` de la sanitization). */

export interface BlancPrompt {
  id: string
  /** Texte de la carte noire ; le trou est marqué par « ___ » (remplacé par la carte blanche). */
  text: string
}

export interface BlancAnswer {
  id: string
  text: string
}

/** Marqueur de trou utilisé dans les cartes noires. */
export const BLANC_BLANK = '___'

export const BLANC_PROMPTS: BlancPrompt[] = [
  { id: 'bp-1', text: 'À la soirée, tout le monde parlait de ___.' },
  { id: 'bp-2', text: 'Ma plus grosse erreur de jeunesse : ___.' },
  { id: 'bp-3', text: "Le secret d'un couple qui dure, c'est ___." },
  { id: 'bp-4', text: 'Je me suis fait virer du boulot à cause de ___.' },
  { id: 'bp-5', text: "Ce qu'on ne devrait jamais offrir à sa belle-mère : ___." },
  { id: 'bp-6', text: 'Le pire moyen de rompre avec quelqu\'un : ___.' },
  { id: 'bp-7', text: 'Mon thérapeute a démissionné quand je lui ai parlé de ___.' },
  { id: 'bp-8', text: "Dans dix ans, la nouvelle tendance sera ___." },
  { id: 'bp-9', text: 'Ce qui se cache vraiment derrière mon sourire, c\'est ___.' },
  { id: 'bp-10', text: 'La véritable raison de mon retard, c\'était ___.' },
  { id: 'bp-11', text: "On m'a interdit l'entrée du supermarché à cause de ___." },
  { id: 'bp-12', text: 'Rien ne vaut une bonne soirée entre amis et ___.' },
  { id: 'bp-13', text: 'Mon profil de rencontre ne mentionne pas ___.' },
  { id: 'bp-14', text: "Le nouveau réseau social où tout le monde partage ___." },
  { id: 'bp-15', text: 'Ce que je fais quand personne ne regarde : ___.' },
  { id: 'bp-16', text: "L'ingrédient secret de ma recette de famille : ___." },
  { id: 'bp-17', text: 'Le pire cadeau de Noël de tous les temps : ___.' },
  { id: 'bp-18', text: 'Mon groupe de rock s\'appellerait « ___ ».' },
  { id: 'bp-19', text: "Ce que j'ai vraiment cherché dans l'historique privé : ___." },
  { id: 'bp-20', text: 'La dernière chose que je veux voir avant de mourir : ___.' },
  { id: 'bp-21', text: "Ce qui m'excite plus que ça ne devrait : ___." },
  { id: 'bp-22', text: 'La vraie raison pour laquelle je ne réponds jamais au téléphone : ___.' },
  { id: 'bp-23', text: 'Mon super-pouvoir complètement inutile : ___.' },
  { id: 'bp-24', text: "Ce qu'on a trouvé dans mon sac à la douane : ___." },
  { id: 'bp-25', text: 'Le titre de mon autobiographie : « ___ ».' },
  { id: 'bp-26', text: 'Ma stratégie infaillible pour draguer : ___.' },
  { id: 'bp-27', text: "Ce que j'ai juré de ne plus jamais faire après cette cuite : ___." },
  { id: 'bp-28', text: 'La pire chose à dire pendant un enterrement : ___.' },
  { id: 'bp-29', text: "Ce qui manque cruellement à mon appartement : ___." },
  { id: 'bp-30', text: 'Mon remède miracle contre la gueule de bois : ___.' },
  { id: 'bp-31', text: 'Ce que je ferais avec un million d\'euros et aucune limite : ___.' },
  { id: 'bp-32', text: "Le message que je regrette d'avoir envoyé à 3h du matin : ___." },
  { id: 'bp-33', text: 'La nouvelle discipline olympique que je gagnerais : ___.' },
  { id: 'bp-34', text: 'Ce que mon animal de compagnie pense vraiment de moi : ___.' },
]

export const BLANC_ANSWERS: BlancAnswer[] = [
  { id: 'ba-1', text: 'une crise existentielle à 4h du matin' },
  { id: 'ba-2', text: 'trois verres de trop et zéro regret' },
  { id: 'ba-3', text: 'mon ex qui like mes photos de 2014' },
  { id: 'ba-4', text: 'une confiance en moi totalement injustifiée' },
  { id: 'ba-5', text: 'le wifi qui coupe au pire moment' },
  { id: 'ba-6', text: 'un pacte avec le diable, apparemment' },
  { id: 'ba-7', text: 'des choix de vie discutables' },
  { id: 'ba-8', text: 'ma capacité à ignorer mes responsabilités' },
  { id: 'ba-9', text: 'un kebab à 5h du matin' },
  { id: 'ba-10', text: 'la honte, mais élevée au rang d\'art' },
  { id: 'ba-11', text: 'un excès de confiance et un permis périmé' },
  { id: 'ba-12', text: 'pleurer devant une pub d\'assurance' },
  { id: 'ba-13', text: 'mon compte en banque qui pleure' },
  { id: 'ba-14', text: 'une playlist vraiment gênante' },
  { id: 'ba-15', text: 'faire semblant d\'écouter' },
  { id: 'ba-16', text: 'un talent caché pour le drame' },
  { id: 'ba-17', text: 'trop de café et pas assez de sommeil' },
  { id: 'ba-18', text: 'mon voisin qui tond sa pelouse à 7h' },
  { id: 'ba-19', text: 'un tatouage que je ne peux pas expliquer' },
  { id: 'ba-20', text: 'la ferme intention de commencer le sport demain' },
  { id: 'ba-21', text: 'un groupe familial WhatsApp incontrôlable' },
  { id: 'ba-22', text: 'des décisions prises à jeun mais bizarres quand même' },
  { id: 'ba-23', text: 'mon incapacité chronique à dire non' },
  { id: 'ba-24', text: 'un karaoké qui a mal tourné' },
  { id: 'ba-25', text: 'ce collègue qui répond à tous' },
  { id: 'ba-26', text: 'une soudaine envie de tout plaquer' },
  { id: 'ba-27', text: 'mon abonnement à la salle de sport jamais utilisé' },
  { id: 'ba-28', text: 'un mensonge devenu incontrôlable' },
  { id: 'ba-29', text: 'la dernière part de pizza' },
  { id: 'ba-30', text: 'un tableur Excel à 2h du matin' },
  { id: 'ba-31', text: 'des câlins non sollicités' },
  { id: 'ba-32', text: 'mon manque total de rythme' },
  { id: 'ba-33', text: 'un plan foireux mais assumé' },
  { id: 'ba-34', text: 'la voix du GPS qui me juge' },
  { id: 'ba-35', text: 'trois heures de vidéos de chats' },
  { id: 'ba-36', text: 'un ego légèrement surdimensionné' },
  { id: 'ba-37', text: 'mon aptitude à me ridiculiser en public' },
  { id: 'ba-38', text: 'un rendez-vous chez le dentiste évité depuis 4 ans' },
  { id: 'ba-39', text: 'la vengeance, servie très froide' },
  { id: 'ba-40', text: 'un pyjama porté toute la journée' },
  { id: 'ba-41', text: 'mon crush qui ne sait même pas que j\'existe' },
  { id: 'ba-42', text: 'des promesses que je ne tiendrai jamais' },
  { id: 'ba-43', text: 'un régime qui a duré 4 heures' },
  { id: 'ba-44', text: 'le silence gênant après une blague ratée' },
  { id: 'ba-45', text: 'ma collection de sacs plastique' },
  { id: 'ba-46', text: 'une nuit blanche pour rien' },
  { id: 'ba-47', text: 'mon talent pour compliquer les choses simples' },
  { id: 'ba-48', text: 'un chargeur qui ne charge plus' },
  { id: 'ba-49', text: 'des larmes de crocodile parfaitement maîtrisées' },
  { id: 'ba-50', text: 'un pari perdu d\'avance' },
  { id: 'ba-51', text: 'la culpabilité et deux desserts' },
  { id: 'ba-52', text: 'mon historique de navigation' },
  { id: 'ba-53', text: 'une danse de la victoire prématurée' },
  { id: 'ba-54', text: 'un ami imaginaire toujours d\'accord avec moi' },
  { id: 'ba-55', text: 'trop d\'émojis dans un message pro' },
  { id: 'ba-56', text: 'mon incapacité à garder un secret' },
  { id: 'ba-57', text: 'une addiction discutable au sucre' },
  { id: 'ba-58', text: 'la playlist de mariage de mon oncle' },
  { id: 'ba-59', text: 'un selfie sous quinze angles différents' },
  { id: 'ba-60', text: 'des principes très flexibles' },
  { id: 'ba-61', text: 'un colis que j\'attends depuis trois semaines' },
  { id: 'ba-62', text: 'ma dignité, quelque part' },
  { id: 'ba-63', text: 'une théorie du complot sur les pigeons' },
  { id: 'ba-64', text: 'un fou rire au pire moment possible' },
  { id: 'ba-65', text: 'mon voisin qui écoute tout à travers le mur' },
  { id: 'ba-66', text: 'la motivation, portée disparue' },
  { id: 'ba-67', text: 'un cocktail que j\'ai regretté immédiatement' },
  { id: 'ba-68', text: 'des compétences sociales en option' },
  { id: 'ba-69', text: 'mon besoin urgent de validation' },
  { id: 'ba-70', text: 'un chat qui me méprise ouvertement' },
  { id: 'ba-71', text: 'la promesse de ne « boire qu\'un verre »' },
  { id: 'ba-72', text: 'une facture surprise' },
  { id: 'ba-73', text: 'mon reflet dans la vitrine qui me trahit' },
  { id: 'ba-74', text: 'un plan à trois… épisodes de série' },
  { id: 'ba-75', text: 'des remords après le troisième kebab' },
  { id: 'ba-76', text: 'ma tendance à parler tout seul' },
  { id: 'ba-77', text: 'un message vocal de deux minutes' },
  { id: 'ba-78', text: 'la panique juste avant la deadline' },
  { id: 'ba-79', text: 'un talent inexploité pour le mensonge' },
  { id: 'ba-80', text: 'mon lit un dimanche matin' },
]
