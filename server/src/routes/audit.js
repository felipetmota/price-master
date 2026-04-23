const express = require("express");
const { getPool } = require("../db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 5000);
    const pool = await getPool();
    const result = await pool
      .request()
      .query(`SELECT TOP (${limit}) * FROM dbo.AuditLog ORDER BY [At] DESC`);
    res.json(
      result.recordset.map((r) => ({
        id: r.Id,
        at: r.At.toISOString(),
        user: r.User,
        action: r.Action,
        summary: r.Summary,
        affectedIds: r.AffectedIds ? JSON.parse(r.AffectedIds) : undefined,
        details: r.Details ? JSON.parse(r.Details) : undefined,
      })),
    );
  } catch (e) {
    next(e);
  }
});

module.exports = router;