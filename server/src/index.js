require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { query } = require("./db");
const { ensureSchema } = require("./migrate");
const prices = require("./routes/prices");
const contracts = require("./routes/contracts");
const rates = require("./routes/rates");
const audit = require("./routes/audit");
const auth = require("./routes/auth");

const app = express();
const origin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: origin === "*" ? true : origin.split(",") }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (e) {
    res.status(503).json({ status: "degraded", error: e.message });
  }
});

app.use("/api/prices", prices);
app.use("/api/contracts", contracts);
app.use("/api/rates", rates);
app.use("/api/audit", audit);
app.use("/api/auth", auth);

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[api]", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

const port = Number(process.env.PORT || 3001);

(async () => {
  // Wait for the database, then auto-create schema on first boot.
  let attempts = 0;
  while (true) {
    try {
      await query("SELECT 1");
      break;
    } catch (e) {
      attempts++;
      if (attempts > 30) {
        console.error("[api] Could not reach database after 30 attempts:", e.message);
        process.exit(1);
      }
      console.log(`[api] Waiting for database (attempt ${attempts})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  try {
    await ensureSchema();
  } catch (e) {
    console.error("[api] Schema migration failed:", e.message);
    process.exit(1);
  }
  app.listen(port, () => {
    console.log(`[api] Listening on http://localhost:${port}`);
  });
})();