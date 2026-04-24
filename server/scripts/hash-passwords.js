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
const crypto = require("crypto");
const { query } = require("../src/db");
const { ensureSchema } = require("../src/migrate");

const USERS = [
  { username: "admin", password: "admin", name: "Administrator", email: "admin@example.com", role: "admin", systems: [] },
  { username: "user",  password: "user",  name: "Standard User", email: "user@example.com",  role: "user",  systems: ["price-management"] },
];

(async () => {
  ensureSchema();
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    query(
      `INSERT INTO users (username, password_hash, name, email, role)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET
         password_hash = excluded.password_hash,
         name = excluded.name,
         email = excluded.email,
         role = excluded.role`,
      [u.username, hash, u.name, u.email, u.role],
    );
    // Reset and rewrite the user's system grants (admin role implies all).
    query("DELETE FROM user_systems WHERE username = ?", [u.username]);
    for (const key of u.systems) {
      query(
        "INSERT OR IGNORE INTO user_systems (username, system_key) VALUES (?, ?)",
        [u.username, key],
      );
    }
    console.log(`Seeded user: ${u.username} (${u.role})`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});