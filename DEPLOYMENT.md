# On-Premise Deployment — Portainer + Traefik + nginx (SQLite)

This guide assumes you already have, on the same Docker host:

- **Portainer** (UI to manage stacks)
- **Traefik** (reverse proxy + TLS) on a Docker network called `traefik`
- **nginx** serving static sites

The API ships with **SQLite** (single-file database). No external DB
server needed. When you're ready to scale, swap the driver in
`server/src/db.js` for PostgreSQL — the route layer doesn't change.

You only need to deploy **the API container**. The frontend is built
once and served by your existing nginx.

---

## Architecture

```
 Browser  ──HTTPS──▶  Traefik  ──▶  nginx  ──▶  dist/ (static React build)
                          │
                          └────▶  price-management-api  ──▶  /data/prices.db
                                  (Docker container)        (Docker volume)
```

---

## 1. Deploy the API stack in Portainer

1. Push this repo to a Git server reachable by Portainer (Gitea, GitHub,
   GitLab — anything). Or copy the folder to the Docker host.
2. In Portainer: **Stacks → Add stack**.
3. Choose **Repository** (recommended) and point it at this repo. Compose
   path: `docker-compose.yml`.
4. Scroll down to **Environment variables** and set:

   | Name           | Example                                |
   | -------------- | -------------------------------------- |
   | `API_HOST`     | `price-api.intranet.local`             |
   | `CORS_ORIGIN`  | `https://prices.intranet.local`        |

5. Click **Deploy the stack**.
6. Traefik picks up the labels automatically and starts routing
   `https://${API_HOST}` to the container.

The schema is created **automatically** on first boot (idempotent).
The database file lives in the named Docker volume `price_data`.

Verify:

```bash
curl https://price-api.intranet.local/api/health
# → {"status":"ok","database":"connected"}
```

---

## 2. Seed initial users

Open a shell inside the running container (Portainer → Containers →
`price-management-api` → **Console**) and run:

```bash
# Edit USERS in scripts/hash-passwords.js first if you want different creds
node scripts/hash-passwords.js
```

Defaults:
- `admin / admin` — role `admin` (full access to every system)
- `user  / user`  — role `user`, granted access to `price-management`

**Change these credentials before going live.**

You can also manage per-user system grants from the UI: log in as admin
and open **Admin → Access**.

---

## 3. Build & deploy the frontend

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

> `VITE_API_URL` is **baked in at build time**. If you change the API
> host, rebuild and redeploy `dist/`.

---

## 4. Updates

- **API**: in Portainer → Stacks → your stack → **Pull and redeploy**.
  The SQLite file in the volume is preserved across redeploys.
- **Frontend**: rebuild and copy `dist/` again.

---

## Environment variables

### Frontend (`.env` at repo root, used by `npm run build`)

| Variable        | Required | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| `VITE_API_URL`  | yes      | HTTPS URL of the API, e.g. `https://price-api...` |

### API (set via Portainer stack environment)

| Variable       | Required | Default            | Description                                |
| -------------- | -------- | ------------------ | ------------------------------------------ |
| `SQLITE_PATH`  | no       | `/data/prices.db`  | Path to the SQLite file inside the volume  |
| `CORS_ORIGIN`  | no       | `*`                | Comma-separated list of allowed origins    |
| `PORT`         | no       | `3001`             | Internal container port (don't change)     |

---

## Backup & restore

SQLite is a single file. Two reliable options:

**Hot backup (recommended)** — uses SQLite's online backup API:

```bash
docker exec price-management-api \
  sh -c 'sqlite3 /data/prices.db ".backup /data/prices-$(date +%F).db"'

docker cp price-management-api:/data/prices-$(date +%F).db ./backups/
```

**Volume snapshot** — fast, works while the API is idle:

```bash
docker run --rm -v price_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/prices-$(date +%F).tgz -C /data .
```

Restore: stop the container, replace `/data/prices.db` in the volume,
start the container again.

---

## Migrating to PostgreSQL later

When SQLite outgrows you (multi-GB datasets, many concurrent writers, or
horizontal scaling), the upgrade path is:

1. Replace `better-sqlite3` with `pg` in `server/package.json`.
2. Rewrite `server/src/db.js` to use a `pg.Pool` (the file is small and
   isolated — about 30 lines).
3. Convert `server/sql/schema.sql` to Postgres syntax (UUIDs, `JSONB`,
   `TIMESTAMPTZ`, `RETURNING *` already works).
4. `pg_loader` or a custom script can dump the SQLite file straight into
   Postgres.

The route layer, the frontend, and the API contract all stay identical.

---

## Security checklist

- [ ] Restrict `CORS_ORIGIN` to the actual frontend host(s).
- [ ] Always front the API with HTTPS via Traefik.
- [ ] Replace seed users (`admin / admin`) immediately.
- [ ] Schedule daily backups of the `price_data` volume.
- [ ] Mount the volume on encrypted storage if records are sensitive.

---

## How the fallback works (Lovable preview)

When `VITE_API_URL` is empty **or** the `/api/health` check fails, the
app keeps using the bundled `.xlsx` template loader — perfect for the
Lovable preview, which has no backend. Set `VITE_API_URL` in production
builds to enable the SQLite backend.

In API mode the **Admin → Access** tab persists changes to the
`user_systems` table; in fallback mode the changes live only in the
browser tab.