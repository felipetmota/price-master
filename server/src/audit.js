const { query } = require("./db");

/**
 * Append a row to AuditLog.
 * @param {{ user?: string, action: string, summary: string, affectedIds?: string[], details?: object }} entry
 */
async function writeAudit(entry) {
  await query(
    `INSERT INTO audit_log ("user", action, summary, affected_ids, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      entry.user || "system",
      entry.action,
      entry.summary,
      entry.affectedIds ? JSON.stringify(entry.affectedIds) : null,
      entry.details ? JSON.stringify(entry.details) : null,
    ],
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