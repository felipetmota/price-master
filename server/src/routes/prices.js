const express = require("express");
const { pool, query } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

function isoDate(d) {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function rowToPrice(r) {
  return {
    id: r.id,
    contractNumber: r.contract_number,
    partNumber: r.part_number,
    supplier: r.supplier,
    dateFrom: isoDate(r.date_from),
    dateTo: isoDate(r.date_to),
    quantityFrom: r.quantity_from,
    quantityTo: r.quantity_to,
    unitPrice: r.unit_price !== null ? Number(r.unit_price) : null,
    lotPrice: r.lot_price !== null ? Number(r.lot_price) : null,
    currency: r.currency,
    previousUnitPrice:
      r.previous_unit_price !== null ? Number(r.previous_unit_price) : undefined,
    previousLotPrice:
      r.previous_lot_price !== null ? Number(r.previous_lot_price) : undefined,
    previousDateFrom: r.previous_date_from ? isoDate(r.previous_date_from) : undefined,
    previousDateTo: r.previous_date_to ? isoDate(r.previous_date_to) : undefined,
    lastChangedAt: r.last_changed_at ? r.last_changed_at.toISOString() : undefined,
    lastChangedBy: r.last_changed_by || undefined,
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM prices");
    res.json(rows.map(rowToPrice));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const source = req.query.source === "import" ? "import" : "manual";
    const inserted = [];
    for (const r of rows) {
      const { rows: out } = await query(
        `INSERT INTO prices
           (contract_number, part_number, supplier, date_from, date_to,
            quantity_from, quantity_to, unit_price, lot_price, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
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
      inserted.push(rowToPrice(out[0]));
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
    const actor = actorFromRequest(req);

    const { rows: cur } = await query("SELECT * FROM prices WHERE id = $1", [id]);
    if (!cur.length) return res.status(404).json({ error: "Not found" });
    const c = cur[0];

    const next$ = {
      contract_number: patch.contractNumber ?? c.contract_number,
      part_number: patch.partNumber ?? c.part_number,
      supplier: patch.supplier ?? c.supplier,
      date_from: patch.dateFrom ?? c.date_from,
      date_to: patch.dateTo ?? c.date_to,
      quantity_from: patch.quantityFrom ?? c.quantity_from,
      quantity_to: patch.quantityTo ?? c.quantity_to,
      unit_price: patch.unitPrice !== undefined ? patch.unitPrice : c.unit_price,
      lot_price: patch.lotPrice !== undefined ? patch.lotPrice : c.lot_price,
      currency: patch.currency ?? c.currency,
    };

    const { rows: out } = await query(
      `UPDATE prices SET
         contract_number     = $1,
         part_number         = $2,
         supplier            = $3,
         date_from           = $4,
         date_to             = $5,
         quantity_from       = $6,
         quantity_to         = $7,
         unit_price          = $8,
         lot_price           = $9,
         currency            = $10,
         previous_unit_price = $11,
         previous_lot_price  = $12,
         previous_date_from  = $13,
         previous_date_to    = $14,
         last_changed_at     = NOW(),
         last_changed_by     = $15
       WHERE id = $16
       RETURNING *`,
      [
        next$.contract_number,
        next$.part_number,
        next$.supplier,
        next$.date_from,
        next$.date_to,
        next$.quantity_from,
        next$.quantity_to,
        next$.unit_price,
        next$.lot_price,
        next$.currency,
        c.unit_price,
        c.lot_price,
        c.date_from,
        c.date_to,
        actor,
        id,
      ],
    );

    await writeAudit({
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

router.delete("/", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.json({ deleted: 0 });
    await query("DELETE FROM prices WHERE id = ANY($1::uuid[])", [ids]);
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
    const actor = actorFromRequest(req);
    const { rows: out } = await query(
      `UPDATE prices SET
         unit_price          = COALESCE(previous_unit_price, unit_price),
         lot_price           = COALESCE(previous_lot_price,  lot_price),
         date_from           = COALESCE(previous_date_from,  date_from),
         date_to             = COALESCE(previous_date_to,    date_to),
         previous_unit_price = NULL,
         previous_lot_price  = NULL,
         previous_date_from  = NULL,
         previous_date_to    = NULL,
         last_changed_at     = NOW(),
         last_changed_by     = $1
       WHERE id = $2
         AND (previous_unit_price IS NOT NULL
           OR previous_lot_price  IS NOT NULL
           OR previous_date_from  IS NOT NULL
           OR previous_date_to    IS NOT NULL)
       RETURNING *`,
      [actor, id],
    );
    if (!out.length) return res.status(409).json({ error: "Nothing to revert" });
    await writeAudit({
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
 * Body: { match: { contractNumber?, partNumber?, supplier? },
 *         patch: { unitPrice?, lotPrice?, dateFrom?, dateTo? },
 *         summary: string }
 */
router.post("/bulk-update", async (req, res, next) => {
  try {
    const { match = {}, patch = {}, summary = "Bulk update" } = req.body || {};
    const actor = actorFromRequest(req);

    const where = ["TRUE"];
    const sets = [
      "previous_unit_price = unit_price",
      "previous_lot_price = lot_price",
      "previous_date_from = date_from",
      "previous_date_to = date_to",
      "last_changed_at = NOW()",
    ];
    const params = [];

    const addParam = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    sets.push(`last_changed_by = ${addParam(actor)}`);

    if (match.contractNumber) where.push(`contract_number = ${addParam(match.contractNumber)}`);
    if (match.partNumber)     where.push(`part_number = ${addParam(match.partNumber)}`);
    if (match.supplier)       where.push(`supplier = ${addParam(match.supplier)}`);

    if (patch.unitPrice !== undefined) sets.push(`unit_price = ${addParam(patch.unitPrice)}`);
    if (patch.lotPrice !== undefined)  sets.push(`lot_price = ${addParam(patch.lotPrice)}`);
    if (patch.dateFrom !== undefined)  sets.push(`date_from = ${addParam(patch.dateFrom)}`);
    if (patch.dateTo !== undefined)    sets.push(`date_to = ${addParam(patch.dateTo)}`);

    const { rows } = await pool.query(
      `UPDATE prices SET ${sets.join(", ")}
       WHERE ${where.join(" AND ")}
       RETURNING id`,
      params,
    );
    const affectedIds = rows.map((r) => r.id);
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