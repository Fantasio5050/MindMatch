# MindMatch Party 🧠🎉

Plateforme de soirée entre amis, à héberger toi-même. Crée une salle, partage le code, chacun rejoint depuis son téléphone : test de personnalité, jeux de soirée synchronisés en temps réel, mode « écran partagé » pour la TV, et une file musicale collective. Un seul serveur (REST + WebSocket) suffit pour que tout le monde rejoigne la même salle.

## Fonctionnalités

- **Test de personnalité** — questionnaire (3 niveaux), profil + archétype, radar de 7 traits, comparaisons de groupe et débats auto-générés.
- **Soirée multijoueur** — salle live, XP/niveaux/badges, historique des parties, mode 18+ (contenu trash + jeux à boire), écran partagé TV, ambiance sonore et visuelle.
- **Mode Soirée (la platine partagée)** 🎶 — file musicale collective : chacun ajoute des morceaux depuis son téléphone (recherche intégrée), la file est **équitable** (round-robin), avec vote-pour-passer et fondu enchaîné. Une « platine » (`/platine/:code`) branchée à l'enceinte lit le son. Source **YouTube** prête à l'emploi ; **Spotify** en option (voir config).
- **11 jeux** — Qui est le plus ? · Dilemmes & Débats · Profil secret · Devine ma réponse · Qui a écrit ça ? · Cartes de soirée · Coup de Crayon (dessin) · Pyramide 🍻 · Palmier 🍻 · Autoroute 🍻 · PMU / Roue Infernale / Petits chevaux / Blackjack (jeux à boire 18+).

## Stack

React 19 + TypeScript + Vite + Tailwind v4 + Framer Motion + Zustand + Socket.IO (client) · Node + Express + Socket.IO (serveur) · SQLite (`better-sqlite3`, un seul fichier, mode WAL). Déploiement Docker ou Node direct.

## Développement local

```bash
npm install
npm run dev:full   # frontend (Vite :5173) + API (:3001) ensemble
```

## Configuration optionnelle (musique)

Le Mode Soirée marche **sans rien configurer** en YouTube (recherche via instances publiques, ou collage de lien). Variables facultatives (au build du frontend / sur le serveur), voir `.env.example` :

| Variable | Effet |
| --- | --- |
| `VITE_YOUTUBE_API_KEY` | Recherche YouTube plus fiable (sinon : instances publiques + collage de lien). |
| `VITE_SPOTIFY_CLIENT_ID` | Active Spotify côté platine (bouton « Se connecter », lecture SDK — **Premium requis**). |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Recherche Spotify côté serveur (le secret ne quitte jamais le serveur). |

Pour Spotify : crée une app sur le dashboard Spotify Developer et ajoute l'URL de redirection `https://TON-DOMAINE/`.

## Déploiement (VPS)

L'app tourne comme **un seul processus Node** sur `127.0.0.1:3001`, derrière Nginx (domaine + HTTPS).

### Docker (recommandé)

```bash
sudo apt install -y git docker.io docker-compose-plugin
git clone <url-du-repo> /var/www/mindmatch && cd /var/www/mindmatch
docker compose up -d --build
```

Les données SQLite vivent dans `./data` (bind mount) et survivent aux rebuilds. Mise à jour : `git pull && docker compose up -d --build`.

### Node direct

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs build-essential python3
git clone <url-du-repo> /var/www/mindmatch && cd /var/www/mindmatch
npm install && npm run build && npm run build:server
```

Puis un service systemd (`ExecStart=/usr/bin/node dist-server/index.mjs`, `Environment=PORT=3001`) pour garder le process actif.

### Nginx + HTTPS

Reverse proxy vers `127.0.0.1:3001` **avec upgrade WebSocket** :

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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Puis HTTPS en une commande : `sudo certbot --nginx -d mindmatch.tondomaine.fr`.

## Sauvegardes

Toutes les données sont dans `db.sqlite3` (Docker : `./data/`, Node : `server/data/`, ou `MINDMATCH_DB_PATH`). Sauvegarde cohérente :

```bash
sqlite3 <chemin>/db.sqlite3 ".backup /sauvegarde/db-$(date +%F).sqlite3"
```
