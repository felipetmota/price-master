

## Goal
Prepare the codebase to connect to a SQL Server database in an on‑premise deployment, while keeping the current Lovable preview (browser‑only) functional.

## Important context
The current app runs **100% in the browser** (Vite + React, no backend). Browsers cannot connect directly to SQL Server — a TCP/TDS protocol is required, which only a server (Node.js, .NET, etc.) can speak. So "leaving the connection ready" means:

1. Creating an **API layer** (Node.js/Express + `mssql` driver) that the React app will call via HTTP.
2. Refactoring the frontend to consume that API instead of reading from the .xlsx file.
3. Providing the **SQL Server schema** (CREATE TABLEs) matching the current data model.
4. Documenting how to run everything on‑premise.

This API will **not run in the Lovable preview** (the sandbox does not host persistent backends). It is intended to be deployed on the on‑premise server alongside SQL Server. In Lovable, the app will continue to use the .xlsx file as a fallback when the API is not reachable.

## What will be delivered

### 1. SQL Server schema (`server/sql/schema.sql`)
Tables matching `src/lib/types.ts`:
- `Contracts` (Id, ContractNumber UNIQUE, Description, Currency, CreatedAt)
- `Prices` (Id, ContractNumber FK, PartNumber, Supplier, DateFrom, DateTo, QuantityFrom, QuantityTo, UnitPrice, LotPrice, Currency, PreviousUnitPrice, PreviousLotPrice, PreviousDateFrom, PreviousDateTo, LastChangedAt, LastChangedBy)
- `ExchangeRates` (Currency PK, Rate, IsBase, UpdatedAt)
- `Users` (Username PK, PasswordHash, Name, Role)
- `AuditLog` (Id, At, [User], Action, Summary, AffectedIds JSON, Details JSON)

Indexes on `ContractNumber`, `PartNumber`, `Supplier`, `DateFrom`/`DateTo`.

### 2. Node.js API (`server/`)
- `server/package.json` — `express`, `mssql`, `cors`, `dotenv`, `bcryptjs`
- `server/.env.example` — `SQLSERVER_HOST`, `SQLSERVER_PORT=1433`, `SQLSERVER_DATABASE`, `SQLSERVER_USER`, `SQLSERVER_PASSWORD`, `SQLSERVER_ENCRYPT=false`, `SQLSERVER_TRUST_CERT=true`, `PORT=3001`
- `server/src/db.ts` — connection pool using `mssql` with Windows/SQL auth support
- `server/src/index.ts` — Express app with CORS
- REST routes mirroring current operations:
  - `GET/POST/PUT/DELETE /api/prices` + `POST /api/prices/bulk-update` + `POST /api/prices/:id/revert`
  - `GET/POST/PUT/DELETE /api/contracts`
  - `GET/PUT /api/rates`
  - `GET /api/audit`
  - `POST /api/auth/login`
- `server/README.md` — install, configure, run as Windows Service (using `node-windows` or `nssm`)

### 3. Frontend integration
- `src/lib/api.ts` — typed client (`fetch`) with base URL from `import.meta.env.VITE_API_URL`
- `src/contexts/DataContext.tsx` — refactored: on mount, try `VITE_API_URL`; if reachable, load from API and route all mutations through it; if not, fall back to the existing .xlsx loader (keeps Lovable preview working)
- `.env.example` at project root documenting `VITE_API_URL=http://localhost:3001`

### 4. Documentation (`DEPLOYMENT.md`)
- Prerequisites (SQL Server 2019+, Node.js 20+, IIS or `serve` for static files)
- Steps: run `schema.sql` → configure `server/.env` → `npm install && npm start` in `server/` → `npm run build` in root → host `dist/` behind IIS/nginx → set `VITE_API_URL` before build

## Technical details
- **Driver**: `mssql` (pure JS, supports SQL auth and Windows auth via `msnodesqlv8`).
- **Auth**: passwords hashed with `bcryptjs` on first migration; `/api/auth/login` returns user payload (no JWT yet — kept simple for on‑premise LAN use; can be added later).
- **Currency conversion**: stays client‑side (already implemented in `src/lib/format.ts`).
- **Audit log**: written server‑side on each mutation inside the same transaction.
- **CORS**: enabled for the static site origin.
- **No changes** to Tailwind, routing, or existing UI components.

## Out of scope (explicitly)
- Running the API inside Lovable (not possible — Lovable hosts only the static frontend).
- JWT/SSO/Active Directory integration (can be added in a follow‑up).
- Automated migration of existing .xlsx data into SQL Server (a small import script can be added if requested).

## File map
```text
server/
  package.json
  .env.example
  README.md
  sql/
    schema.sql
  src/
    db.ts
    index.ts
    routes/
      prices.ts
      contracts.ts
      rates.ts
      audit.ts
      auth.ts
src/
  lib/api.ts                 (new)
  contexts/DataContext.tsx   (modified — API with xlsx fallback)
.env.example                 (new — VITE_API_URL)
DEPLOYMENT.md                (new)
```
