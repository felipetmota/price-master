const express = require("express");
const crypto = require("crypto");
const { query, transaction } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

function rowToPrice(r) {
  return {
    id: r.id,
    contractNumber: r.contract_number,
    partNumber: r.part_number,
    supplier: r.supplier,
    dateFrom: r.date_from || "",
    dateTo: r.date_to || "",
    quantityFrom: r.quantity_from,
    quantityTo: r.quantity_to,
    unitPrice: r.unit_price !== null && r.unit_price !== undefined ? Number(r.unit_price) : null,
    lotPrice: r.lot_price !== null && r.lot_price !== undefined ? Number(r.lot_price) : null,
    currency: r.currency,
    previousUnitPrice:
      r.previous_unit_price !== null && r.previous_unit_price !== undefined
        ? Number(r.previous_unit_price)
        : undefined,
    previousLotPrice:
      r.previous_lot_price !== null && r.previous_lot_price !== undefined
        ? Number(r.previous_lot_price)
        : undefined,
    previousDateFrom: r.previous_date_from || undefined,
    previousDateTo: r.previous_date_to || undefined,
    lastChangedAt: r.last_changed_at
      ? new Date(r.last_changed_at.replace(" ", "T") + "Z").toISOString()
      : undefined,
    lastChangedBy: r.last_changed_by || undefined,
  };
}

router.get("/", (_req, res, next) => {
  try {
    const { rows } = query("SELECT * FROM prices");
    res.json(rows.map(rowToPrice));
  } catch (e) {
    next(e);
  }
});

router.post("/", (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const source = req.query.source === "import" ? "import" : "manual";
    const inserted = [];
    transaction(() => {
      for (const r of rows) {
        const id = crypto.randomUUID();
        query(
          `INSERT INTO prices
             (id, contract_number, part_number, supplier, date_from, date_to,
              quantity_from, quantity_to, unit_price, lot_price, currency)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            id,
            r.contractNumber,
            r.partNumber,
            r.supplier || "",
            r.dateFrom || null,
            r.dateTo || null,
            r.quantityFrom ?? 1,
            r.quantityTo ?? 9999999,
            r.unitPrice,
            r.lotPrice,
            r.currency || "USD",
          ],
        );
        const { rows: out } = query("SELECT * FROM prices WHERE id = ?", [id]);
        inserted.push(rowToPrice(out[0]));
      }
    });
    writeAudit({
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

router.put("/:id", (req, res, next) => {
  try {
    const id = req.params.id;
    const patch = req.body || {};
    const actor = actorFromRequest(req);

    const { rows: cur } = query("SELECT * FROM prices WHERE id = ?", [id]);
    if (!cur.length) return res.status(404).json({ error: "Not found" });
    const c = cur[0];

    query(
      `UPDATE prices SET
         contract_number     = ?,
         part_number         = ?,
         supplier            = ?,
         date_from           = ?,
         date_to             = ?,
         quantity_from       = ?,
         quantity_to         = ?,
         unit_price          = ?,
         lot_price           = ?,
         currency            = ?,
         previous_unit_price = ?,
         previous_lot_price  = ?,
         previous_date_from  = ?,
         previous_date_to    = ?,
         last_changed_at     = datetime('now'),
         last_changed_by     = ?
       WHERE id = ?`,
      [
        patch.contractNumber ?? c.contract_number,
        patch.partNumber ?? c.part_number,
        patch.supplier ?? c.supplier,
        patch.dateFrom ?? c.date_from,
        patch.dateTo ?? c.date_to,
        patch.quantityFrom ?? c.quantity_from,
        patch.quantityTo ?? c.quantity_to,
        patch.unitPrice !== undefined ? patch.unitPrice : c.unit_price,
        patch.lotPrice !== undefined ? patch.lotPrice : c.lot_price,
        patch.currency ?? c.currency,
        c.unit_price,
        c.lot_price,
        c.date_from,
        c.date_to,
        actor,
        id,
      ],
    );

    const { rows: out } = query("SELECT * FROM prices WHERE id = ?", [id]);
    writeAudit({
      user: actor,
      action: "price.update",
      summary: `Updated record ${id}`,
      affectedIds: [id],
      details: { patch },
    });
    res.json(rowToPrice(out[0]));
  } catch (e) {
    next(e);
  }
});

router.delete("/", (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.json({ deleted: 0 });
    const placeholders = ids.map(() => "?").join(",");
    query(`DELETE FROM prices WHERE id IN (${placeholders})`, ids);
    writeAudit({
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

router.post("/:id/revert", (req, res, next) => {
  try {
    const id = req.params.id;
    const actor = actorFromRequest(req);
    const { rows: cur } = query("SELECT * FROM prices WHERE id = ?", [id]);
    if (!cur.length) return res.status(404).json({ error: "Not found" });
    const c = cur[0];
    const hasPrev =
      c.previous_unit_price !== null ||
      c.previous_lot_price !== null ||
      c.previous_date_from !== null ||
      c.previous_date_to !== null;
    if (!hasPrev) return res.status(409).json({ error: "Nothing to revert" });

    query(
      `UPDATE prices SET
         unit_price          = COALESCE(previous_unit_price, unit_price),
         lot_price           = COALESCE(previous_lot_price,  lot_price),
         date_from           = COALESCE(previous_date_from,  date_from),
         date_to             = COALESCE(previous_date_to,    date_to),
         previous_unit_price = NULL,
         previous_lot_price  = NULL,
         previous_date_from  = NULL,
         previous_date_to    = NULL,
         last_changed_at     = datetime('now'),
         last_changed_by     = ?
       WHERE id = ?`,
      [actor, id],
    );
    const { rows: out } = query("SELECT * FROM prices WHERE id = ?", [id]);
    writeAudit({
      user: actor,
      action: "price.revert",
      summary: `Reverted record ${id} to previous values`,
      affectedIds: [id],
    });
    res.json(rowToPrice(out[0]));
  } catch (e) {
    next(e);
  }
});

/**
 * Bulk update — applies a patch to all rows matching simple equality filters.
 */
router.post("/bulk-update", (req, res, next) => {
  try {
    const { match = {}, patch = {}, summary = "Bulk update" } = req.body || {};
    const actor = actorFromRequest(req);

    const where = ["1=1"];
    const sets = [
      "previous_unit_price = unit_price",
      "previous_lot_price = lot_price",
      "previous_date_from = date_from",
      "previous_date_to = date_to",
      "last_changed_at = datetime('now')",
      "last_changed_by = ?",
    ];
    const params = [actor];

    if (patch.unitPrice !== undefined) { sets.push("unit_price = ?"); params.push(patch.unitPrice); }
    if (patch.lotPrice !== undefined)  { sets.push("lot_price = ?");  params.push(patch.lotPrice); }
    if (patch.dateFrom !== undefined)  { sets.push("date_from = ?");  params.push(patch.dateFrom); }
    if (patch.dateTo !== undefined)    { sets.push("date_to = ?");    params.push(patch.dateTo); }

    if (match.contractNumber) { where.push("contract_number = ?"); params.push(match.contractNumber); }
    if (match.partNumber)     { where.push("part_number = ?");     params.push(match.partNumber); }
    if (match.supplier)       { where.push("supplier = ?");        params.push(match.supplier); }

    // Capture affected ids first (so the audit log knows what changed).
    const idParams = params.slice(1); // skip the SET-clause `actor`
    const idSql =
      "SELECT id FROM prices WHERE " +
      where
        .slice(1)
        .map((w) => w)
        .join(" AND ") || "1=1";

    let affectedIds = [];
    if (where.length > 1) {
      const { rows } = query(`SELECT id FROM prices WHERE ${where.slice(1).join(" AND ")}`, idParams);
      affectedIds = rows.map((r) => r.id);
    } else {
      const { rows } = query(`SELECT id FROM prices`);
      affectedIds = rows.map((r) => r.id);
    }

    query(
      `UPDATE prices SET ${sets.join(", ")} WHERE ${where.join(" AND ")}`,
      params,
    );

    if (affectedIds.length) {
      writeAudit({
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