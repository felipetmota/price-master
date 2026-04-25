const express = require("express");
const crypto = require("crypto");
const { query, transaction } = require("../db");
const { writeAudit, actorFromRequest } = require("../audit");

const router = express.Router();

function rowToReport(r) {
  return {
    id: r.id,
    reportNumber: r.report_number,
    partNo: r.part_no || "",
    description: r.description || "",
    quantity: r.quantity || "",
    date: r.report_date || "",
    operationNo: r.operation_no || "",
    planningCardNo: r.planning_card_no || "",
    customer: r.customer || "",
    xrayTechniqueNo: r.xray_technique_no || "",
    issue: r.issue || "",
    kv: r.kv || "",
    ma: r.ma || "",
    timeSeconds: r.time_seconds || "",
    sfdMm: r.sfd_mm || "",
    filmTypeQty: r.film_type_qty || "",
    xraySerialNo: r.xray_serial_no || "",
    acceptedQty: r.accepted_qty !== null && r.accepted_qty !== undefined ? Number(r.accepted_qty) : null,
    reworkQty: r.rework_qty !== null && r.rework_qty !== undefined ? Number(r.rework_qty) : null,
    rejectQty: r.reject_qty !== null && r.reject_qty !== undefined ? Number(r.reject_qty) : null,
    interpreter: r.interpreter || "",
    radiographer: r.radiographer || "",
    secondScrutineer: r.second_scrutineer || "",
    radiographicProcedure: r.radiographic_procedure || "",
    acceptanceCriteria: r.acceptance_criteria || "",
    createdAt: r.created_at,
    lastChangedAt: r.last_changed_at || undefined,
    lastChangedBy: r.last_changed_by || undefined,
  };
}

const COLS = [
  "report_number","part_no","description","quantity","report_date","operation_no",
  "planning_card_no","customer","xray_technique_no","issue","kv","ma","time_seconds",
  "sfd_mm","film_type_qty","xray_serial_no","accepted_qty","rework_qty","reject_qty",
  "interpreter","radiographer","second_scrutineer","radiographic_procedure","acceptance_criteria",
];

function patchToValues(p, fallback = {}) {
  return [
    p.reportNumber ?? fallback.report_number,
    p.partNo ?? fallback.part_no ?? "",
    p.description ?? fallback.description ?? "",
    p.quantity ?? fallback.quantity ?? "",
    p.date ?? fallback.report_date ?? null,
    p.operationNo ?? fallback.operation_no ?? "",
    p.planningCardNo ?? fallback.planning_card_no ?? "",
    p.customer ?? fallback.customer ?? "",
    p.xrayTechniqueNo ?? fallback.xray_technique_no ?? "",
    p.issue ?? fallback.issue ?? "",
    p.kv ?? fallback.kv ?? "",
    p.ma ?? fallback.ma ?? "",
    p.timeSeconds ?? fallback.time_seconds ?? "",
    p.sfdMm ?? fallback.sfd_mm ?? "",
    p.filmTypeQty ?? fallback.film_type_qty ?? "",
    p.xraySerialNo ?? fallback.xray_serial_no ?? "",
    p.acceptedQty !== undefined ? p.acceptedQty : (fallback.accepted_qty ?? null),
    p.reworkQty !== undefined ? p.reworkQty : (fallback.rework_qty ?? null),
    p.rejectQty !== undefined ? p.rejectQty : (fallback.reject_qty ?? null),
    p.interpreter ?? fallback.interpreter ?? "",
    p.radiographer ?? fallback.radiographer ?? "",
    p.secondScrutineer ?? fallback.second_scrutineer ?? "",
    p.radiographicProcedure ?? fallback.radiographic_procedure ?? "",
    p.acceptanceCriteria ?? fallback.acceptance_criteria ?? "",
  ];
}

router.get("/", (_req, res, next) => {
  try {
    const { rows } = query("SELECT * FROM xray_reports ORDER BY CAST(report_number AS INTEGER) DESC");
    res.json(rows.map(rowToReport));
  } catch (e) { next(e); }
});

router.get("/next-number", (_req, res, next) => {
  try {
    const { rows } = query(
      "SELECT MAX(CAST(report_number AS INTEGER)) AS max_num FROM xray_reports WHERE report_number GLOB '[0-9]*'",
    );
    const max = rows[0]?.max_num || 0;
    res.json({ next: String(Number(max) + 1) });
  } catch (e) { next(e); }
});

router.post("/", (req, res, next) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const source = req.query.source === "import" ? "import" : "manual";
    const inserted = [];
    transaction(() => {
      // Helper: get current max numeric report_number to support auto-numbering
      const getNextNum = () => {
        const { rows: r } = query(
          "SELECT MAX(CAST(report_number AS INTEGER)) AS max_num FROM xray_reports WHERE report_number GLOB '[0-9]*'",
        );
        return Number(r[0]?.max_num || 0) + 1;
      };
      for (const r of rows) {
        // Auto-assign report number when missing/blank.
        if (!r.reportNumber || !String(r.reportNumber).trim()) {
          r.reportNumber = String(getNextNum());
        }
        const id = crypto.randomUUID();
        const placeholders = COLS.map(() => "?").join(",");
        query(
          `INSERT INTO xray_reports (id, ${COLS.join(",")}) VALUES (?, ${placeholders})`,
          [id, ...patchToValues(r)],
        );
        const { rows: out } = query("SELECT * FROM xray_reports WHERE id = ?", [id]);
        inserted.push(rowToReport(out[0]));
      }
    });
    writeAudit({
      user: actorFromRequest(req),
      action: source === "import" ? "xray.import" : "xray.create",
      summary: source === "import"
        ? `Imported ${inserted.length} X-ray report(s)`
        : `Created ${inserted.length} X-ray report(s)`,
      affectedIds: inserted.map((x) => x.id),
    });
    res.status(201).json(inserted);
  } catch (e) { next(e); }
});

router.put("/:id", (req, res, next) => {
  try {
    const id = req.params.id;
    const actor = actorFromRequest(req);
    const { rows: cur } = query("SELECT * FROM xray_reports WHERE id = ?", [id]);
    if (!cur.length) return res.status(404).json({ error: "Not found" });
    const c = cur[0];
    const setSql = COLS.map((c) => `${c} = ?`).join(", ");
    query(
      `UPDATE xray_reports SET ${setSql}, last_changed_at = datetime('now'), last_changed_by = ? WHERE id = ?`,
      [...patchToValues(req.body || {}, c), actor, id],
    );
    const { rows: out } = query("SELECT * FROM xray_reports WHERE id = ?", [id]);
    writeAudit({
      user: actor,
      action: "xray.update",
      summary: `Updated X-ray report ${out[0].report_number}`,
      affectedIds: [id],
    });
    res.json(rowToReport(out[0]));
  } catch (e) { next(e); }
});

router.delete("/", (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.json({ deleted: 0 });
    const placeholders = ids.map(() => "?").join(",");
    query(`DELETE FROM xray_reports WHERE id IN (${placeholders})`, ids);
    writeAudit({
      user: actorFromRequest(req),
      action: "xray.delete",
      summary: `Deleted ${ids.length} X-ray report(s)`,
      affectedIds: ids,
    });
    res.json({ deleted: ids.length });
  } catch (e) { next(e); }
});

module.exports = router;