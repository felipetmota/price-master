# Price Management API

Node.js + Express REST API backed by **Microsoft SQL Server**. This service is
the on-premise backend for the Price Management web app. The browser-only
frontend (Vite + React) talks to this API over HTTP.

## Requirements

- Node.js **20+**
- SQL Server **2019+** (Express, Standard or Enterprise) reachable from the
  machine that will run this API.
- A database created for the app, e.g. `CREATE DATABASE PriceManagement;`

## 1. Create the schema

Open SQL Server Management Studio (or `sqlcmd`) and run:

```bash
sqlcmd -S localhost -d PriceManagement -i sql/schema.sql
```

This creates the tables `Contracts`, `Prices`, `ExchangeRates`, `Users`,
`AuditLog` and seeds default exchange rates.

## 2. Configure the API

```bash
cd server
cp .env.example .env
# edit .env with your SQL Server host, database, user and password
npm install
```

## 3. Seed users

Edit `scripts/hash-passwords.js` and set the initial usernames/passwords
(passwords are stored as bcrypt hashes — never in plain text). Then run:

```bash
npm run migrate:hash-passwords
```

## 4. Run

```bash
npm start
# API listens on http://localhost:3001 by default
```

Verify: `curl http://localhost:3001/api/health` → `{"status":"ok","database":"connected"}`

## 5. Run as a Windows Service

The simplest option is **NSSM** (Non-Sucking Service Manager):

```powershell
nssm install PriceManagementAPI "C:\Program Files\nodejs\node.exe" "C:\apps\price-mgmt\server\src\index.js"
nssm set PriceManagementAPI AppDirectory "C:\apps\price-mgmt\server"
nssm set PriceManagementAPI AppEnvironmentExtra ":SQLSERVER_HOST=..."
nssm start PriceManagementAPI
```

Alternatively use [`node-windows`](https://github.com/coreybutler/node-windows).

## Endpoints (summary)

| Method | Path                              | Description                       |
| ------ | --------------------------------- | --------------------------------- |
| GET    | `/api/health`                     | Health + DB connectivity check    |
| POST   | `/api/auth/login`                 | Validate credentials              |
| GET    | `/api/prices`                     | List all price records            |
| POST   | `/api/prices?source=manual\|import` | Insert one or many records      |
| PUT    | `/api/prices/:id`                 | Update one record                 |
| DELETE | `/api/prices`                     | Delete by ids `{ ids: [...] }`    |
| POST   | `/api/prices/:id/revert`          | Revert to previous values         |
| POST   | `/api/prices/bulk-update`         | Bulk update by simple match       |
| GET    | `/api/contracts`                  | List contracts                    |
| POST   | `/api/contracts`                  | Create contract                   |
| PUT    | `/api/contracts/:id`              | Update contract                   |
| DELETE | `/api/contracts/:id`              | Delete contract                   |
| GET    | `/api/rates`                      | Get exchange rates                |
| PUT    | `/api/rates`                      | Replace exchange rates            |
| GET    | `/api/audit?limit=500`            | Read audit log                    |

All mutating endpoints accept an `X-Actor` header (or `_actor` body field) to
attribute the change to the logged-in user in the audit log.

## Notes

- This service is intentionally **stateless** — no JWT or sessions. It is
  designed to run on a private LAN. Add an authentication proxy / SSO in front
  if exposing it to a wider network.
- Currency conversion happens on the client; the server stores the original
  currency of each record.