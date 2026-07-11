# MindMatch 🧠

MindMatch est une application de personnalité entre amis. Créez un groupe, partagez un code, répondez chacun à un questionnaire de 36 questions, puis découvrez votre profil de personnalité, comparez-vous à vos amis et débattez de vos plus grandes différences.

Les groupes et réponses sont partagés en temps quasi réel entre tous les membres via un petit serveur — il suffit d'un seul déploiement pour que tout le monde (sur son propre téléphone) puisse rejoindre le même groupe avec un code.

## Fonctionnalités

- **Accueil** — créer un groupe ou en rejoindre un avec un code, choix du pseudo.
- **Questionnaire** — 36 questions (personnalité, valeurs, dilemmes, préférences), cartes animées et barre de progression. La progression est sauvegardée côté serveur (tu peux fermer l'app et reprendre plus tard).
- **Profil** — archétype de personnalité, description personnalisée, radar chart et jauges sur 7 traits (créativité, logique, ambition, empathie, indépendance, sociabilité, organisation).
- **Groupe** — radar comparatif, points communs, plus grandes différences, classements amusants (le/la plus créatif·ve, organisé·e, aventurier·ère, empathique, ambitieux·se, sociable, stratège, indépendant·e). Se met à jour automatiquement quand tes amis terminent le quiz.
- **Débats** — sujets de débat générés automatiquement à partir des plus grands écarts de personnalité entre membres du groupe.

## Stack

- **Frontend** — React 19 + TypeScript + Vite, Tailwind CSS v4, Framer Motion, React Router (HashRouter), Zustand.
- **Backend** — Node.js + Express, stockage dans un fichier JSON (`server/data/db.json`), aucune dépendance externe ni compte tiers à créer.

## Développement local

Deux façons de lancer le projet en dev :

```bash
npm install
npm run dev:full   # lance le frontend (Vite, port 5173) ET l'API (port 3001) ensemble
```

ou séparément dans deux terminaux :

```bash
npm run server   # API sur http://localhost:3001
npm run dev      # Frontend sur http://localhost:5173 (proxy /api vers le serveur)
```

## Déployer sur ton propre serveur (ex. fantaxserver)

L'app se déploie comme **un seul processus Node** qui sert à la fois le site et l'API — pas besoin de configurer deux hébergements séparés.

```bash
git clone <ton-repo>
cd MindMatch
npm install
npm run build       # construit le frontend dans dist/
npm run start        # démarre le serveur sur le port 3001 (ou $PORT)
```

Points importants pour la prod :

- **Garde le process actif** : utilise un gestionnaire de process comme [pm2](https://pm2.keymetrics.io/) (`pm2 start npm --name mindmatch -- start`) ou un service systemd, sinon le serveur s'arrête si le terminal se ferme.
- **Reverse proxy + HTTPS** : mets Nginx ou Caddy devant le port 3001 pour exposer l'app sur ton domaine avec un certificat TLS (Let's Encrypt). C'est important car l'app envoie un jeton d'identité par personne (`memberToken`) à chaque requête — en HTTPS, ce jeton reste chiffré en transit.
- **Port personnalisé** : définis la variable d'environnement `PORT` si 3001 est déjà pris.
- **Persistance des données** : tout est stocké dans `server/data/db.json`. Ce fichier est créé automatiquement au premier démarrage et **n'est pas suivi par git** — pense à le sauvegarder régulièrement si tu veux garder l'historique des groupes. Tu peux aussi changer son emplacement avec `MINDMATCH_DB_PATH=/chemin/vers/db.json`.

## Build seul (sans lancer le serveur)

```bash
npm run build
npm run preview   # prévisualise juste le frontend buildé, sans API (utile pour vérifier le rendu)
```
