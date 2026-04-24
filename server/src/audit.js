const crypto = require("crypto");
const { query } = require("./db");

/**
 * Append a row to AuditLog.
 * @param {{ user?: string, action: string, summary: string, affectedIds?: string[], details?: object }} entry
 */
function writeAudit(entry) {
  query(
    `INSERT INTO audit_log (id, user, action, summary, affected_ids, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
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