# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# ng build → configuration "production" par défaut (browser + serveur SSR)
RUN npm run build

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Dépendances de prod uniquement (le bundle serveur SSR reste léger).
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 4000
# Serveur SSR Node (Express). NG_ALLOWED_HOSTS et PORT fournis via l'env.
CMD ["node", "dist/landing/server/server.mjs"]
