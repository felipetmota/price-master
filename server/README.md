# Price Management API

Node.js + Express REST API backed by **SQLite** (`better-sqlite3`).
Zero external services — the database is a single file. Designed to run
as a Docker container behind Traefik (or any reverse proxy), or directly
on the host with `npm start`.

> Migrating to PostgreSQL later only requires swapping the driver in
> `src/db.js`; the route layer is already written against a tiny
> `query()` abstraction.

## Local development (without Docker)

```bash
cd server
cp .env.example .env       # SQLITE_PATH defaults to ./data/prices.db
npm install
npm run seed:users         # creates schema + admin/user accounts
npm start                  # http://localhost:3001
```

On first boot the API automatically runs `sql/schema.sql` (idempotent —
all `CREATE` statements use `IF NOT EXISTS`).

## Docker

```bash
cd server
docker build -t price-management-api .
docker run -p 3001:3001 \
  -v price_data:/data \
  price-management-api

# Seed initial users (one-off):
docker exec -it <container> node scripts/hash-passwords.js
```

The SQLite file lives at `/data/prices.db` inside the container — mount a
named volume (or a bind mount) there so it survives restarts.

## Endpoints

| Method | Path                                 | Description                       |
| ------ | ------------------------------------ | --------------------------------- |
| GET    | `/api/health`                        | Health + DB connectivity check    |
| POST   | `/api/auth/login`                    | Validate credentials, returns systems[] |
| GET    | `/api/prices`                        | List all price records            |
| POST   | `/api/prices?source=manual\|import`  | Insert one or many records        |
| PUT    | `/api/prices/:id`                    | Update one record                 |
| DELETE | `/api/prices`                        | Delete by ids `{ ids: [...] }`    |
| POST   | `/api/prices/:id/revert`             | Revert to previous values         |
| POST   | `/api/prices/bulk-update`            | Bulk update by simple match       |
| GET    | `/api/contracts`                     | List contracts                    |
| POST   | `/api/contracts`                     | Create contract                   |
| PUT    | `/api/contracts/:id`                 | Update contract                   |
| DELETE | `/api/contracts/:id`                 | Delete contract                   |
| GET    | `/api/rates`                         | Get exchange rates                |
| PUT    | `/api/rates`                         | Replace exchange rates            |
| GET    | `/api/audit?limit=500`               | Read audit log                    |
| GET    | `/api/users`                         | List users + their granted systems |
| PUT    | `/api/users/:username/systems`       | Replace a user's system grants    |

All mutating endpoints accept an `X-Actor` header to attribute the change to
the logged-in user in the audit log.

## Backup

SQLite is just a file — copying it while the server is idle is enough.
For a hot backup use the official `.backup` command:

```bash
# Inside the container
sqlite3 /data/prices.db ".backup /data/prices-$(date +%F).db"
```

Or backup the whole Docker volume:

```bash
docker run --rm -v price_data:/data -v $PWD:/backup alpine \
  tar czf /backup/prices-$(date +%F).tgz -C /data .
```

## Notes

- Stateless service — no JWT or sessions. Designed for a private LAN. Put an
  auth proxy (Authelia / Authentik) in front if exposing publicly.
- Currency conversion is done client-side; the server stores each record's
  original currency.