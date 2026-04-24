const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

/**
 * Resolve the SQLite database file path.
 * - SQLITE_PATH env var if set
 * - otherwise ./data/prices.db relative to the server root
 */
const dbPath = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.resolve(__dirname, "..", "data", "prices.db");

// Make sure the directory exists before opening the db file.
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Recommended pragmas for a server-side workload.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

console.log(`[db] SQLite opened at ${dbPath}`);

/**
 * Run a parameterized query.
 * Returns { rows } for SELECT-style statements, { changes, lastInsertRowid } for writes.
 * Mimics a tiny subset of node-postgres so existing routes keep their shape.
 *
 * Usage:
 *   const { rows } = query("SELECT * FROM prices WHERE id = ?", [id]);
 *   const { rows } = query("INSERT ... RETURNING *", [...]);
 */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  // Detect whether the statement returns rows. better-sqlite3 exposes
  // `stmt.reader` as true for any SELECT or RETURNING statement.
  if (stmt.reader) {
    return { rows: stmt.all(...params) };
  }
  const info = stmt.run(...params);
  return { rows: [], changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

/**
 * Wrap a function in a synchronous transaction.
 * Usage: transaction(() => { query(...); query(...); });
 */
function transaction(fn) {
  return db.transaction(fn)();
}

module.exports = { db, query, transaction, dbPath };