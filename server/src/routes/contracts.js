const express = require("express");
const crypto = require("crypto");
const { query } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

function rowToContract(r) {
  return {
    id: r.id,
    contractNumber: r.contract_number,
    description: r.description,
    currency: r.currency,
    createdAt: r.created_at
      ? new Date(r.created_at.replace(" ", "T") + "Z").toISOString()
      : new Date().toISOString(),
  };
}

router.get("/", (_req, res, next) => {
  try {
    const { rows } = query("SELECT * FROM contracts ORDER BY contract_number");
    res.json(rows.map(rowToContract));
  } catch (e) {
    next(e);
  }
});

router.post("/", (req, res, next) => {
  try {
    const { contractNumber, description = "", currency = "USD" } = req.body || {};
    const id = crypto.randomUUID();
    query(
      `INSERT INTO contracts (id, contract_number, description, currency)
       VALUES (?, ?, ?, ?)`,
      [id, contractNumber, description, currency],
    );
    writeAudit({
      user: actorFromRequest(req),
      action: "contract.create",
      summary: `Created contract ${contractNumber} (${currency})`,
    });
    const { rows } = query("SELECT * FROM contracts WHERE id = ?", [id]);
    res.status(201).json(rowToContract(rows[0]));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const id = req.params.id;
    const patch = req.body || {};
    const { rows: before } = query("SELECT * FROM contracts WHERE id = ?", [id]);
    if (!before.length) return res.status(404).json({ error: "Not found" });
    const b = before[0];
    query(
      `UPDATE contracts SET
         contract_number = COALESCE(?, contract_number),
         description     = COALESCE(?, description),
         currency        = COALESCE(?, currency)
       WHERE id = ?`,
      [patch.contractNumber || null, patch.description ?? null, patch.currency || null, id],
    );
    // If the contract number changed, propagate to prices (no FK in SQLite layout).
    if (patch.contractNumber && patch.contractNumber !== b.contract_number) {
      query("UPDATE prices SET contract_number = ? WHERE contract_number = ?", [
        patch.contractNumber,
        b.contract_number,
      ]);
    }
    const { rows: out } = query("SELECT * FROM contracts WHERE id = ?", [id]);
    writeAudit({
      user: actorFromRequest(req),
      action: "contract.update",
      summary: `Updated contract ${out[0].contract_number}`,
      details: { patch },
    });
    res.json(rowToContract(out[0]));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const id = req.params.id;
    const { rows: before } = query("SELECT contract_number FROM contracts WHERE id = ?", [id]);
    query("DELETE FROM contracts WHERE id = ?", [id]);
    writeAudit({
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