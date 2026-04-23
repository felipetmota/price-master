-- =====================================================================
-- Price Management — PostgreSQL schema
-- Compatible with PostgreSQL 13+
-- Run once against an empty database, e.g.:
--   createdb price_management
--   psql -d price_management -f server/sql/schema.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

DROP TABLE IF EXISTS audit_log     CASCADE;
DROP TABLE IF EXISTS prices        CASCADE;
DROP TABLE IF EXISTS contracts     CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS users         CASCADE;

-- ---------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------
CREATE TABLE contracts (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number TEXT         NOT NULL UNIQUE,
    description     TEXT         NOT NULL DEFAULT '',
    currency        CHAR(3)      NOT NULL DEFAULT 'USD'
        CHECK (currency IN ('USD','EUR','GBP','BRL')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Prices
-- ---------------------------------------------------------------------
CREATE TABLE prices (
    id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number       TEXT           NOT NULL
        REFERENCES contracts(contract_number) ON UPDATE CASCADE ON DELETE RESTRICT,
    part_number           TEXT           NOT NULL,
    supplier              TEXT           NOT NULL DEFAULT '',
    date_from             DATE,
    date_to               DATE,
    quantity_from         INTEGER        NOT NULL DEFAULT 1,
    quantity_to           INTEGER        NOT NULL DEFAULT 9999999,
    unit_price            NUMERIC(18, 6),
    lot_price             NUMERIC(18, 6),
    currency              CHAR(3)        NOT NULL DEFAULT 'USD'
        CHECK (currency IN ('USD','EUR','GBP','BRL')),
    previous_unit_price   NUMERIC(18, 6),
    previous_lot_price    NUMERIC(18, 6),
    previous_date_from    DATE,
    previous_date_to      DATE,
    last_changed_at       TIMESTAMPTZ,
    last_changed_by       TEXT
);

CREATE INDEX idx_prices_contract  ON prices(contract_number);
CREATE INDEX idx_prices_part      ON prices(part_number);
CREATE INDEX idx_prices_supplier  ON prices(supplier);
CREATE INDEX idx_prices_dates     ON prices(date_from, date_to);

-- ---------------------------------------------------------------------
-- Exchange rates (one row per currency)
-- ---------------------------------------------------------------------
CREATE TABLE exchange_rates (
    currency   CHAR(3)        PRIMARY KEY
        CHECK (currency IN ('USD','EUR','GBP','BRL')),
    rate       NUMERIC(18, 8) NOT NULL DEFAULT 1,
    is_base    BOOLEAN        NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

INSERT INTO exchange_rates (currency, rate, is_base) VALUES
    ('USD', 1.00, TRUE),
    ('EUR', 0.92, FALSE),
    ('GBP', 0.79, FALSE),
    ('BRL', 5.10, FALSE);

-- ---------------------------------------------------------------------
-- Users (passwords stored as bcrypt hashes)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    username      TEXT         PRIMARY KEY,
    password_hash TEXT         NOT NULL,
    name          TEXT         NOT NULL DEFAULT '',
    role          TEXT         NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "user"        TEXT         NOT NULL DEFAULT 'system',
    action        TEXT         NOT NULL,
    summary       TEXT         NOT NULL,
    affected_ids  JSONB,
    details       JSONB
);

CREATE INDEX idx_audit_at     ON audit_log(at DESC);
CREATE INDEX idx_audit_action ON audit_log(action);