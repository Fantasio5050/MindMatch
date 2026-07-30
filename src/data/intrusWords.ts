/** Paires de mots pour « L'Intrus ».
 *
 * Règle d'or du jeu : les deux mots doivent être PROCHES mais DISTINCTS. Trop proches
 * (chien/chiot) et l'intrus est indémasquable ; trop éloignés (chien/parapluie) et il est grillé
 * dès son premier indice. Toute la subtilité est là — chaque paire ci-dessous partage un champ
 * lexical mais diverge sur au moins un détail exploitable en indice.
 *
 * `civil` est le mot de la majorité, `undercover` celui de l'infiltré. L'ordre est volontairement
 * fixe (et non tiré au sort) pour que le mot du groupe reste le plus « évident » des deux : c'est
 * l'infiltré qui doit ramer, pas la majorité.
 */
export interface IntrusPair {
  id: string
  civil: string
  undercover: string
}

export const INTRUS_PAIRS_CLASSIC: readonly IntrusPair[] = [
  { id: 'ic-1', civil: 'Chien', undercover: 'Chat' },
  { id: 'ic-2', civil: 'Plage', undercover: 'Piscine' },
  { id: 'ic-3', civil: 'Café', undercover: 'Thé' },
  { id: 'ic-4', civil: 'Avion', undercover: 'Hélicoptère' },
  { id: 'ic-5', civil: 'Pizza', undercover: 'Quiche' },
  { id: 'ic-6', civil: 'Guitare', undercover: 'Violon' },
  { id: 'ic-7', civil: 'Noël', undercover: 'Anniversaire' },
  { id: 'ic-8', civil: 'Football', undercover: 'Rugby' },
  { id: 'ic-9', civil: 'Médecin', undercover: 'Infirmier' },
  { id: 'ic-10', civil: 'Soleil', undercover: 'Lune' },
  { id: 'ic-11', civil: 'Vélo', undercover: 'Moto' },
  { id: 'ic-12', civil: 'Mariage', undercover: 'Enterrement' },
  { id: 'ic-13', civil: 'Prison', undercover: 'Internat' },
  { id: 'ic-14', civil: 'Cinéma', undercover: 'Théâtre' },
  { id: 'ic-15', civil: 'Neige', undercover: 'Pluie' },
  { id: 'ic-16', civil: 'Boulangerie', undercover: 'Pâtisserie' },
  { id: 'ic-17', civil: 'Train', undercover: 'Métro' },
  { id: 'ic-18', civil: 'Professeur', undercover: 'Surveillant' },
  { id: 'ic-19', civil: 'Bière', undercover: 'Vin' },
  { id: 'ic-20', civil: 'Montagne', undercover: 'Colline' },
  { id: 'ic-21', civil: 'Téléphone', undercover: 'Tablette' },
  { id: 'ic-22', civil: 'Douche', undercover: 'Baignoire' },
  { id: 'ic-23', civil: 'Zoo', undercover: 'Aquarium' },
  { id: 'ic-24', civil: 'Hôtel', undercover: 'Camping' },
  { id: 'ic-25', civil: 'Facteur', undercover: 'Livreur' },
  { id: 'ic-26', civil: 'Piano', undercover: 'Accordéon' },
  { id: 'ic-27', civil: 'Chocolat', undercover: 'Caramel' },
  { id: 'ic-28', civil: 'Lion', undercover: 'Tigre' },
  { id: 'ic-29', civil: 'Docteur', undercover: 'Vétérinaire' },
  { id: 'ic-30', civil: 'Bibliothèque', undercover: 'Librairie' },
  { id: 'ic-31', civil: 'Ski', undercover: 'Snowboard' },
  { id: 'ic-32', civil: 'Fourchette', undercover: 'Cuillère' },
  { id: 'ic-33', civil: 'Voiture', undercover: 'Camion' },
  { id: 'ic-34', civil: 'Pompier', undercover: 'Policier' },
  { id: 'ic-35', civil: 'Sirop', undercover: 'Miel' },
  { id: 'ic-36', civil: 'Fantôme', undercover: 'Zombie' },
  { id: 'ic-37', civil: 'Sorcière', undercover: 'Fée' },
  { id: 'ic-38', civil: 'Barbe', undercover: 'Moustache' },
  { id: 'ic-39', civil: 'Chaussette', undercover: 'Gant' },
  { id: 'ic-40', civil: 'Aéroport', undercover: 'Gare' },
  { id: 'ic-41', civil: 'Été', undercover: 'Printemps' },
  { id: 'ic-42', civil: 'Dentiste', undercover: 'Coiffeur' },
  { id: 'ic-43', civil: 'Cauchemar', undercover: 'Rêve' },
  { id: 'ic-44', civil: 'Château', undercover: 'Manoir' },
  { id: 'ic-45', civil: 'Épée', undercover: 'Hache' },
  { id: 'ic-46', civil: 'Youtubeur', undercover: 'Streameur' },
  { id: 'ic-47', civil: 'Selfie', undercover: 'Photo de classe' },
  { id: 'ic-48', civil: 'Netflix', undercover: 'YouTube' },
  { id: 'ic-49', civil: 'Burger', undercover: 'Kebab' },
  { id: 'ic-50', civil: 'Frites', undercover: 'Chips' },
  { id: 'ic-51', civil: 'Ascenseur', undercover: 'Escalator' },
  { id: 'ic-52', civil: 'Parapluie', undercover: 'Imperméable' },
  { id: 'ic-53', civil: 'Miroir', undercover: 'Fenêtre' },
  { id: 'ic-54', civil: 'Sable', undercover: 'Terre' },
  { id: 'ic-55', civil: 'Requin', undercover: 'Dauphin' },
  { id: 'ic-56', civil: 'Araignée', undercover: 'Scorpion' },
  { id: 'ic-57', civil: 'Casque', undercover: 'Écouteurs' },
  { id: 'ic-58', civil: 'Clavier', undercover: 'Manette' },
  { id: 'ic-59', civil: 'Marathon', undercover: 'Sprint' },
  { id: 'ic-60', civil: 'Musée', undercover: 'Galerie' },
  { id: 'ic-61', civil: 'Pyjama', undercover: 'Peignoir' },
  { id: 'ic-62', civil: 'Rasoir', undercover: 'Tondeuse' },
  { id: 'ic-63', civil: 'Dimanche', undercover: 'Lundi' },
  { id: 'ic-64', civil: 'Grenier', undercover: 'Cave' },
  { id: 'ic-65', civil: 'Sirène', undercover: 'Alarme' },
  { id: 'ic-66', civil: 'Chewing-gum', undercover: 'Bonbon' },
  { id: 'ic-67', civil: 'Vaisselle', undercover: 'Lessive' },
  { id: 'ic-68', civil: 'Permis', undercover: 'Carte d’identité' },
  { id: 'ic-69', civil: 'Impôts', undercover: 'Loyer' },
  { id: 'ic-70', civil: 'Réveil', undercover: 'Sonnette' },
  { id: 'ic-71', civil: 'Rond-point', undercover: 'Feu rouge' },
  { id: 'ic-72', civil: 'Bronzage', undercover: 'Coup de soleil' },
]

/** Pack Trash 18+ : contenu cru, gênant, volontairement limite. Même exigence de proximité entre
 * les deux mots — c'est la gêne partagée qui fait rire, pas juste la vulgarité. */
export const INTRUS_PAIRS_TRASH: readonly IntrusPair[] = [
  { id: 'it-1', civil: 'Gueule de bois', undercover: 'Gastro' },
  { id: 'it-2', civil: 'Vomi', undercover: 'Crachat' },
  { id: 'it-3', civil: 'Pet', undercover: 'Rot' },
  { id: 'it-4', civil: 'Capote', undercover: 'Pilule' },
  { id: 'it-5', civil: 'Sexto', undercover: 'Nude' },
  { id: 'it-6', civil: 'Coup d’un soir', undercover: 'Plan cul régulier' },
  { id: 'it-7', civil: 'Ex toxique', undercover: 'Belle-mère' },
  { id: 'it-8', civil: 'Gynécologue', undercover: 'Proctologue' },
  { id: 'it-9', civil: 'Suçon', undercover: 'Bleu' },
  { id: 'it-10', civil: 'Strip-tease', undercover: 'Pole dance' },
  { id: 'it-11', civil: 'Sex-shop', undercover: 'Pharmacie' },
  { id: 'it-12', civil: 'Godemichet', undercover: 'Concombre' },
  { id: 'it-13', civil: 'Papier toilette', undercover: 'Serviette hygiénique' },
  { id: 'it-14', civil: 'Chiotte bouchée', undercover: 'Évier bouché' },
  { id: 'it-15', civil: 'Morpions', undercover: 'Poux' },
  { id: 'it-16', civil: 'MST', undercover: 'Grippe' },
  { id: 'it-17', civil: 'Test de grossesse', undercover: 'Test covid' },
  { id: 'it-18', civil: 'Rateau', undercover: 'Vent' },
  { id: 'it-19', civil: 'Friendzone', undercover: 'Cousinade' },
  { id: 'it-20', civil: 'Beuverie', undercover: 'Apéro de famille' },
  { id: 'it-21', civil: 'Cuite', undercover: 'Coma' },
  { id: 'it-22', civil: 'Joint', undercover: 'Cigarette' },
  { id: 'it-23', civil: 'Kebab de 4h', undercover: 'Petit-déj d’hôtel' },
  { id: 'it-24', civil: 'Trou de mémoire', undercover: 'Amnésie' },
  { id: 'it-25', civil: 'Nudiste', undercover: 'Exhibitionniste' },
  { id: 'it-26', civil: 'Fesses', undercover: 'Cuisses' },
  { id: 'it-27', civil: 'Poils', undercover: 'Cheveux' },
  { id: 'it-28', civil: 'Mauvaise haleine', undercover: 'Odeur de pieds' },
  { id: 'it-29', civil: 'Transpiration', undercover: 'Bave' },
  { id: 'it-30', civil: 'Sextape', undercover: 'Film de vacances' },
  { id: 'it-31', civil: 'Divorce', undercover: 'Rupture' },
  { id: 'it-32', civil: 'Tromperie', undercover: 'Mensonge' },
  { id: 'it-33', civil: 'Vasectomie', undercover: 'Piqûre' },
  { id: 'it-34', civil: 'Bordel', undercover: 'Boîte de nuit' },
  { id: 'it-35', civil: 'Escort', undercover: 'Masseuse' },
  { id: 'it-36', civil: 'Cellulite', undercover: 'Vergetures' },
  { id: 'it-37', civil: 'Bouton de fièvre', undercover: 'Acné' },
  { id: 'it-38', civil: 'Pipi au lit', undercover: 'Bave sur l’oreiller' },
  { id: 'it-39', civil: 'Fils à maman', undercover: 'Chouchou du prof' },
  { id: 'it-40', civil: 'Nudité', undercover: 'Maillot de bain' },
  { id: 'it-41', civil: 'Lendemain de soirée', undercover: 'Réveil du dimanche' },
  { id: 'it-42', civil: 'Slip troué', undercover: 'Chaussette trouée' },
  { id: 'it-43', civil: 'Autobronzant raté', undercover: 'Teinture ratée' },
  { id: 'it-44', civil: 'Gerbe dans le taxi', undercover: 'Café renversé' },
  { id: 'it-45', civil: 'Photo compromettante', undercover: 'Photo de profil ratée' },
  { id: 'it-46', civil: 'Bizutage', undercover: 'Gage' },
  { id: 'it-47', civil: 'Cuite au vin blanc', undercover: 'Thé glacé' },
  { id: 'it-48', civil: 'Voisin bruyant', undercover: 'Colocataire sale' },
  { id: 'it-49', civil: 'Coup de foudre', undercover: 'Coup de chaud' },
  { id: 'it-50', civil: 'Dick pic', undercover: 'Photo de vacances' },
  { id: 'it-51', civil: 'Sextoy oublié', undercover: 'Chargeur oublié' },
  { id: 'it-52', civil: 'Rendez-vous Tinder', undercover: 'Entretien d’embauche' },
]

export type IntrusPack = 'classic' | 'trash' | 'mixed'

export function intrusPool(pack: IntrusPack): readonly IntrusPair[] {
  if (pack === 'trash') return INTRUS_PAIRS_TRASH
  if (pack === 'mixed') return [...INTRUS_PAIRS_CLASSIC, ...INTRUS_PAIRS_TRASH]
  return INTRUS_PAIRS_CLASSIC
}
