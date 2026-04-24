-- =====================================================================
-- Price Management — SQLite schema
-- Compatible with SQLite 3.35+ (RETURNING clause requires 3.35).
-- Auto-applied on first API boot by server/src/migrate.js.
--
-- Note: SQLite uses dynamic typing. The "currency" CHECK constraints
-- enforce a small allow-list, and dates are stored as ISO strings.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
    id              TEXT    PRIMARY KEY,
    contract_number TEXT    NOT NULL UNIQUE,
    description     TEXT    NOT NULL DEFAULT '',
    currency        TEXT    NOT NULL DEFAULT 'USD'
        CHECK (currency IN ('USD','EUR','GBP','BRL')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Prices
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prices (
    id                    TEXT    PRIMARY KEY,
    contract_number       TEXT    NOT NULL,
    part_number           TEXT    NOT NULL,
    supplier              TEXT    NOT NULL DEFAULT '',
    date_from             TEXT,
    date_to               TEXT,
    quantity_from         INTEGER NOT NULL DEFAULT 1,
    quantity_to           INTEGER NOT NULL DEFAULT 9999999,
    unit_price            REAL,
    lot_price             REAL,
    currency              TEXT    NOT NULL DEFAULT 'USD'
        CHECK (currency IN ('USD','EUR','GBP','BRL')),
    previous_unit_price   REAL,
    previous_lot_price    REAL,
    previous_date_from    TEXT,
    previous_date_to      TEXT,
    last_changed_at       TEXT,
    last_changed_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_prices_contract ON prices(contract_number);
CREATE INDEX IF NOT EXISTS idx_prices_part     ON prices(part_number);
CREATE INDEX IF NOT EXISTS idx_prices_supplier ON prices(supplier);
CREATE INDEX IF NOT EXISTS idx_prices_dates    ON prices(date_from, date_to);

-- ---------------------------------------------------------------------
-- Exchange rates (one row per currency)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency   TEXT    PRIMARY KEY
        CHECK (currency IN ('USD','EUR','GBP','BRL')),
    rate       REAL    NOT NULL DEFAULT 1,
    is_base    INTEGER NOT NULL DEFAULT 0,   -- 0/1 boolean
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO exchange_rates (currency, rate, is_base) VALUES
    ('USD', 1.00, 1),
    ('EUR', 0.92, 0),
    ('GBP', 0.79, 0),
    ('BRL', 5.10, 0);

-- ---------------------------------------------------------------------
-- Users (passwords stored as bcrypt hashes)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    username      TEXT    PRIMARY KEY,
    password_hash TEXT    NOT NULL,
    name          TEXT    NOT NULL DEFAULT '',
    role          TEXT    NOT NULL DEFAULT 'user',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Per-user system grants. Admins implicitly access every system; this
-- table only stores explicit grants for non-admin users.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_systems (
    username    TEXT NOT NULL,
    system_key  TEXT NOT NULL,
    PRIMARY KEY (username, system_key),
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Audit log. JSON columns are stored as TEXT and parsed by the API.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id            TEXT    PRIMARY KEY,
    at            TEXT    NOT NULL DEFAULT (datetime('now')),
    user          TEXT    NOT NULL DEFAULT 'system',
    action        TEXT    NOT NULL,
    summary       TEXT    NOT NULL,
    affected_ids  TEXT,   -- JSON array
    details       TEXT    -- JSON object
);

CREATE INDEX IF NOT EXISTS idx_audit_at     ON audit_log(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- ---------------------------------------------------------------------
-- Radiographic Examination Reports (X-ray Records)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS xray_reports (
    id                       TEXT    PRIMARY KEY,
    report_number            TEXT    NOT NULL UNIQUE,
    part_no                  TEXT    NOT NULL DEFAULT '',
    description              TEXT    NOT NULL DEFAULT '',
    quantity                 TEXT    NOT NULL DEFAULT '',
    report_date              TEXT,
    operation_no             TEXT    NOT NULL DEFAULT '',
    planning_card_no         TEXT    NOT NULL DEFAULT '',
    customer                 TEXT    NOT NULL DEFAULT '',
    xray_technique_no        TEXT    NOT NULL DEFAULT '',
    issue                    TEXT    NOT NULL DEFAULT '',
    kv                       TEXT    NOT NULL DEFAULT '',
    ma                       TEXT    NOT NULL DEFAULT '',
    time_seconds             TEXT    NOT NULL DEFAULT '',
    sfd_mm                   TEXT    NOT NULL DEFAULT '',
    film_type_qty            TEXT    NOT NULL DEFAULT '',
    xray_serial_no           TEXT    NOT NULL DEFAULT '',
    accepted_qty             REAL,
    rework_qty               REAL,
    reject_qty               REAL,
    interpreter              TEXT    NOT NULL DEFAULT '',
    radiographer             TEXT    NOT NULL DEFAULT '',
    second_scrutineer        TEXT    NOT NULL DEFAULT '',
    radiographic_procedure   TEXT    NOT NULL DEFAULT '',
    acceptance_criteria      TEXT    NOT NULL DEFAULT '',
    created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
    last_changed_at          TEXT,
    last_changed_by          TEXT
);

CREATE INDEX IF NOT EXISTS idx_xray_report_number ON xray_reports(report_number);
CREATE INDEX IF NOT EXISTS idx_xray_part          ON xray_reports(part_no);
CREATE INDEX IF NOT EXISTS idx_xray_customer      ON xray_reports(customer);
CREATE INDEX IF NOT EXISTS idx_xray_date          ON xray_reports(report_date);