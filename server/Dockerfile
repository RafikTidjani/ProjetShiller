# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
# Installer les dépendances (sans lockfile pour l'instant)
RUN npm install --production=false
COPY . ./

FROM base AS production
# Installer uniquement les dépendances nécessaires à l'exécution
RUN npm prune --production

EXPOSE 4000
CMD ["npm", "run", "start"]
