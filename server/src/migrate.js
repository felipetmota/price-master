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
  console.log("[migrate] Schema ensured");
}

module.exports = { ensureSchema };