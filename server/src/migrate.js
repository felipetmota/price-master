/**
 * Boot-time migration: applies schema.sql idempotently.
 * All CREATE statements use `IF NOT EXISTS`, so it is safe to run on
 * every API start.
 */
const fs = require("fs");
const path = require("path");
const { db } = require("./db");

function ensureSchema() {
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  // better-sqlite3 supports running multi-statement scripts via exec().
  db.exec(sql);

  // ---- Additive column migrations (idempotent) -----------------------
  // SQLite doesn't support `ADD COLUMN IF NOT EXISTS`, so we inspect
  // pragma_table_info and conditionally ALTER.
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes("email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''");
    console.log("[migrate] Added users.email column");
  }
  console.log("[migrate] Schema ensured");
}

module.exports = { ensureSchema };