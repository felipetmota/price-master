const express = require("express");
const { sql, getPool } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

function rowToPrice(r) {
  return {
    id: r.Id,
    contractNumber: r.ContractNumber,
    partNumber: r.PartNumber,
    supplier: r.Supplier,
    dateFrom: r.DateFrom ? r.DateFrom.toISOString().slice(0, 10) : "",
    dateTo: r.DateTo ? r.DateTo.toISOString().slice(0, 10) : "",
    quantityFrom: r.QuantityFrom,
    quantityTo: r.QuantityTo,
    unitPrice: r.UnitPrice !== null ? Number(r.UnitPrice) : null,
    lotPrice: r.LotPrice !== null ? Number(r.LotPrice) : null,
    currency: r.Currency,
    previousUnitPrice:
      r.PreviousUnitPrice !== null ? Number(r.PreviousUnitPrice) : undefined,
    previousLotPrice:
      r.PreviousLotPrice !== null ? Number(r.PreviousLotPrice) : undefined,
    previousDateFrom: r.PreviousDateFrom
      ? r.PreviousDateFrom.toISOString().slice(0, 10)
      : undefined,
    previousDateTo: r.PreviousDateTo
      ? r.PreviousDateTo.toISOString().slice(0, 10)
      : undefined,
    lastChangedAt: r.LastChangedAt ? r.LastChangedAt.toISOString() : undefined,
    lastChangedBy: r.LastChangedBy || undefined,
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM dbo.Prices");
    res.json(result.recordset.map(rowToPrice));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const source = req.query.source === "import" ? "import" : "manual";
    const pool = await getPool();
    const inserted = [];
    for (const r of rows) {
      const result = await pool
        .request()
        .input("contractNumber", sql.NVarChar(64), r.contractNumber)
        .input("partNumber", sql.NVarChar(128), r.partNumber)
        .input("supplier", sql.NVarChar(256), r.supplier || "")
        .input("dateFrom", sql.Date, r.dateFrom || null)
        .input("dateTo", sql.Date, r.dateTo || null)
        .input("quantityFrom", sql.Int, r.quantityFrom ?? 1)
        .input("quantityTo", sql.Int, r.quantityTo ?? 9999999)
        .input("unitPrice", sql.Decimal(18, 6), r.unitPrice)
        .input("lotPrice", sql.Decimal(18, 6), r.lotPrice)
        .input("currency", sql.Char(3), r.currency || "USD")
        .query(
          `INSERT INTO dbo.Prices
            (ContractNumber, PartNumber, Supplier, DateFrom, DateTo,
             QuantityFrom, QuantityTo, UnitPrice, LotPrice, Currency)
           OUTPUT INSERTED.*
           VALUES
            (@contractNumber, @partNumber, @supplier, @dateFrom, @dateTo,
             @quantityFrom, @quantityTo, @unitPrice, @lotPrice, @currency)`,
        );
      inserted.push(rowToPrice(result.recordset[0]));
    }
    await writeAudit({
      user: actorFromRequest(req),
      action: source === "import" ? "price.import" : "price.create",
      summary:
        source === "import"
          ? `Imported ${inserted.length} record(s) from spreadsheet`
          : `Created ${inserted.length} record(s)`,
      affectedIds: inserted.map((x) => x.id),
    });
    res.status(201).json(inserted);
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const patch = req.body || {};
    const pool = await getPool();

    const existing = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("SELECT * FROM dbo.Prices WHERE Id = @id");
    if (!existing.recordset.length) return res.status(404).json({ error: "Not found" });
    const cur = existing.recordset[0];

    const next$ = {
      ContractNumber: patch.contractNumber ?? cur.ContractNumber,
      PartNumber: patch.partNumber ?? cur.PartNumber,
      Supplier: patch.supplier ?? cur.Supplier,
      DateFrom: patch.dateFrom ?? cur.DateFrom,
      DateTo: patch.dateTo ?? cur.DateTo,
      QuantityFrom: patch.quantityFrom ?? cur.QuantityFrom,
      QuantityTo: patch.quantityTo ?? cur.QuantityTo,
      UnitPrice: patch.unitPrice !== undefined ? patch.unitPrice : cur.UnitPrice,
      LotPrice: patch.lotPrice !== undefined ? patch.lotPrice : cur.LotPrice,
      Currency: patch.currency ?? cur.Currency,
    };

    const actor = actorFromRequest(req);
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("contractNumber", sql.NVarChar(64), next$.ContractNumber)
      .input("partNumber", sql.NVarChar(128), next$.PartNumber)
      .input("supplier", sql.NVarChar(256), next$.Supplier)
      .input("dateFrom", sql.Date, next$.DateFrom)
      .input("dateTo", sql.Date, next$.DateTo)
      .input("quantityFrom", sql.Int, next$.QuantityFrom)
      .input("quantityTo", sql.Int, next$.QuantityTo)
      .input("unitPrice", sql.Decimal(18, 6), next$.UnitPrice)
      .input("lotPrice", sql.Decimal(18, 6), next$.LotPrice)
      .input("currency", sql.Char(3), next$.Currency)
      .input("prevUnit", sql.Decimal(18, 6), cur.UnitPrice)
      .input("prevLot", sql.Decimal(18, 6), cur.LotPrice)
      .input("prevFrom", sql.Date, cur.DateFrom)
      .input("prevTo", sql.Date, cur.DateTo)
      .input("actor", sql.NVarChar(128), actor)
      .query(`
        UPDATE dbo.Prices SET
          ContractNumber = @contractNumber,
          PartNumber = @partNumber,
          Supplier = @supplier,
          DateFrom = @dateFrom,
          DateTo = @dateTo,
          QuantityFrom = @quantityFrom,
          QuantityTo = @quantityTo,
          UnitPrice = @unitPrice,
          LotPrice = @lotPrice,
          Currency = @currency,
          PreviousUnitPrice = @prevUnit,
          PreviousLotPrice = @prevLot,
          PreviousDateFrom = @prevFrom,
          PreviousDateTo = @prevTo,
          LastChangedAt = SYSUTCDATETIME(),
          LastChangedBy = @actor
        OUTPUT INSERTED.*
        WHERE Id = @id`);

    await writeAudit({
      user: actor,
      action: "price.update",
      summary: `Updated record ${id}`,
      affectedIds: [id],
      details: { patch },
    });
    res.json(rowToPrice(result.recordset[0]));
  } catch (e) {
    next(e);
  }
});

router.delete("/", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.json({ deleted: 0 });
    const pool = await getPool();
    const request = pool.request();
    const params = ids.map((id, i) => {
      request.input(`id${i}`, sql.UniqueIdentifier, id);
      return `@id${i}`;
    });
    await request.query(`DELETE FROM dbo.Prices WHERE Id IN (${params.join(",")})`);
    await writeAudit({
      user: actorFromRequest(req),
      action: "price.delete",
      summary: `Deleted ${ids.length} record(s)`,
      affectedIds: ids,
    });
    res.json({ deleted: ids.length });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/revert", async (req, res, next) => {
  try {
    const id = req.params.id;
    const pool = await getPool();
    const actor = actorFromRequest(req);
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("actor", sql.NVarChar(128), actor)
      .query(`
        UPDATE dbo.Prices SET
          UnitPrice = COALESCE(PreviousUnitPrice, UnitPrice),
          LotPrice  = COALESCE(PreviousLotPrice,  LotPrice),
          DateFrom  = COALESCE(PreviousDateFrom,  DateFrom),
          DateTo    = COALESCE(PreviousDateTo,    DateTo),
          PreviousUnitPrice = NULL,
          PreviousLotPrice  = NULL,
          PreviousDateFrom  = NULL,
          PreviousDateTo    = NULL,
          LastChangedAt = SYSUTCDATETIME(),
          LastChangedBy = @actor
        OUTPUT INSERTED.*
        WHERE Id = @id
          AND (PreviousUnitPrice IS NOT NULL
            OR PreviousLotPrice  IS NOT NULL
            OR PreviousDateFrom  IS NOT NULL
            OR PreviousDateTo    IS NOT NULL)`);
    if (!result.recordset.length) return res.status(409).json({ error: "Nothing to revert" });
    await writeAudit({
      user: actor,
      action: "price.revert",
      summary: `Reverted record ${id} to previous values`,
      affectedIds: [id],
    });
    res.json(rowToPrice(result.recordset[0]));
  } catch (e) {
    next(e);
  }
});

/**
 * Bulk update — applies a patch to all rows matching simple equality filters.
 * Body: { match: { contractNumber?, partNumber?, supplier? }, patch: { unitPrice?, lotPrice?, dateFrom?, dateTo? }, summary: string }
 */
router.post("/bulk-update", async (req, res, next) => {
  try {
    const { match = {}, patch = {}, summary = "Bulk update" } = req.body || {};
    const pool = await getPool();
    const actor = actorFromRequest(req);

    const where = ["1=1"];
    const request = pool.request().input("actor", sql.NVarChar(128), actor);
    if (match.contractNumber) {
      request.input("mc", sql.NVarChar(64), match.contractNumber);
      where.push("ContractNumber = @mc");
    }
    if (match.partNumber) {
      request.input("mp", sql.NVarChar(128), match.partNumber);
      where.push("PartNumber = @mp");
    }
    if (match.supplier) {
      request.input("ms", sql.NVarChar(256), match.supplier);
      where.push("Supplier = @ms");
    }

    const sets = [
      "PreviousUnitPrice = UnitPrice",
      "PreviousLotPrice = LotPrice",
      "PreviousDateFrom = DateFrom",
      "PreviousDateTo = DateTo",
      "LastChangedAt = SYSUTCDATETIME()",
      "LastChangedBy = @actor",
    ];
    if (patch.unitPrice !== undefined) {
      request.input("pUnit", sql.Decimal(18, 6), patch.unitPrice);
      sets.push("UnitPrice = @pUnit");
    }
    if (patch.lotPrice !== undefined) {
      request.input("pLot", sql.Decimal(18, 6), patch.lotPrice);
      sets.push("LotPrice = @pLot");
    }
    if (patch.dateFrom !== undefined) {
      request.input("pFrom", sql.Date, patch.dateFrom);
      sets.push("DateFrom = @pFrom");
    }
    if (patch.dateTo !== undefined) {
      request.input("pTo", sql.Date, patch.dateTo);
      sets.push("DateTo = @pTo");
    }

    const result = await request.query(
      `UPDATE dbo.Prices SET ${sets.join(", ")}
       OUTPUT INSERTED.Id
       WHERE ${where.join(" AND ")}`,
    );
    const affectedIds = result.recordset.map((r) => r.Id);
    if (affectedIds.length) {
      await writeAudit({
        user: actor,
        action: "price.bulk_update",
        summary: `${summary} · ${affectedIds.length} record(s)`,
        affectedIds,
        details: { match, patch },
      });
    }
    res.json({ updated: affectedIds.length, ids: affectedIds });
  } catch (e) {
    next(e);
  }
});

module.exports = router;