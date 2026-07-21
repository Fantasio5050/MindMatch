/** Banque de mots de « Coup de Crayon » — des choses SIMPLES à dessiner (ou drôles à rater).
 * 520+ entrées variées : objets, animaux, bouffe, actions, lieux, concepts rigolos… L'hôte peut
 * ajouter ses propres mots avant la partie, et un petit pack trash s'ajoute au pool quand le mode
 * 18+ du salon est actif. Partagé client/serveur. */

export const DRAWING_WORDS: string[] = [
  // --- Animaux ---
  'un chat', 'un chien', 'une girafe', 'un éléphant', 'un pingouin', 'une poule', 'un cochon', 'un serpent',
  'une baleine', 'un requin', 'une araignée', 'un papillon', 'un escargot', 'une tortue', 'un hibou', 'un flamant rose',
  'un paresseux', 'un hérisson', 'une méduse', 'un crabe', 'un poulpe', 'une licorne', 'un dragon', 'un dinosaure',
  'un hamster', 'une chauve-souris', 'un kangourou', 'un panda', 'un lama', 'une vache', 'un âne', 'un loup',
  'un poisson rouge', 'une abeille', 'un moustique', 'une fourmi', 'un ver de terre', 'un axolotl', 'un pigeon', 'une autruche',
  // --- Bouffe & boissons ---
  'une pizza', 'un croissant', 'une baguette', 'un kebab', 'un hamburger', 'des frites', 'un taco', 'des sushis',
  'une raclette', 'une fondue', 'un camembert', 'un œuf au plat', 'des spaghettis', 'un sandwich', 'une glace', 'un donut',
  'une banane', 'un ananas', 'une pastèque', 'un avocat', 'un citron', 'une fraise', 'un brocoli', 'un cornichon',
  'une bière', 'un mojito', 'un café', 'un thé à la menthe', 'un chocolat chaud', 'une bouteille de vin', 'un gâteau d\'anniversaire', 'une crêpe',
  'un pot de Nutella', 'une huître', 'un escargot au beurre', 'une saucisse', 'un pain au chocolat', 'une chocolatine (pardon)', 'un bonbon', 'une barbe à papa',
  // --- Objets du quotidien ---
  'une brosse à dents', 'un sèche-cheveux', 'une machine à laver', 'un grille-pain', 'un aspirateur', 'un fer à repasser', 'une théière', 'un micro-ondes',
  'des lunettes', 'un parapluie', 'une valise', 'un réveil', 'une lampe', 'un canapé', 'une chaise', 'un lit superposé',
  'des ciseaux', 'un marteau', 'une perceuse', 'un tournevis', 'une échelle', 'un balai', 'une pelle', 'un râteau',
  'un téléphone', 'un ordinateur', 'une télécommande', 'une manette de jeu', 'un casque audio', 'un chargeur', 'une clé USB', 'une imprimante',
  'une chaussette trouée', 'un slip', 'un soutien-gorge', 'une cravate', 'un bonnet', 'des tongs', 'des talons hauts', 'une doudoune',
  'un papier toilette', 'une ventouse', 'un plongeur (l\'ustensile)', 'une poubelle', 'un cintre', 'une éponge', 'un gant de toilette', 'un peigne',
  // --- Transports ---
  'un vélo', 'une trottinette', 'un skateboard', 'une moto', 'un tracteur', 'un camion poubelle', 'une montgolfière', 'un hélicoptère',
  'un avion', 'un sous-marin', 'un paquebot', 'une fusée', 'un train', 'un métro bondé', 'un taxi', 'une ambulance',
  'un char à voile', 'un pédalo', 'un télésiège', 'une soucoupe volante', 'un tank', 'une calèche', 'un segway', 'un monocycle',
  // --- Métiers & personnages ---
  'un pompier', 'un policier', 'un cuisinier', 'un docteur', 'un dentiste', 'un facteur', 'un plombier', 'un coiffeur',
  'un clown', 'un magicien', 'un pirate', 'un ninja', 'un cowboy', 'un chevalier', 'un roi', 'une reine',
  'un fantôme', 'un vampire', 'un zombie', 'une sorcière', 'un extraterrestre', 'un robot', 'une momie', 'un loup-garou',
  'un super-héros', 'un père Noël', 'une fée', 'un géant', 'un nain de jardin', 'un bébé', 'une grand-mère', 'un influenceur',
  'un arbitre', 'un professeur', 'un juge', 'un astronaute', 'un plongeur sous-marin', 'un mime', 'un DJ', 'un serveur de restaurant',
  // --- Corps & humains ---
  'une moustache', 'une barbe', 'un chignon', 'une coupe mulet', 'un sourcil', 'un nombril', 'un pied qui pue', 'une dent qui bouge',
  'un squelette', 'un cerveau', 'un cœur (le vrai)', 'des muscles', 'un gros orteil', 'une oreille', 'un double menton', 'des fossettes',
  'un bouton sur le nez', 'des cernes', 'un suçon', 'un coup de soleil', 'une cicatrice', 'un plâtre', 'un appareil dentaire', 'une perruque',
  // --- Sports & loisirs ---
  'un ballon de foot', 'une raquette de tennis', 'un panier de basket', 'des haltères', 'un tapis de yoga', 'une canne à pêche', 'un arc et des flèches', 'des fléchettes',
  'une piscine', 'un toboggan', 'une balançoire', 'un trampoline', 'un château de sable', 'un cerf-volant', 'une tente de camping', 'un feu de camp',
  'des cartes à jouer', 'un échiquier', 'un puzzle', 'un rubik\'s cube', 'une console de jeux', 'un baby-foot', 'un bowling', 'une pinata',
  'du ski', 'un surfeur', 'un plongeon raté', 'une roue (la figure)', 'un marathon', 'de la pétanque', 'un saut à l\'élastique', 'une partie de Twister',
  // --- Lieux & bâtiments ---
  'la tour Eiffel', 'une pyramide', 'un château fort', 'un phare', 'un moulin à vent', 'une île déserte', 'un volcan', 'une cascade',
  'un igloo', 'une cabane dans un arbre', 'un cirque', 'une prison', 'une église', 'un stade', 'une station-service', 'un fast-food',
  'une plage', 'une forêt', 'le désert', 'la banquise', 'une grotte', 'un cimetière', 'une déchetterie', 'un rond-point',
  // --- Nature & météo ---
  'un arc-en-ciel', 'un éclair', 'une tornade', 'un bonhomme de neige', 'un soleil qui transpire', 'la pluie', 'un nuage en colère', 'la canicule',
  'un cactus', 'un palmier', 'un tournesol', 'une rose', 'un champignon', 'un trèfle à quatre feuilles', 'une citrouille', 'un sapin de Noël',
  'la lune', 'une étoile filante', 'la planète Terre', 'Saturne', 'un trou noir', 'une comète', 'une éclipse', 'la voie lactée',
  // --- Actions & situations ---
  'quelqu\'un qui dort', 'quelqu\'un qui court', 'quelqu\'un qui pleure', 'quelqu\'un qui danse', 'un fou rire', 'un bâillement', 'un éternuement', 'un câlin',
  'une demande en mariage', 'un premier rendez-vous', 'une dispute de couple', 'un selfie', 'une sieste au bureau', 'un embouteillage', 'une file d\'attente', 'un déménagement',
  'quelqu\'un qui glisse sur une peau de banane', 'un plongeon bombe', 'une bataille de polochons', 'un karaoké', 'un barbecue', 'un pique-nique', 'une gueule de bois', 'une panne d\'oreiller',
  'quelqu\'un coincé dans un ascenseur', 'un contrôle de police', 'une cagnotte entre amis', 'un cadeau raté', 'un discours de mariage', 'un blind test', 'une réunion Zoom', 'un lundi matin',
  'quelqu\'un qui rate son bus', 'une chute en trottinette', 'un régime qui craque', 'une lessive ratée (tout rose)', 'un texto envoyé au mauvais contact', 'un appel de sa mère', 'un ronflement', 'une insomnie',
  // --- Concepts & trucs absurdes ---
  'la flemme', 'le bonheur', 'la jalousie', 'le stress', 'la honte', 'le déjà-vu', 'l\'infini', 'le silence gênant',
  'un rêve bizarre', 'une théorie du complot', 'la friend zone', 'un red flag', 'le wifi qui coupe', 'la batterie à 1%', 'un spoiler', 'un vu sans réponse',
  'la crise de la trentaine', 'un compte en banque vide', 'le syndrome de l\'imposteur', 'une promesse d\'ivrogne', 'le regret', 'la procrastination', 'un mensonge qui grossit', 'le karma',
  'un lundi déguisé en vendredi', 'l\'esprit d\'escalier', 'une idée de génie à 3h du matin', 'le chat qui juge', 'un frigo vide', 'la playlist honteuse', 'un groupe WhatsApp familial', 'le mode avion',
  // --- Culture & clins d'œil ---
  'un zombie qui fait du yoga', 'un pigeon parisien', 'un touriste perdu', 'un métalleux', 'une boule à facettes', 'un vinyle', 'un talkie-walkie', 'une cassette VHS',
  'un Minitel', 'un téléphone à cadran', 'une lettre d\'amour', 'un journal intime', 'une boule de cristal', 'un attrape-rêves', 'un porte-bonheur', 'un trophée',
  'un mariage de dernière minute à Las Vegas', 'un alien qui bronze', 'un requin dans une piscine', 'un T-Rex qui fait ses lacets', 'un chat astronaute', 'un croissant musclé', 'une licorne au chômage', 'un fantôme timide',
  'un robot amoureux', 'une patate qui fait du sport', 'un cactus qui fait un câlin', 'une baguette ceinture noire de karaté', 'un fromage qui s\'enfuit', 'un nuage qui pleut de la limonade', 'un poulet détective', 'une chaussette célibataire',
  // --- Divers dessinables ---
  'un bisou', 'un cadenas', 'une clé', 'un trésor', 'une carte au trésor', 'une boussole', 'un sablier', 'une horloge',
  'un miroir', 'une bougie', 'un feu d\'artifice', 'un ballon de baudruche', 'un confetti géant', 'une guitare', 'un piano', 'une batterie (de musique)',
  'un tambour', 'un violon', 'un accordéon', 'un micro', 'une partition', 'un sifflet', 'un mégaphone', 'une cloche',
  'un panneau stop', 'un feu rouge', 'un passage piéton', 'une borne d\'arcade', 'un distributeur de billets', 'un caddie', 'un ticket de caisse', 'une tirelire',
  'un extincteur', 'une lance à incendie', 'un gyrophare', 'une sirène (la créature)', 'une ancre', 'un gouvernail', 'un hublot', 'un gilet de sauvetage',
  'un œil au beurre noir', 'un poing', 'un pouce en l\'air', 'un doigt d\'honneur (soft)', 'un high five', 'un bras de fer', 'un check', 'une poignée de main',
  'une empreinte digitale', 'une loupe', 'un détective', 'un indice', 'une fausse moustache', 'un déguisement raté', 'un masque de carnaval', 'un chapeau de paille',
  'un moulin à café', 'une machine à coudre', 'un tricot', 'une pelote de laine', 'un bouton de chemise', 'une fermeture éclair', 'un nœud papillon', 'des bretelles',
  'un igloo climatisé', 'un ascenseur en panne', 'un escalator', 'une porte tambour', 'un paillasson', 'une boîte aux lettres', 'un interphone', 'un vide-grenier',
  'un radiateur', 'un ventilateur', 'une climatisation', 'une cheminée', 'un barbecue sous la pluie', 'un parasol retourné', 'une chaise longue', 'un hamac',
  'une brouette', 'un arrosoir', 'un épouvantail', 'un potager', 'une serre', 'une tondeuse', 'un jardin zen', 'un bonsaï',
  'un aquarium', 'une cage à oiseaux', 'une niche de chien', 'un arbre à chat', 'une laisse', 'un os', 'une gamelle', 'une litière',
  'un biberon', 'une poussette', 'un doudou', 'une tétine', 'un lit à barreaux', 'un toboggan de piscine', 'des brassards', 'une bouée canard',
  'un diplôme', 'un tableau noir', 'une trousse', 'un compas', 'une équerre', 'un cartable', 'une copie double', 'un zéro pointé',
]

/** Pack trash mélangé au pool uniquement quand le mode 18+ du salon est actif. */
export const DRAWING_WORDS_TRASH: string[] = [
  'un strip-tease raté', 'une gueule de bois de niveau 100', 'un sex-toy discret', 'une chaussette suspecte', 'un slip kangourou fatigué',
  'un suçon mal placé', 'un date Tinder catastrophique', 'une sextape amateur (soft)', 'un nude flouté', 'une envie pressante en soirée',
  'un vomi de fin de soirée', 'un préservatif dépassé', 'un plan à trois gênant', 'une danse de la fertilité', 'un 69 (le nombre, bien sûr)',
  'un tatouage regretté au réveil', 'un after qui dérape', 'une chatte (le chat femelle, voyons)', 'des menottes roses', 'un string sur un fil à linge',
  'la position de la brouette', 'un lap dance maladroit', 'une panne au mauvais moment', 'un râteau monumental', 'un appel à son ex à 3h du matin',
  'un caleçon porte-bonheur', 'une bite (de bateau, évidemment)', 'un boule de pétanque très personnelle', 'un décolleté audacieux', 'une fessée théâtrale',
  'un jacuzzi surpeuplé', 'une nuit à la belle étoile qui tourne mal', 'un massage qui devient bizarre', 'une lingerie de Noël', 'un livreur très attendu',
  'une douche froide obligatoire', 'un « ça rentre pas » (le canapé dans l\'escalier)', 'une main baladeuse', 'un poirier fesses nues', 'une culotte oubliée',
]
