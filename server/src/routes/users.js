const express = require("express");
const bcrypt = require("bcryptjs");
const { query, transaction } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

/**
 * GET /api/users
 * Returns all users with their granted system keys. Passwords are never sent.
 */
router.get("/", (_req, res, next) => {
  try {
    const { rows: users } = query(
      "SELECT username, email, name, role FROM users ORDER BY username",
    );
    const { rows: grants } = query("SELECT username, system_key FROM user_systems");
    const grantMap = new Map();
    for (const g of grants) {
      const arr = grantMap.get(g.username) || [];
      arr.push(g.system_key);
      grantMap.set(g.username, arr);
    }
    res.json(
      users.map((u) => ({
        username: u.username,
        email: u.email || "",
        name: u.name,
        role: u.role,
        systems: grantMap.get(u.username) || [],
      })),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/users
 * Body: { username, password, name, email, role, systems? }
 * Creates a new user. Username must be unique.
 */
router.post("/", async (req, res, next) => {
  try {
    const { username, password, name, email, role, systems } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }
    const existing = query("SELECT username FROM users WHERE username = ?", [username.trim()]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: "Username already exists." });
    }
    const hash = await bcrypt.hash(password, 10);
    const grants = Array.isArray(systems) ? systems : [];
    transaction(() => {
      query(
        `INSERT INTO users (username, password_hash, name, email, role)
         VALUES (?, ?, ?, ?, ?)`,
        [username.trim(), hash, name || "", email || "", role || "user"],
      );
      for (const key of grants) {
        query(
          "INSERT OR IGNORE INTO user_systems (username, system_key) VALUES (?, ?)",
          [username.trim(), key],
        );
      }
    });
    writeAudit({
      user: actorFromRequest(req),
      action: "user.create",
      summary: `Created user ${username}`,
      details: { username, name, email, role, systems: grants },
    });
    res.status(201).json({
      username: username.trim(),
      name: name || "",
      email: email || "",
      role: role || "user",
      systems: grants,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/users/:username
 * Body: { name?, email?, role? }
 * Updates the user's profile (not the password — use /reset-password).
 */
router.put("/:username", (req, res, next) => {
  try {
    const username = req.params.username;
    const { name, email, role } = req.body || {};
    const fields = [];
    const params = [];
    if (typeof name === "string") { fields.push("name = ?"); params.push(name); }
    if (typeof email === "string") { fields.push("email = ?"); params.push(email); }
    if (typeof role === "string") { fields.push("role = ?"); params.push(role); }
    if (fields.length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }
    params.push(username);
    const result = query(`UPDATE users SET ${fields.join(", ")} WHERE username = ?`, params);
    if (!result.changes) return res.status(404).json({ error: "User not found." });
    writeAudit({
      user: actorFromRequest(req),
      action: "user.update",
      summary: `Updated user ${username}`,
      details: { name, email, role },
    });
    res.json({ ok: true, username });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/users/:username/reset-password
 * Body: { password }
 * Replaces the user's password hash. No email/SMS — admin sets it directly.
 */
router.post("/:username/reset-password", async (req, res, next) => {
  try {
    const username = req.params.username;
    const { password } = req.body || {};
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters." });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = query("UPDATE users SET password_hash = ? WHERE username = ?", [hash, username]);
    if (!result.changes) return res.status(404).json({ error: "User not found." });
    writeAudit({
      user: actorFromRequest(req),
      action: "user.reset_password",
      summary: `Reset password for ${username}`,
    });
    res.json({ ok: true, username });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/users/:username
 * Removes the user. Cannot delete the last admin.
 */
router.delete("/:username", (req, res, next) => {
  try {
    const username = req.params.username;
    const target = query("SELECT role FROM users WHERE username = ?", [username]).rows[0];
    if (!target) return res.status(404).json({ error: "User not found." });
    if ((target.role || "").toLowerCase() === "admin") {
      const { rows } = query(
        "SELECT COUNT(*) as n FROM users WHERE lower(role) = 'admin'",
      );
      if ((rows[0]?.n ?? 0) <= 1) {
        return res.status(400).json({ error: "Cannot delete the last admin." });
      }
    }
    transaction(() => {
      query("DELETE FROM user_systems WHERE username = ?", [username]);
      query("DELETE FROM users WHERE username = ?", [username]);
    });
    writeAudit({
      user: actorFromRequest(req),
      action: "user.delete",
      summary: `Deleted user ${username}`,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /api/users/:username/systems
 * Body: { systems: string[] }
 * Replaces the user's grants with the provided list.
 */
router.put("/:username/systems", (req, res, next) => {
  try {
    const username = req.params.username;
    const systems = Array.isArray(req.body?.systems) ? req.body.systems : [];
    transaction(() => {
      query("DELETE FROM user_systems WHERE username = ?", [username]);
      for (const key of systems) {
        query(
          "INSERT OR IGNORE INTO user_systems (username, system_key) VALUES (?, ?)",
          [username, key],
        );
      }
    });
    writeAudit({
      user: actorFromRequest(req),
      action: "user.systems_update",
      summary: `Updated system grants for ${username}`,
      details: { systems },
    });
    res.json({ ok: true, username, systems });
  } catch (e) {
    next(e);
  }
});

module.exports = router;