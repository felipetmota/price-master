const express = require("express");
const { query } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

function rowToContract(r) {
  return {
    id: r.id,
    contractNumber: r.contract_number,
    description: r.description,
    currency: r.currency,
    createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM contracts ORDER BY contract_number");
    res.json(rows.map(rowToContract));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { contractNumber, description = "", currency = "USD" } = req.body || {};
    const { rows } = await query(
      `INSERT INTO contracts (contract_number, description, currency)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [contractNumber, description, currency],
    );
    await writeAudit({
      user: actorFromRequest(req),
      action: "contract.create",
      summary: `Created contract ${contractNumber} (${currency})`,
    });
    res.status(201).json(rowToContract(rows[0]));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const patch = req.body || {};
    const { rows } = await query(
      `UPDATE contracts SET
         contract_number = COALESCE($1, contract_number),
         description     = COALESCE($2, description),
         currency        = COALESCE($3, currency)
       WHERE id = $4
       RETURNING *`,
      [patch.contractNumber || null, patch.description ?? null, patch.currency || null, id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      user: actorFromRequest(req),
      action: "contract.update",
      summary: `Updated contract ${rows[0].contract_number}`,
      details: { patch },
    });
    res.json(rowToContract(rows[0]));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const { rows: before } = await query("SELECT contract_number FROM contracts WHERE id = $1", [id]);
    await query("DELETE FROM contracts WHERE id = $1", [id]);
    await writeAudit({
      user: actorFromRequest(req),
      action: "contract.delete",
      summary: `Deleted contract ${before[0]?.contract_number ?? id}`,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;