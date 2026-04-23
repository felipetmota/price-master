const { sql, getPool } = require("./db");

/**
 * Append a row to AuditLog.
 * @param {{ user?: string, action: string, summary: string, affectedIds?: string[], details?: object }} entry
 */
async function writeAudit(entry) {
  const pool = await getPool();
  await pool
    .request()
    .input("user", sql.NVarChar(128), entry.user || "system")
    .input("action", sql.NVarChar(64), entry.action)
    .input("summary", sql.NVarChar(1000), entry.summary)
    .input(
      "affectedIds",
      sql.NVarChar(sql.MAX),
      entry.affectedIds ? JSON.stringify(entry.affectedIds) : null,
    )
    .input(
      "details",
      sql.NVarChar(sql.MAX),
      entry.details ? JSON.stringify(entry.details) : null,
    )
    .query(
      `INSERT INTO dbo.AuditLog ([User], Action, Summary, AffectedIds, Details)
       VALUES (@user, @action, @summary, @affectedIds, @details)`,
    );
}

function actorFromRequest(req) {
  return (
    req.header("x-actor") ||
    req.body?._actor ||
    "system"
  );
}

module.exports = { writeAudit, actorFromRequest };