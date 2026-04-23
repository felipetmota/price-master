# On-Premise Deployment — Portainer + Traefik + PostgreSQL + nginx

This guide assumes you already have, on the same Docker host:

- **Portainer** (UI to manage stacks)
- **Traefik** (reverse proxy + TLS) on a Docker network called `traefik`
- **PostgreSQL** (any recent version, 13+)
- **nginx** serving static sites

You only need to deploy **the API container**. The frontend is built once and
served by your existing nginx.

---

## Architecture

```
 Browser  ──HTTPS──▶  Traefik  ──▶  nginx  ──▶  dist/ (static React build)
                          │
                          └────▶  price-management-api  ──▶  PostgreSQL
                                  (Docker container)        (existing)
```

---

## 1. Create the database

On your PostgreSQL host:

```sql
CREATE DATABASE price_management;
CREATE USER price_user WITH ENCRYPTED PASSWORD 'a-strong-password';
GRANT ALL PRIVILEGES ON DATABASE price_management TO price_user;
```

The schema is created **automatically** on first API boot — no need to run
`schema.sql` manually. (It's also available at `server/sql/schema.sql` if you
prefer to apply it yourself.)

---

## 2. Deploy the API stack in Portainer

1. Push this repo to a Git server reachable by Portainer (Gitea, GitHub,
   GitLab — anything). Or copy the folder to the Docker host.
2. In Portainer: **Stacks → Add stack**.
3. Choose **Repository** (recommended) and point it at this repo. Compose
   path: `docker-compose.yml`.
   - Or choose **Web editor** and paste the contents of `docker-compose.yml`,
     then upload `server/` to the same directory on the host.
4. Scroll down to **Environment variables** and set:

   | Name           | Example                                                        |
   | -------------- | -------------------------------------------------------------- |
   | `DATABASE_URL` | `postgres://price_user:secret@host.docker.internal:5432/price_management` |
   | `API_HOST`     | `price-api.intranet.local`                                     |
   | `CORS_ORIGIN`  | `https://prices.intranet.local`                                |
   | `PGSSL`        | `false` (or `true` if your Postgres requires TLS)              |

   > If your Postgres is in another Docker stack on the same network, use the
   > service name instead of `host.docker.internal` (e.g. `postgres:5432`).
   > In that case, also add the postgres network under `networks:` in the
   > compose file.

5. Click **Deploy the stack**.
6. Traefik picks up the labels automatically and starts routing
   `https://${API_HOST}` to the container.

Verify:

```bash
curl https://price-api.intranet.local/api/health
# → {"status":"ok","database":"connected"}
```

---

## 3. Seed initial users

Open a shell inside the running container (Portainer → Containers →
`price-management-api` → **Console**) and run:

```bash
# Edit USERS in scripts/hash-passwords.js first if you want different creds
node scripts/hash-passwords.js
```

Defaults: `admin / admin` and `user / user`. **Change them before going
live.**

---

## 4. Build & deploy the frontend

On any machine with Node 20+:

```bash
cp .env.example .env
# Set VITE_API_URL=https://price-api.intranet.local
npm install
npm run build
```

Copy the contents of `dist/` to your nginx web root, e.g.:

```bash
rsync -avz dist/ user@nginx-host:/var/www/prices/
```

Minimal nginx config (with Traefik in front for TLS):

```nginx
server {
    listen 80;
    server_name prices.intranet.local;
    root /var/www/prices;
    index index.html;

    # SPA fallback — React Router needs this
    location / {
        try_files $uri /index.html;
    }

    # Long cache for hashed assets, no cache for index.html
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

> `VITE_API_URL` is **baked in at build time**. If you change the API host,
> rebuild and redeploy `dist/`.

---

## 5. Updates

- **API**: in Portainer → Stacks → your stack → **Pull and redeploy**.
- **Frontend**: rebuild and copy `dist/` again.

---

## Environment variables

### Frontend (`.env` at repo root, used by `npm run build`)

| Variable        | Required | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| `VITE_API_URL`  | yes      | HTTPS URL of the API, e.g. `https://price-api...` |

### API (set via Portainer stack environment)

| Variable       | Required | Default | Description                                   |
| -------------- | -------- | ------- | --------------------------------------------- |
| `DATABASE_URL` | yes      | —       | Postgres connection string                    |
| `PGSSL`        | no       | `false` | Set to `true` to require TLS to Postgres      |
| `CORS_ORIGIN`  | no       | `*`     | Comma-separated list of allowed origins       |
| `PORT`         | no       | `3001`  | Internal container port (don't change)        |

---

## Backup & restore

```bash
# Backup
pg_dump -h <host> -U price_user -d price_management -F c -f price_$(date +%F).dump

# Restore
pg_restore -h <host> -U price_user -d price_management --clean price_2026-04-23.dump
```

---

## Security checklist

- [ ] Use a dedicated Postgres user with rights only on `price_management`.
- [ ] Restrict `CORS_ORIGIN` to the actual frontend host(s).
- [ ] Always front the API with HTTPS via Traefik.
- [ ] Replace seed users (`admin / admin`) immediately.
- [ ] Schedule daily `pg_dump` backups.

---

## How the fallback works (Lovable preview)

When `VITE_API_URL` is empty **or** the `/api/health` check fails, the app
keeps using the bundled `.xlsx` template loader — perfect for the Lovable
preview, which has no backend. Set `VITE_API_URL` in production builds to
enable the PostgreSQL backend.