const { Pool } = require("pg");

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: String(process.env.PGSSL || "false") === "true" ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || "price_management",
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: String(process.env.PGSSL || "false") === "true" ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool({ ...config, max: 20, idleTimeoutMillis: 30000 });

pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

/**
 * Run a parameterized query.
 * Usage: query("SELECT * FROM prices WHERE id = $1", [id])
 */
function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };