const express = require("express");
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
      "SELECT username, name, role FROM users ORDER BY username",
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