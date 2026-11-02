# syntax=docker/dockerfile:1

# ---- build: install all deps and compile TypeScript ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
# Falls back to `npm install` only if no lockfile is present (see note in README/handoff).
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json tsconfig.build.json ./
COPY app.ts server.ts ./
COPY config ./config
COPY controllers ./controllers
COPY middleware ./middleware
COPY models ./models
COPY routes ./routes
COPY services ./services
COPY utils ./utils
COPY validators ./validators
RUN npm run build

# ---- runtime: production deps + compiled output only ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
 && npm cache clean --force

COPY --from=build /app/dist ./dist

# The official image ships an unprivileged `node` user.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run with `docker run --init` (or `init: true` in compose) so signals reach node cleanly.
CMD ["node", "dist/server.js"]
