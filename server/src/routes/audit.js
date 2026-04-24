const express = require("express");
const { query } = require("../db");

const router = express.Router();

router.get("/", (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 5000);
    const { rows } = query(
      "SELECT * FROM audit_log ORDER BY at DESC LIMIT ?",
      [limit],
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        at: r.at ? new Date(r.at.replace(" ", "T") + "Z").toISOString() : new Date().toISOString(),
        user: r.user,
        action: r.action,
        summary: r.summary,
        affectedIds: r.affected_ids ? safeJson(r.affected_ids) : undefined,
        details: r.details ? safeJson(r.details) : undefined,
      })),
    );
  } catch (e) {
    next(e);
  }
});

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

module.exports = router;