/**
 * Boot-time migration: ensures tables exist by running schema.sql if the
 * `contracts` table is missing. Safe to call on every API start.
 */
const fs = require("fs");
const path = require("path");
const { pool, query } = require("./db");

async function ensureSchema() {
  const { rows } = await query(
    "SELECT to_regclass('public.contracts') AS exists",
  );
  if (rows[0]?.exists) return false;
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  console.log("[migrate] First run — applying schema.sql");
  // pg can run multi-statement scripts in a single query() call.
  await pool.query(sql);
  console.log("[migrate] Schema applied");
  return true;
}

module.exports = { ensureSchema };