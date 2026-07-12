# MindMatch Party 🧠🎉

MindMatch Party est une plateforme de soirée sociale entre amis. Créez une salle privée, partagez un code, chacun rejoint depuis son téléphone : répondez au quiz de personnalité MindMatch (36 questions → profil, archétype, comparaisons de groupe, débats), puis enchaînez sur des jeux de soirée synchronisés en temps réel, avec un mode "écran partagé" à afficher sur une TV.

Les salles, réponses et parties sont partagées en temps réel entre tous les membres via un petit serveur (REST + WebSocket) — un seul déploiement suffit pour que tout le monde (sur son propre téléphone) rejoigne la même salle avec un code.

## Fonctionnalités

**Profil de personnalité** (le cœur historique de MindMatch, inchangé) :
- **Questionnaire** — 36 questions (personnalité, valeurs, dilemmes, préférences), cartes animées et barre de progression. Sauvegardé côté serveur.
- **Profil** — archétype, description personnalisée, radar chart et jauges sur 7 traits (créativité, logique, ambition, empathie, indépendance, sociabilité, organisation).
- **Groupe** — radar comparatif, points communs, différences, classements amusants.
- **Débats** — sujets générés à partir des plus grands écarts de personnalité.

**Plateforme de soirée (nouveau)** :
- **Salle live** — création/jointure par code (existant), liste des joueurs connectés en direct, avatars, niveaux.
- **XP, niveaux, badges** — chaque partie fait progresser les joueurs (XP, niveaux) et peut débloquer des badges (Le Créatif, Le Leader, Le Chaos Ambulant...). Les résultats des jeux peuvent aussi ajuster légèrement les scores de personnalité (ex. gagner "Qui est le plus créatif ?" pousse un peu le trait Créativité).
- **Moteur de jeu modulaire** (`server/games/`, `src/party/games/`) — chaque jeu est un module indépendant avec ses propres phases, actions et récompenses XP, prêt à accueillir de futurs jeux (Devine ma réponse, Cartes de soirée, Qui a écrit ça, Profil secret...).
- **Mode 18+** — réglage activable par l'hôte (avec un rappel à la modération) qui débloque le pack de contenu trash et le jeu à boire.
- **Qui est le plus ?** — vote anonyme sur une question ("Qui est le/la plus susceptible de...?"), révélation animée avec confettis, classement en direct.
- **Dilemmes & Débats** — le groupe vote sur des dilemmes à choix binaire (pack Classique toujours dispo, packs Trash 18+ et Mixte une fois le mode 18+ activé), révélation du split du groupe en direct.
- **Pyramide** 🍻 — jeu à boire : chaque joueur reçoit une main de cartes privée (jamais visible des autres), une pyramide de 15 cartes est révélée une à une (bas = 1 gorgée, sommet = cul sec), les joueurs qui ont une carte correspondante distribuent des gorgées. Classement final + rappel à la modération.
- **Mode écran partagé ("Party Screen")** — page `/screen/:code` pensée pour une TV : questions, votes en direct, révélations et classement en grand format, pendant que les téléphones ne servent qu'à répondre.

## Stack

- **Frontend** — React 19 + TypeScript + Vite, Tailwind CSS v4, Framer Motion, React Router (HashRouter), Zustand, Socket.IO client.
- **Backend** — Node.js + Express + Socket.IO, stockage dans un fichier JSON (`server/data/db.json`), aucune dépendance externe ni compte tiers à créer.

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

## Déployer sur un hébergement mutualisé (o2switch et autres cPanel/Passenger)

Sur un hébergement mutualisé, il n'y a pas d'accès root/SSH complet : le Node.js est géré par **Passenger** via l'interface cPanel ("Setup Node.js App" / "Node.js Selector"), qui attend un simple fichier `.js` exécutable directement — pas `tsx`. Le projet fournit donc un build serveur "bundlé" en un seul fichier, sans dépendance à `tsx` :

```bash
npm install --include=dev   # certains environnements cPanel sautent les devDependencies par défaut (NODE_ENV=production) — ce flag force leur installation, indispensable pour builder
npm run build                # frontend -> dist/
npm run build:server         # backend  -> dist-server/index.mjs (fichier JS autonome, plain Node)
```

Si `npm run build` échoue avec `tsc : commande introuvable` alors que `typescript` est bien dans les devDependencies (bug d'installation observé sur certains mutualisés — le paquet `esbuild` s'installe mais pas `typescript`), utilise la variante sans vérification de types, qui produit exactement le même `dist/` :
```bash
npm run build:no-typecheck
```

Dans cPanel :

1. **Sous-domaine** — crée `mindmatch.tondomaine.fr` dans "Sous-domaines" (ou "Domaines" selon la version de cPanel).
2. **Setup Node.js App** — crée une application : version Node ≥ 18, "Application root" = le dossier où tu as déployé le repo, "Application URL" = ton sous-domaine, **"Application startup file" = `dist-server/index.mjs`**.
3. Dépose les fichiers (Git Version Control dans cPanel, ou upload manuel/FTP du repo), puis lance `npm install` et les deux commandes de build ci-dessus depuis le terminal cPanel (ou le bouton "Run NPM Install" + une commande custom si le terminal n'est pas dispo).
4. Variable d'environnement `PORT` — Passenger la définit lui-même automatiquement, le serveur la lit déjà (`process.env.PORT`), rien à faire.
5. **SSL** — active AutoSSL (Let's Encrypt) sur le sous-domaine depuis "SSL/TLS Status".
6. Redémarre l'app depuis l'interface Node.js Selector après chaque déploiement (bouton "Restart").

**Point d'attention WebSocket** : selon la configuration exacte du proxy devant Passenger, les WebSockets natifs ne passent pas toujours parfaitement sur du mutualisé. Ce n'est pas bloquant : le client est déjà configuré pour retomber automatiquement sur du long-polling HTTP si le WebSocket échoue (`src/lib/socket.ts`), donc l'app reste fonctionnelle même dans ce cas — juste un peu moins instantanée sur les votes/révélations en direct. Teste en conditions réelles (2 téléphones + écran TV) une fois en ligne pour vérifier la fluidité.

**Persistance des données** : comme pour un VPS, tout est dans `server/data/db.json` — pense à le sauvegarder (le gestionnaire de fichiers cPanel ou une tâche cron avec `cp` suffit).
