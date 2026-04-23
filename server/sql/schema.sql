-- =====================================================================
-- Price Management — SQL Server schema
-- Compatible with SQL Server 2019+
-- Run once against an empty database (e.g. CREATE DATABASE PriceManagement;)
-- =====================================================================

IF OBJECT_ID('dbo.AuditLog', 'U')        IS NOT NULL DROP TABLE dbo.AuditLog;
IF OBJECT_ID('dbo.Prices', 'U')          IS NOT NULL DROP TABLE dbo.Prices;
IF OBJECT_ID('dbo.Contracts', 'U')       IS NOT NULL DROP TABLE dbo.Contracts;
IF OBJECT_ID('dbo.ExchangeRates', 'U')   IS NOT NULL DROP TABLE dbo.ExchangeRates;
IF OBJECT_ID('dbo.Users', 'U')           IS NOT NULL DROP TABLE dbo.Users;
GO

-- ---------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------
CREATE TABLE dbo.Contracts (
    Id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Contracts PRIMARY KEY DEFAULT NEWID(),
    ContractNumber  NVARCHAR(64)     NOT NULL,
    Description     NVARCHAR(500)    NOT NULL DEFAULT(''),
    Currency        CHAR(3)          NOT NULL DEFAULT('USD'),
    CreatedAt       DATETIME2(3)     NOT NULL DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT UQ_Contracts_Number UNIQUE (ContractNumber),
    CONSTRAINT CK_Contracts_Currency CHECK (Currency IN ('USD','EUR','GBP','BRL'))
);
GO

-- ---------------------------------------------------------------------
-- Prices
-- ---------------------------------------------------------------------
CREATE TABLE dbo.Prices (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Prices PRIMARY KEY DEFAULT NEWID(),
    ContractNumber      NVARCHAR(64)     NOT NULL,
    PartNumber          NVARCHAR(128)    NOT NULL,
    Supplier            NVARCHAR(256)    NOT NULL DEFAULT(''),
    DateFrom            DATE             NULL,
    DateTo              DATE             NULL,
    QuantityFrom        INT              NOT NULL DEFAULT(1),
    QuantityTo          INT              NOT NULL DEFAULT(9999999),
    UnitPrice           DECIMAL(18, 6)   NULL,
    LotPrice            DECIMAL(18, 6)   NULL,
    Currency            CHAR(3)          NOT NULL DEFAULT('USD'),
    PreviousUnitPrice   DECIMAL(18, 6)   NULL,
    PreviousLotPrice    DECIMAL(18, 6)   NULL,
    PreviousDateFrom    DATE             NULL,
    PreviousDateTo      DATE             NULL,
    LastChangedAt       DATETIME2(3)     NULL,
    LastChangedBy       NVARCHAR(128)    NULL,
    CONSTRAINT CK_Prices_Currency CHECK (Currency IN ('USD','EUR','GBP','BRL')),
    CONSTRAINT FK_Prices_Contracts FOREIGN KEY (ContractNumber)
        REFERENCES dbo.Contracts(ContractNumber)
        ON UPDATE CASCADE
        ON DELETE NO ACTION
);
GO

CREATE INDEX IX_Prices_ContractNumber ON dbo.Prices(ContractNumber);
CREATE INDEX IX_Prices_PartNumber     ON dbo.Prices(PartNumber);
CREATE INDEX IX_Prices_Supplier       ON dbo.Prices(Supplier);
CREATE INDEX IX_Prices_DateRange      ON dbo.Prices(DateFrom, DateTo);
GO

-- ---------------------------------------------------------------------
-- Exchange rates (one row per currency)
-- ---------------------------------------------------------------------
CREATE TABLE dbo.ExchangeRates (
    Currency   CHAR(3)        NOT NULL CONSTRAINT PK_ExchangeRates PRIMARY KEY,
    Rate       DECIMAL(18, 8) NOT NULL DEFAULT(1),
    IsBase     BIT            NOT NULL DEFAULT(0),
    UpdatedAt  DATETIME2(3)   NOT NULL DEFAULT(SYSUTCDATETIME()),
    CONSTRAINT CK_ExchangeRates_Currency CHECK (Currency IN ('USD','EUR','GBP','BRL'))
);
GO

-- Seed default rates (USD as base)
INSERT INTO dbo.ExchangeRates (Currency, Rate, IsBase) VALUES
    ('USD', 1.00,   1),
    ('EUR', 0.92,   0),
    ('GBP', 0.79,   0),
    ('BRL', 5.10,   0);
GO

-- ---------------------------------------------------------------------
-- Users
-- Passwords are stored as bcrypt hashes. Use the seed script to insert.
-- ---------------------------------------------------------------------
CREATE TABLE dbo.Users (
    Username      NVARCHAR(128) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    PasswordHash  NVARCHAR(256) NOT NULL,
    Name          NVARCHAR(256) NOT NULL DEFAULT(''),
    Role          NVARCHAR(32)  NOT NULL DEFAULT('user'),
    CreatedAt     DATETIME2(3)  NOT NULL DEFAULT(SYSUTCDATETIME())
);
GO

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
CREATE TABLE dbo.AuditLog (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AuditLog PRIMARY KEY DEFAULT NEWID(),
    [At]         DATETIME2(3)     NOT NULL DEFAULT(SYSUTCDATETIME()),
    [User]       NVARCHAR(128)    NOT NULL DEFAULT('system'),
    Action       NVARCHAR(64)     NOT NULL,
    Summary      NVARCHAR(1000)   NOT NULL,
    AffectedIds  NVARCHAR(MAX)    NULL,  -- JSON array
    Details      NVARCHAR(MAX)    NULL   -- JSON object
);
GO

CREATE INDEX IX_AuditLog_At     ON dbo.AuditLog([At] DESC);
CREATE INDEX IX_AuditLog_Action ON dbo.AuditLog(Action);
GO