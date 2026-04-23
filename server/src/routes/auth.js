const express = require("express");
const bcrypt = require("bcryptjs");
const { sql, getPool } = require("../db");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("u", sql.NVarChar(128), username.trim())
      .query("SELECT Username, PasswordHash, Name, Role FROM dbo.Users WHERE Username = @u");
    const row = result.recordset[0];
    if (!row) return res.status(401).json({ error: "Invalid username or password." });
    const ok = await bcrypt.compare(password, row.PasswordHash);
    if (!ok) return res.status(401).json({ error: "Invalid username or password." });
    res.json({
      username: row.Username,
      name: row.Name,
      role: row.Role,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;