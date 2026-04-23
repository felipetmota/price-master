# Price Management API

Node.js + Express REST API backed by **PostgreSQL**. Designed to run as a
Docker container behind Traefik (or any reverse proxy).

## Local development (without Docker)

```bash
cd server
cp .env.example .env       # edit DATABASE_URL or PG* vars
npm install
npm run migrate:hash-passwords   # seed initial users
npm start                  # http://localhost:3001
```

On first boot the API automatically runs `sql/schema.sql` if the `contracts`
table doesn't exist yet — no manual migration step needed.

## Docker

```bash
cd server
docker build -t price-management-api .
docker run -p 3001:3001 \
  -e DATABASE_URL=postgres://price:secret@host.docker.internal:5432/price_management \
  price-management-api
```

## Endpoints

| Method | Path                                 | Description                       |
| ------ | ------------------------------------ | --------------------------------- |
| GET    | `/api/health`                        | Health + DB connectivity check    |
| POST   | `/api/auth/login`                    | Validate credentials              |
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

All mutating endpoints accept an `X-Actor` header to attribute the change to
the logged-in user in the audit log.

## Notes

- Stateless service — no JWT or sessions. Designed for a private LAN. Put an
  auth proxy (Authelia / Authentik) in front if exposing publicly.
- Currency conversion is done client-side; the server stores each record's
  original currency.