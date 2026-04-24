const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }
    const { rows } = query(
      "SELECT username, password_hash, name, role FROM users WHERE username = ?",
      [username.trim()],
    );
    const row = rows[0];
    if (!row) return res.status(401).json({ error: "Invalid username or password." });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid username or password." });

    const { rows: grants } = query(
      "SELECT system_key FROM user_systems WHERE username = ?",
      [row.username],
    );
    res.json({
      username: row.username,
      name: row.name,
      role: row.role,
      systems: grants.map((g) => g.system_key),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;