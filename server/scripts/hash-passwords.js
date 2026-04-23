/**
 * One-off helper to seed the `users` table with bcrypt-hashed passwords.
 *
 * Usage:
 *   node scripts/hash-passwords.js
 *
 * Edit the USERS array below before running. Existing usernames are upserted.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool, query } = require("../src/db");

const USERS = [
  { username: "admin", password: "admin", name: "Administrator", role: "admin" },
  { username: "user",  password: "user",  name: "Standard User", role: "user"  },
];

(async () => {
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await query(
      `INSERT INTO users (username, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         name = EXCLUDED.name,
         role = EXCLUDED.role`,
      [u.username, hash, u.name, u.role],
    );
    console.log(`Seeded user: ${u.username} (${u.role})`);
  }
  await pool.end();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});