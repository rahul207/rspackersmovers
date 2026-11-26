# syntax=docker/dockerfile:1.7

# ---- build ------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/domain/package.json packages/domain/
COPY packages/application/package.json packages/application/
COPY packages/infrastructure/package.json packages/infrastructure/
# Skip lifecycle scripts (husky) and browser downloads; tools needed for the build are installed.
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

# ---- runtime ----------------------------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    SERVE_WEB=true \
    PORT=3000 \
    HOST=0.0.0.0
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=node:node /app/package.json ./package.json

# XLSX files and rotating backups live here; mount a volume to persist them.
RUN mkdir -p /app/storage && chown node:node /app/storage
VOLUME ["/app/storage"]

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
