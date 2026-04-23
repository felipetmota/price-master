/**
 * One-off helper to seed the Users table with bcrypt-hashed passwords.
 *
 * Usage:
 *   node scripts/hash-passwords.js
 *
 * Edit the USERS array below before running. Existing usernames are upserted.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sql, getPool } = require("../src/db");

const USERS = [
  { username: "admin", password: "admin", name: "Administrator", role: "admin" },
  { username: "user",  password: "user",  name: "Standard User", role: "user"  },
];

(async () => {
  const pool = await getPool();
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool
      .request()
      .input("username", sql.NVarChar(128), u.username)
      .input("hash", sql.NVarChar(256), hash)
      .input("name", sql.NVarChar(256), u.name)
      .input("role", sql.NVarChar(32), u.role)
      .query(`
        MERGE dbo.Users AS t
        USING (SELECT @username AS Username) AS s
          ON t.Username = s.Username
        WHEN MATCHED THEN UPDATE SET PasswordHash = @hash, Name = @name, Role = @role
        WHEN NOT MATCHED THEN INSERT (Username, PasswordHash, Name, Role)
          VALUES (@username, @hash, @name, @role);`);
    console.log(`Seeded user: ${u.username} (${u.role})`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});