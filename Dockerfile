FROM node:22-slim AS builder
WORKDIR /app

# python3/build-essential: only needed here, to compile better-sqlite3's native addon once.
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Variables VITE_* : lues au BUILD du frontend (elles sont figées dans le bundle). Passées en
# build-args par docker-compose depuis le fichier .env. Vides par défaut = fonctionnalités
# optionnelles simplement désactivées (YouTube marche sans, Spotify affiche "Bientôt").
ARG VITE_YOUTUBE_API_KEY=""
ARG VITE_SPOTIFY_CLIENT_ID=""
ENV VITE_YOUTUBE_API_KEY=$VITE_YOUTUBE_API_KEY
ENV VITE_SPOTIFY_CLIENT_ID=$VITE_SPOTIFY_CLIENT_ID

RUN npm run build && npm run build:server
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3001
CMD ["node", "dist-server/index.mjs"]
