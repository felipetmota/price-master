const express = require("express");
const { sql, getPool } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

function rowToContract(r) {
  return {
    id: r.Id,
    contractNumber: r.ContractNumber,
    description: r.Description,
    currency: r.Currency,
    createdAt: r.CreatedAt ? r.CreatedAt.toISOString() : new Date().toISOString(),
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM dbo.Contracts ORDER BY ContractNumber");
    res.json(result.recordset.map(rowToContract));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { contractNumber, description = "", currency = "USD" } = req.body || {};
    const pool = await getPool();
    const result = await pool
      .request()
      .input("contractNumber", sql.NVarChar(64), contractNumber)
      .input("description", sql.NVarChar(500), description)
      .input("currency", sql.Char(3), currency)
      .query(
        `INSERT INTO dbo.Contracts (ContractNumber, Description, Currency)
         OUTPUT INSERTED.*
         VALUES (@contractNumber, @description, @currency)`,
      );
    await writeAudit({
      user: actorFromRequest(req),
      action: "contract.create",
      summary: `Created contract ${contractNumber} (${currency})`,
    });
    res.status(201).json(rowToContract(result.recordset[0]));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const patch = req.body || {};
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("contractNumber", sql.NVarChar(64), patch.contractNumber || null)
      .input("description", sql.NVarChar(500), patch.description ?? null)
      .input("currency", sql.Char(3), patch.currency || null)
      .query(`
        UPDATE dbo.Contracts SET
          ContractNumber = COALESCE(@contractNumber, ContractNumber),
          Description    = COALESCE(@description,    Description),
          Currency       = COALESCE(@currency,       Currency)
        OUTPUT INSERTED.*
        WHERE Id = @id`);
    if (!result.recordset.length) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      user: actorFromRequest(req),
      action: "contract.update",
      summary: `Updated contract ${result.recordset[0].ContractNumber}`,
      details: { patch },
    });
    res.json(rowToContract(result.recordset[0]));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const pool = await getPool();
    const before = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("SELECT ContractNumber FROM dbo.Contracts WHERE Id = @id");
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("DELETE FROM dbo.Contracts WHERE Id = @id");
    await writeAudit({
      user: actorFromRequest(req),
      action: "contract.delete",
      summary: `Deleted contract ${before.recordset[0]?.ContractNumber ?? id}`,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;