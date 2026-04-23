const express = require("express");
const { pool, query } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM exchange_rates");
    const rates = { USD: 1, EUR: 0, GBP: 0, BRL: 0 };
    let base = "USD";
    let updatedAt = new Date().toISOString();
    for (const r of rows) {
      rates[r.currency] = Number(r.rate);
      if (r.is_base) base = r.currency;
      if (r.updated_at) updatedAt = r.updated_at.toISOString();
    }
    res.json({ base, rates, updatedAt });
  } catch (e) {
    next(e);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const { base, rates } = req.body || {};
    if (!base || !rates) return res.status(400).json({ error: "base and rates required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE exchange_rates SET is_base = FALSE");
      for (const code of Object.keys(rates)) {
        await client.query(
          `INSERT INTO exchange_rates (currency, rate, is_base, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (currency) DO UPDATE SET
             rate = EXCLUDED.rate,
             is_base = EXCLUDED.is_base,
             updated_at = NOW()`,
          [code, Number(rates[code]) || 0, code === base],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    await writeAudit({
      user: actorFromRequest(req),
      action: "rates.update",
      summary: `Updated exchange rates (base ${base})`,
      details: { rates },
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;