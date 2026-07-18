# Multi-stage build: stage 1 compiles the DS engine modules (needs gcc),
# stage 2 is the runtime image (doesn't — the compiled binaries are copied
# over). Build context is expected to be the repo root, e.g.:
#   docker build -f docker/Dockerfile -t ams .

FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY Backend ./Backend
COPY scripts ./scripts
RUN node scripts/build-c.js

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/c-executables ./server/c-executables
COPY package.json ./
COPY server ./server
COPY Frontend ./Frontend

# server/data/.gitkeep-only dir needs to exist for local dev fallbacks, but
# the app's real datastore is Postgres via DATABASE_URL.
RUN mkdir -p server/data

EXPOSE 3000
CMD ["node", "server/app.js"]
