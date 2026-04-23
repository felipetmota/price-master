# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy source
COPY src ./src
COPY sql ./sql
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1

CMD ["node", "src/index.js"]