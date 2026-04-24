# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

WORKDIR /app

# better-sqlite3 ships prebuilt binaries for glibc (Debian) on both amd64 and
# arm64, so no build toolchain is needed here. wget is used by the healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy source
COPY src ./src
COPY sql ./sql
COPY scripts ./scripts

# Persistent SQLite storage. Mount a volume here in docker-compose to keep
# the database across container restarts.
RUN mkdir -p /data
ENV SQLITE_PATH=/data/prices.db
VOLUME ["/data"]

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1

CMD ["node", "src/index.js"]