const sql = require("mssql");

const config = {
  server: process.env.SQLSERVER_HOST || "localhost",
  port: Number(process.env.SQLSERVER_PORT || 1433),
  database: process.env.SQLSERVER_DATABASE || "PriceManagement",
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  options: {
    encrypt: String(process.env.SQLSERVER_ENCRYPT || "false") === "true",
    trustServerCertificate:
      String(process.env.SQLSERVER_TRUST_CERT || "true") === "true",
    enableArithAbort: true,
  },
  pool: {
    max: 20,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log(
          `[db] Connected to SQL Server ${config.server}:${config.port}/${config.database}`,
        );
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error("[db] Connection failed:", err.message);
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };