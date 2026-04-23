# On-Premise Deployment

This app has two parts:

1. **Frontend** — a static React/Vite bundle (HTML + JS + CSS).
2. **Backend** — a Node.js REST API (`server/`) that talks to **SQL Server**.

The browser cannot connect to SQL Server directly, so the API is required for
persistence. In the Lovable preview the API is **not** running, so the app
falls back to the bundled `.xlsx` template — this is expected.

---

## Architecture

```
┌──────────────┐    HTTPS/HTTP    ┌──────────────────┐    TDS    ┌──────────────┐
│  Browser     │ ───────────────▶ │  Node.js API     │ ────────▶ │  SQL Server  │
│  (React)     │                  │  (server/)       │           │              │
└──────────────┘                  └──────────────────┘           └──────────────┘
      ▲                                   ▲
      │ served by IIS / nginx              │ runs as Windows service
      │ (static files)                     │ (NSSM or node-windows)
```

---

## Prerequisites

- **SQL Server 2019+** (Express edition is enough for most installs).
- **Node.js 20+** on the application server.
- **IIS**, **nginx**, or any static file server (or even `npx serve`) to host
  the built frontend.

---

## 1. Database

```bash
# In SSMS or sqlcmd
CREATE DATABASE PriceManagement;
GO

sqlcmd -S localhost -d PriceManagement -i server/sql/schema.sql
```

## 2. API

```bash
cd server
cp .env.example .env       # then edit with your SQL Server credentials
npm install
npm run migrate:hash-passwords   # seed initial users (edit the script first)
npm start                  # listens on http://localhost:3001
```

Test: `curl http://localhost:3001/api/health` → `{"status":"ok"}`.

See [`server/README.md`](server/README.md) for running it as a Windows service
with NSSM.

## 3. Frontend

```bash
# At the repo root
cp .env.example .env       # set VITE_API_URL=http://<api-host>:3001
npm install
npm run build              # outputs dist/
```

Copy the contents of `dist/` to your web server (IIS, nginx, Apache).
`VITE_API_URL` is **baked in at build time** — change it and rebuild if the
API host or port changes.

### Quick test with `serve`

```bash
npx serve dist -l 8080
```

Then open `http://localhost:8080`. The app should connect to the API at
`VITE_API_URL` automatically. If the API is unreachable, the app falls back
to the in-memory / .xlsx loader and prints a warning in the browser console.

---

## Environment variables

### Frontend (`.env` at repo root)

| Variable        | Required | Description                                |
| --------------- | -------- | ------------------------------------------ |
| `VITE_API_URL`  | yes      | Base URL of the API, e.g. `http://api:3001` |

### Backend (`server/.env`)

| Variable               | Required | Default       | Description                       |
| ---------------------- | -------- | ------------- | --------------------------------- |
| `SQLSERVER_HOST`       | yes      | `localhost`   | SQL Server hostname               |
| `SQLSERVER_PORT`       | no       | `1433`        | SQL Server port                   |
| `SQLSERVER_DATABASE`   | yes      | `PriceManagement` | Database name                 |
| `SQLSERVER_USER`       | yes      | —             | SQL login                         |
| `SQLSERVER_PASSWORD`   | yes      | —             | SQL password                      |
| `SQLSERVER_ENCRYPT`    | no       | `false`       | `true` for Azure SQL              |
| `SQLSERVER_TRUST_CERT` | no       | `true`        | Trust self-signed certificates    |
| `PORT`                 | no       | `3001`        | API port                          |
| `CORS_ORIGIN`          | no       | `*`           | Allowed origins (comma-separated) |

---

## Security checklist

- [ ] Use a dedicated SQL login with only the needed permissions on the
      `PriceManagement` database (DML on the app tables, no `sysadmin`).
- [ ] Restrict `CORS_ORIGIN` to the actual frontend host(s).
- [ ] Put the API behind HTTPS (IIS reverse proxy or nginx) on real networks.
- [ ] Replace the seed users in `scripts/hash-passwords.js` with real
      credentials before going live. Passwords are stored as bcrypt hashes.
- [ ] Back up the `PriceManagement` database regularly.

---

## How the fallback works (Lovable preview)

When `VITE_API_URL` is empty **or** the `/api/health` check fails, the app
keeps using the original in-memory data layer that loads
`public/templates/prices_template.xlsx`. This means:

- The Lovable preview keeps working out of the box.
- Any deployment that omits `VITE_API_URL` behaves like a demo with no
  persistence. Set `VITE_API_URL` to enable the SQL Server backend.