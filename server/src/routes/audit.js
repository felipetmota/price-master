const express = require("express");
const { query } = require("../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 5000);
    const { rows } = await query(
      "SELECT * FROM audit_log ORDER BY at DESC LIMIT $1",
      [limit],
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        at: r.at.toISOString(),
        user: r.user,
        action: r.action,
        summary: r.summary,
        affectedIds: r.affected_ids ?? undefined,
        details: r.details ?? undefined,
      })),
    );
  } catch (e) {
    next(e);
  }
});

module.exports = router;