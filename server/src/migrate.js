/**
 * Boot-time migration: applies schema.sql idempotently.
 * All CREATE statements use `IF NOT EXISTS`, so it is safe to run on
 * every API start.
 */
const fs = require("fs");
const path = require("path");
const { db } = require("./db");

function ensureSchema() {
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  // better-sqlite3 supports running multi-statement scripts via exec().
  db.exec(sql);

  // ---- Additive column migrations (idempotent) -----------------------
  // SQLite doesn't support `ADD COLUMN IF NOT EXISTS`, so we inspect
  // pragma_table_info and conditionally ALTER.
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes("email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''");
    console.log("[migrate] Added users.email column");
  }

  // ---- Force GBP as the base exchange-rate currency on existing DBs.
  // We never overwrite user-edited rate values; we just toggle is_base.
  try {
    const baseRow = db.prepare("SELECT currency FROM exchange_rates WHERE is_base = 1").get();
    if (!baseRow || baseRow.currency !== "GBP") {
      db.exec("UPDATE exchange_rates SET is_base = 0");
      // Make sure GBP exists as a row (it normally does because of seed).
      db.prepare(
        `INSERT INTO exchange_rates (currency, rate, is_base) VALUES ('GBP', 1, 1)
         ON CONFLICT(currency) DO UPDATE SET is_base = 1, rate = CASE WHEN exchange_rates.rate = 0 THEN 1 ELSE exchange_rates.rate END`,
      ).run();
      console.log("[migrate] Base currency set to GBP");
    }
  } catch (e) {
    console.warn("[migrate] Could not enforce GBP base:", e.message);
  }

  // ---- Seed X-ray reports on first boot ------------------------------
  try {
    const count = db.prepare("SELECT COUNT(*) AS n FROM xray_reports").get().n;
    if (count === 0) {
      const seedPath = path.join(__dirname, "..", "data", "xray-reports.seed.json");
      if (fs.existsSync(seedPath)) {
        const records = JSON.parse(fs.readFileSync(seedPath, "utf8"));
        const crypto = require("crypto");
        const COLS = [
          "id","report_number","part_no","description","quantity","report_date",
          "operation_no","planning_card_no","customer","xray_technique_no","issue",
          "kv","ma","time_seconds","sfd_mm","film_type_qty","xray_serial_no",
          "accepted_qty","rework_qty","reject_qty","interpreter","radiographer",
          "second_scrutineer","radiographic_procedure","acceptance_criteria",
        ];
        const placeholders = COLS.map(() => "?").join(",");
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO xray_reports (${COLS.join(",")}) VALUES (${placeholders})`,
        );
        const insertMany = db.transaction((rows) => {
          for (const r of rows) {
            stmt.run(
              crypto.randomUUID(),
              r.reportNumber, r.partNo || "", r.description || "", r.quantity || "",
              r.date || null, r.operationNo || "", r.planningCardNo || "",
              r.customer || "", r.xrayTechniqueNo || "", r.issue || "",
              r.kv || "", r.ma || "", r.timeSeconds || "", r.sfdMm || "",
              r.filmTypeQty || "", r.xraySerialNo || "",
              r.acceptedQty ?? null, r.reworkQty ?? null, r.rejectQty ?? null,
              r.interpreter || "", r.radiographer || "", r.secondScrutineer || "",
              r.radiographicProcedure || "", r.acceptanceCriteria || "",
            );
          }
        });
        insertMany(records);
        console.log(`[migrate] Seeded ${records.length} X-ray report(s)`);
      }
    }
  } catch (e) {
    console.warn("[migrate] X-ray seed skipped:", e.message);
  }

  console.log("[migrate] Schema ensured");
}

module.exports = { ensureSchema };