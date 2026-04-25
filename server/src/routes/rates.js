const express = require("express");
const { query, transaction } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

router.get("/", (_req, res, next) => {
  try {
    const { rows } = query("SELECT * FROM exchange_rates");
    const rates = { USD: 0, EUR: 0, GBP: 1, BRL: 0 };
    let base = "GBP";
    let updatedAt = new Date().toISOString();
    for (const r of rows) {
      rates[r.currency] = Number(r.rate);
      if (r.is_base) base = r.currency;
      if (r.updated_at) updatedAt = new Date(r.updated_at.replace(" ", "T") + "Z").toISOString();
    }
    // The product rule is that GBP is always the base currency.
    base = "GBP";
    res.json({ base, rates, updatedAt });
  } catch (e) {
    next(e);
  }
});

router.put("/", (req, res, next) => {
  try {
    const { rates } = req.body || {};
    if (!rates) return res.status(400).json({ error: "rates required" });
    // Base currency is fixed to GBP regardless of what the client sent.
    const base = "GBP";
    transaction(() => {
      query("UPDATE exchange_rates SET is_base = 0");
      for (const code of Object.keys(rates)) {
        query(
          `INSERT INTO exchange_rates (currency, rate, is_base, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(currency) DO UPDATE SET
             rate = excluded.rate,
             is_base = excluded.is_base,
             updated_at = datetime('now')`,
          [code, Number(rates[code]) || 0, code === base ? 1 : 0],
        );
      }
    });
    writeAudit({
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