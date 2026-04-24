# syntax=docker/dockerfile:1
# Multi-stage build: compile the Vite app, then serve it with nginx.

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# VITE_API_URL is baked into the JS bundle at build time.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* bun.lockb* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]