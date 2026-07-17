FROM node:24-slim AS builder
WORKDIR /app

# Plus de dépendance native à compiler (SQLite est fourni par node:sqlite), donc pas besoin de
# python3/build-essential : l'image reste minimale.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run build:server
RUN npm prune --omit=dev

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3001
CMD ["node", "dist-server/index.mjs"]
