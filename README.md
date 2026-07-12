# MindMatch Party 🧠🎉

MindMatch Party est une plateforme de soirée sociale entre amis, à héberger toi-même. Crée une salle privée, partage un code, chacun rejoint depuis son téléphone : réponds au quiz de personnalité MindMatch (36 questions → profil, archétype, comparaisons de groupe, débats), puis enchaîne sur des jeux de soirée synchronisés en temps réel — avec un mode "écran partagé" à afficher sur une TV, une ambiance sonore et visuelle façon party-game, et une vraie persistance des données (SQLite).

Les salles, réponses et parties sont partagées en temps réel entre tous les membres via un petit serveur (REST + WebSocket) — un seul déploiement suffit pour que tout le monde (sur son propre téléphone) rejoigne la même salle avec un code.

## Fonctionnalités

**Profil de personnalité** (le cœur historique de MindMatch) :
- **Questionnaire** — 36 questions (personnalité, valeurs, dilemmes, préférences), cartes animées et barre de progression.
- **Profil** — archétype, description personnalisée, radar chart et jauges sur 7 traits (créativité, logique, ambition, empathie, indépendance, sociabilité, organisation).
- **Groupe** — radar comparatif, points communs, différences, classements amusants.
- **Débats** — sujets générés à partir des plus grands écarts de personnalité.

**Plateforme de soirée** :
- **Salle live** — création/jointure par code, liste des joueurs connectés en direct, avatars, niveaux.
- **XP, niveaux, badges** — chaque partie fait progresser les joueurs (XP, niveaux) et peut débloquer des badges. Les résultats des jeux peuvent aussi ajuster légèrement les scores de personnalité (ex. gagner "Qui est le plus créatif ?" pousse un peu le trait Créativité).
- **Historique des parties** — chaque jeu terminé est enregistré durablement (jeu, nombre de manches, date) et visible dans la salle sous "Parties récentes".
- **Moteur de jeu modulaire** (`server/games/`, `src/party/games/`) — chaque jeu est un module indépendant avec ses propres phases, actions et récompenses XP, prêt à accueillir de futurs jeux.
- **Mode 18+** — réglage activable par l'hôte (avec un rappel à la modération) qui débloque les packs de contenu trash et les jeux à boire.
- **Ambiance party-game** — fond animé, musique d'ambiance générative (aucun fichier audio à télécharger — tout est synthétisé en direct dans le navigateur) et effets sonores, avec des réglages dédiés (musique/effets, volume) accessibles partout dans l'app.

**Neuf jeux jouables** :
- **Qui est le plus ?** 🎯 — vote anonyme sur une question ("Qui est le/la plus susceptible de...?"), révélation animée avec confettis, classement en direct.
- **Dilemmes & Débats** ⚖️ — le groupe vote sur des dilemmes à choix binaire (pack Classique, packs Trash 18+ et Mixte une fois le mode 18+ activé), révélation du split du groupe en direct.
- **Profil secret** 🔍 — deux indices de personnalité sont révélés, le groupe doit deviner qui est le "profil secret" de la manche.
- **Devine ma réponse** 🕵️ — devinez ce qu'un·e ami·e a répondu à une question du quiz MindMatch.
- **Qui a écrit ça ?** ✍️ — chacun écrit une réponse anonyme à un prompt, les textes sont mélangés et il faut retrouver qui a écrit quoi.
- **Cartes de soirée** 🃏 — action/vérité/défi à tour de rôle, packs Classique et Trash 18+.
- **Pyramide** 🍻 (18+) — jeu à boire : main de cartes privée, pyramide de cartes révélées une à une, accusations et bluffs ("tu bois !"), récitation finale pour des gorgées bonus.
- **Palmier** 🌴 (18+) — jeu à boire "Le Cercle" : 52 cartes en cercle autour d'un verre central, chaque valeur a sa règle (cul sec, distribution, "Four to the floor"/"Five to the fly", complice, nouvelle règle...), le 4e Roi termine la partie.
- **Autoroute** 🛣️ (18+) — jeu à boire : pariez si la prochaine carte sera plus haute ou plus basse, enchaînez les bonnes réponses pour avancer, un raté fait boire autant que la progression perdue.
- **Mode écran partagé ("Party Screen")** — page `/screen/:code` pensée pour une TV : questions, votes en direct, révélations et classement en grand format, pendant que les téléphones ne servent qu'à répondre.

## Stack

- **Frontend** — React 19 + TypeScript + Vite, Tailwind CSS v4, Framer Motion, React Router (HashRouter), Zustand, Socket.IO client. Musique et effets sonores générés en direct avec la Web Audio API (pas de fichiers audio externes).
- **Backend** — Node.js + Express + Socket.IO.
- **Persistance** — SQLite (`better-sqlite3`), un seul fichier `db.sqlite3` (mode WAL), zéro service supplémentaire à installer ou administrer. Groupes et membres sont stockés dans de vraies tables relationnelles ; les données propres à chaque jeu (réponses en cours, historique de manche...) sont stockées en JSON dans quelques colonnes dédiées, plus adapté qu'un schéma rigide vu que chaque mini-jeu a son propre état.
- **Déploiement** — `Dockerfile` (multi-stage) + `docker-compose.yml` fournis pour un déploiement conteneurisé en une commande ; fonctionne aussi en Node.js direct sur l'hôte (voir plus bas).

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

## Déployer sur ton propre serveur (VPS)

L'app se déploie comme **un seul processus Node** qui sert à la fois le site et l'API, exposé sur `127.0.0.1:3001` — Nginx en reverse proxy s'occupe du domaine et du HTTPS par-dessus. Deux façons d'exécuter ce processus : Docker (recommandé, surtout si tu as déjà d'autres services conteneurisés) ou Node.js installé directement sur l'hôte. Le reste du guide (Nginx, DNS, HTTPS, pare-feu) est identique dans les deux cas.

### Option A — Docker (recommandé)

Le repo fournit un `Dockerfile` (multi-stage : build puis image d'exécution allégée) et un `docker-compose.yml`.

```bash
sudo apt update && sudo apt install -y git docker.io docker-compose-plugin
sudo mkdir -p /var/www/mindmatch
sudo chown $USER:$USER /var/www/mindmatch
git clone <url-de-ton-repo> /var/www/mindmatch
cd /var/www/mindmatch

docker compose up -d --build
docker compose ps   # doit afficher le conteneur "mindmatch" en "running"
```

Les données SQLite vivent dans `./data` (bind mount défini dans `docker-compose.yml`), donc elles survivent aux rebuilds d'image.

Mettre à jour l'app plus tard :

```bash
cd /var/www/mindmatch
git pull
docker compose up -d --build
```

### Option B — Node.js installé directement sur l'hôte

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git build-essential python3

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

`build-essential` et `python3` servent à compiler la dépendance native `better-sqlite3` si aucun binaire précompilé n'est disponible pour ta plateforme — l'installation `npm install` s'en charge automatiquement le cas échéant.

```bash
sudo mkdir -p /var/www/mindmatch
sudo chown $USER:$USER /var/www/mindmatch
git clone <url-de-ton-repo> /var/www/mindmatch
cd /var/www/mindmatch

npm install
npm run build          # frontend -> dist/
npm run build:server   # backend  -> dist-server/index.mjs
```

Garde le process actif avec un service systemd — crée `/etc/systemd/system/mindmatch.service` :

```ini
[Unit]
Description=MindMatch Party
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/mindmatch
ExecStart=/usr/bin/node dist-server/index.mjs
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=3001
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /var/www/mindmatch
sudo systemctl daemon-reload
sudo systemctl enable --now mindmatch
sudo systemctl status mindmatch   # doit afficher "active (running)"
```

Mettre à jour l'app plus tard :

```bash
cd /var/www/mindmatch
git pull
npm install
npm run build
npm run build:server
sudo systemctl restart mindmatch
```

### Nginx en reverse proxy (avec support WebSocket)

Que tu aies choisi l'option A ou B, l'app écoute sur `127.0.0.1:3001` — la config Nginx est la même :

Crée `/etc/nginx/sites-available/mindmatch` :

```nginx
server {
    listen 80;
    server_name mindmatch.tondomaine.fr;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mindmatch /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### DNS + HTTPS

Pointe un enregistrement DNS de type A (ou AAAA) de `mindmatch.tondomaine.fr` vers l'IP publique du serveur, chez ton registrar/fournisseur DNS. Une fois propagé (`dig mindmatch.tondomaine.fr` doit renvoyer la bonne IP) :

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mindmatch.tondomaine.fr
```

Certbot édite automatiquement la config Nginx pour rediriger le HTTP vers HTTPS et met en place le renouvellement automatique du certificat (timer systemd `certbot.timer`, déjà activé par défaut). Si tu gères déjà tes certificats manuellement (méthode webroot, un seul bloc `:80` partagé entre plusieurs domaines...), ajoute simplement `mindmatch.tondomaine.fr` à ce bloc existant et lance `certbot certonly --webroot -w <ton-webroot> -d mindmatch.tondomaine.fr` à la place.

### Pare-feu

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Persistance et sauvegardes

Toutes les données (groupes, membres, scores, historique de parties) vivent dans un fichier `db.sqlite3` (+ ses fichiers `-wal`/`-shm` en mode WAL), créé automatiquement au premier démarrage et **non suivi par git** :
- **Option A (Docker)** — `./data/db.sqlite3`, à l'extérieur du conteneur grâce au bind mount du `docker-compose.yml`.
- **Option B (Node direct)** — `server/data/db.sqlite3` par défaut ; change l'emplacement avec `MINDMATCH_DB_PATH=/chemin/vers/db.sqlite3` dans le service systemd.

Pour une sauvegarde propre (cohérente même si le serveur tourne), utilise la commande de backup native de SQLite plutôt qu'une simple copie de fichier :

```bash
# Option A (Docker)
sqlite3 /var/www/mindmatch/data/db.sqlite3 ".backup /chemin/de/sauvegarde/db-$(date +%F).sqlite3"

# Option B (Node direct)
sqlite3 /var/www/mindmatch/server/data/db.sqlite3 ".backup /chemin/de/sauvegarde/db-$(date +%F).sqlite3"
```

Automatisable avec une tâche cron quotidienne.

## Build seul (sans lancer le serveur)

```bash
npm run build
npm run preview   # prévisualise juste le frontend buildé, sans API (utile pour vérifier le rendu)
```
