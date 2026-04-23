const express = require("express");
const { sql, getPool } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

router.get("/", async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM dbo.ExchangeRates");
    const rates = { USD: 1, EUR: 0, GBP: 0, BRL: 0 };
    let base = "USD";
    let updatedAt = new Date().toISOString();
    for (const r of result.recordset) {
      rates[r.Currency] = Number(r.Rate);
      if (r.IsBase) base = r.Currency;
      if (r.UpdatedAt) updatedAt = r.UpdatedAt.toISOString();
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
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).query("UPDATE dbo.ExchangeRates SET IsBase = 0");
      for (const code of Object.keys(rates)) {
        await new sql.Request(tx)
          .input("c", sql.Char(3), code)
          .input("r", sql.Decimal(18, 8), Number(rates[code]) || 0)
          .input("b", sql.Bit, code === base ? 1 : 0)
          .query(`
            MERGE dbo.ExchangeRates AS t
            USING (SELECT @c AS Currency) AS s
              ON t.Currency = s.Currency
            WHEN MATCHED THEN UPDATE SET Rate = @r, IsBase = @b, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (Currency, Rate, IsBase) VALUES (@c, @r, @b);`);
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
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