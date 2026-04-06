-- =====================================================
-- FINLY - SQL SERVER SCHEMA SYNC SCRIPT
-- =====================================================
-- Purpose:
-- - Create the database if it does not exist
-- - Create any missing tables used by the current FastAPI app
-- - Patch older databases by adding missing columns/constraints/indexes
-- - Seed a baseline category set when categories are empty
--
-- Notes:
-- - The application stores income as positive amounts and expenses as negative amounts
-- - Activity logs are stored in the audit_logs table in SQL Server
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'finance_db')
BEGIN
    CREATE DATABASE finance_db;
END
GO

USE finance_db;
GO

-- =====================================================
-- USERS
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT ('active'),
        role NVARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT ('user'),
        created_at DATETIME NOT NULL CONSTRAINT DF_users_created_at DEFAULT (GETUTCDATE())
    );
END
GO

IF COL_LENGTH('dbo.users', 'status') IS NULL
BEGIN
    ALTER TABLE dbo.users
    ADD status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_users_status DEFAULT ('active');
END
GO

IF COL_LENGTH('dbo.users', 'role') IS NULL
BEGIN
    ALTER TABLE dbo.users
    ADD role NVARCHAR(20) NOT NULL
        CONSTRAINT DF_users_role DEFAULT ('user');
END
GO

IF COL_LENGTH('dbo.users', 'created_at') IS NULL
BEGIN
    ALTER TABLE dbo.users
    ADD created_at DATETIME NOT NULL
        CONSTRAINT DF_users_created_at DEFAULT (GETUTCDATE());
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_users_email'
      AND object_id = OBJECT_ID('dbo.users')
)
BEGIN
    ALTER TABLE dbo.users
    ADD CONSTRAINT UQ_users_email UNIQUE (email);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_users_status'
      AND parent_object_id = OBJECT_ID('dbo.users')
)
BEGIN
    ALTER TABLE dbo.users
    ADD CONSTRAINT CK_users_status
    CHECK (status IN ('active', 'inactive', 'blocked'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_users_role'
      AND parent_object_id = OBJECT_ID('dbo.users')
)
BEGIN
    ALTER TABLE dbo.users
    ADD CONSTRAINT CK_users_role
    CHECK (role IN ('user', 'admin'));
END
GO

-- =====================================================
-- CATEGORIES
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'categories')
BEGIN
    CREATE TABLE dbo.categories (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        type NVARCHAR(50) NOT NULL
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_categories_type'
      AND parent_object_id = OBJECT_ID('dbo.categories')
)
BEGIN
    ALTER TABLE dbo.categories
    ADD CONSTRAINT CK_categories_type
    CHECK (type IN ('income', 'expense'));
END
GO

-- =====================================================
-- TRANSACTIONS
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'transactions')
BEGIN
    CREATE TABLE dbo.transactions (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL,
        category_id INT NOT NULL,
        amount FLOAT NOT NULL,
        description NVARCHAR(500) NULL,
        date DATETIME NOT NULL,
        created_by INT NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_transactions_created_at DEFAULT (GETUTCDATE()),
        modified_by INT NULL,
        modified_at DATETIME NULL,
        is_deleted BIT NOT NULL CONSTRAINT DF_transactions_is_deleted DEFAULT ((0))
    );
END
GO

IF COL_LENGTH('dbo.transactions', 'description') IS NULL
BEGIN
    ALTER TABLE dbo.transactions
    ADD description NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.transactions', 'created_by') IS NULL
BEGIN
    ALTER TABLE dbo.transactions
    ADD created_by INT NULL;
END
GO

IF COL_LENGTH('dbo.transactions', 'created_at') IS NULL
BEGIN
    ALTER TABLE dbo.transactions
    ADD created_at DATETIME NOT NULL
        CONSTRAINT DF_transactions_created_at DEFAULT (GETUTCDATE());
END
GO

IF COL_LENGTH('dbo.transactions', 'modified_by') IS NULL
BEGIN
    ALTER TABLE dbo.transactions
    ADD modified_by INT NULL;
END
GO

IF COL_LENGTH('dbo.transactions', 'modified_at') IS NULL
BEGIN
    ALTER TABLE dbo.transactions
    ADD modified_at DATETIME NULL;
END
GO

IF COL_LENGTH('dbo.transactions', 'is_deleted') IS NULL
BEGIN
    ALTER TABLE dbo.transactions
    ADD is_deleted BIT NOT NULL
        CONSTRAINT DF_transactions_is_deleted DEFAULT ((0));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_transactions_user'
      AND parent_object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    ALTER TABLE dbo.transactions
    ADD CONSTRAINT FK_transactions_user
    FOREIGN KEY (user_id) REFERENCES dbo.users(id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_transactions_category'
      AND parent_object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    ALTER TABLE dbo.transactions
    ADD CONSTRAINT FK_transactions_category
    FOREIGN KEY (category_id) REFERENCES dbo.categories(id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_transactions_created_by'
      AND parent_object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    ALTER TABLE dbo.transactions
    ADD CONSTRAINT FK_transactions_created_by
    FOREIGN KEY (created_by) REFERENCES dbo.users(id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_transactions_modified_by'
      AND parent_object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    ALTER TABLE dbo.transactions
    ADD CONSTRAINT FK_transactions_modified_by
    FOREIGN KEY (modified_by) REFERENCES dbo.users(id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_transactions_user_id'
      AND object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    CREATE INDEX idx_transactions_user_id
    ON dbo.transactions(user_id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_transactions_category_id'
      AND object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    CREATE INDEX idx_transactions_category_id
    ON dbo.transactions(category_id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_transactions_date'
      AND object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    CREATE INDEX idx_transactions_date
    ON dbo.transactions([date]);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_transactions_is_deleted'
      AND object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    CREATE INDEX idx_transactions_is_deleted
    ON dbo.transactions(is_deleted);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_user_date'
      AND object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    CREATE INDEX idx_user_date
    ON dbo.transactions(user_id, [date]);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_transactions_amount_non_zero'
      AND parent_object_id = OBJECT_ID('dbo.transactions')
)
BEGIN
    ALTER TABLE dbo.transactions
    ADD CONSTRAINT CK_transactions_amount_non_zero
    CHECK (amount <> 0);
END
GO

-- =====================================================
-- BUDGETS
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'budgets')
BEGIN
    CREATE TABLE dbo.budgets (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL,
        category_id INT NULL,
        amount FLOAT NOT NULL,
        period NVARCHAR(20) NOT NULL CONSTRAINT DF_budgets_period DEFAULT ('monthly'),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        description NVARCHAR(200) NULL,
        created_at DATETIME NOT NULL CONSTRAINT DF_budgets_created_at DEFAULT (GETUTCDATE()),
        updated_at DATETIME NULL
    );
END
GO

IF COL_LENGTH('dbo.budgets', 'user_id') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD user_id INT NOT NULL;
END
GO

IF COL_LENGTH('dbo.budgets', 'category_id') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD category_id INT NULL;
END
GO

IF COL_LENGTH('dbo.budgets', 'amount') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD amount FLOAT NOT NULL
        CONSTRAINT DF_budgets_amount DEFAULT ((0));
END
GO

IF COL_LENGTH('dbo.budgets', 'period') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD period NVARCHAR(20) NOT NULL
        CONSTRAINT DF_budgets_period DEFAULT ('monthly');
END
GO

IF COL_LENGTH('dbo.budgets', 'start_date') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD start_date DATE NULL;
END
GO

IF COL_LENGTH('dbo.budgets', 'end_date') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD end_date DATE NULL;
END
GO

IF COL_LENGTH('dbo.budgets', 'description') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD description NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.budgets', 'created_at') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD created_at DATETIME NOT NULL
        CONSTRAINT DF_budgets_created_at DEFAULT (GETUTCDATE());
END
GO

IF COL_LENGTH('dbo.budgets', 'updated_at') IS NULL
BEGIN
    ALTER TABLE dbo.budgets
    ADD updated_at DATETIME NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_budgets_user'
      AND parent_object_id = OBJECT_ID('dbo.budgets')
)
BEGIN
    ALTER TABLE dbo.budgets
    ADD CONSTRAINT FK_budgets_user
    FOREIGN KEY (user_id) REFERENCES dbo.users(id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_budgets_category'
      AND parent_object_id = OBJECT_ID('dbo.budgets')
)
BEGIN
    ALTER TABLE dbo.budgets
    ADD CONSTRAINT FK_budgets_category
    FOREIGN KEY (category_id) REFERENCES dbo.categories(id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_budgets_user_id'
      AND object_id = OBJECT_ID('dbo.budgets')
)
BEGIN
    CREATE INDEX idx_budgets_user_id
    ON dbo.budgets(user_id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_budgets_category_id'
      AND object_id = OBJECT_ID('dbo.budgets')
)
BEGIN
    CREATE INDEX idx_budgets_category_id
    ON dbo.budgets(category_id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_budgets_period'
      AND parent_object_id = OBJECT_ID('dbo.budgets')
)
BEGIN
    ALTER TABLE dbo.budgets
    ADD CONSTRAINT CK_budgets_period
    CHECK (period IN ('monthly', 'yearly', 'custom'));
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_budgets_amount_positive'
      AND parent_object_id = OBJECT_ID('dbo.budgets')
)
BEGIN
    ALTER TABLE dbo.budgets
    ADD CONSTRAINT CK_budgets_amount_positive
    CHECK (amount > 0);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_budgets_date_range'
      AND parent_object_id = OBJECT_ID('dbo.budgets')
)
BEGIN
    ALTER TABLE dbo.budgets
    ADD CONSTRAINT CK_budgets_date_range
    CHECK (end_date >= start_date);
END
GO

-- =====================================================
-- AUDIT LOGS
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_logs')
BEGIN
    CREATE TABLE dbo.audit_logs (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        event NVARCHAR(100) NOT NULL,
        action NVARCHAR(100) NOT NULL,
        user_id INT NULL,
        entity_type NVARCHAR(50) NULL,
        entity_id INT NULL,
        level NVARCHAR(20) NOT NULL CONSTRAINT DF_audit_logs_level DEFAULT ('INFO'),
        request_id NVARCHAR(120) NULL,
        payload_json NVARCHAR(MAX) NULL,
        timestamp DATETIME NOT NULL CONSTRAINT DF_audit_logs_timestamp DEFAULT (GETUTCDATE()),
        created_at DATETIME NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT (GETUTCDATE())
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_audit_logs_user_id'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX idx_audit_logs_user_id
    ON dbo.audit_logs(user_id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_audit_logs_timestamp'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX idx_audit_logs_timestamp
    ON dbo.audit_logs([timestamp]);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_audit_logs_level'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX idx_audit_logs_level
    ON dbo.audit_logs(level);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_audit_logs_request_id'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX idx_audit_logs_request_id
    ON dbo.audit_logs(request_id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_audit_user_timestamp'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX idx_audit_user_timestamp
    ON dbo.audit_logs(user_id, [timestamp]);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_audit_action_timestamp'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX idx_audit_action_timestamp
    ON dbo.audit_logs(action, [timestamp]);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_audit_entity'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX idx_audit_entity
    ON dbo.audit_logs(entity_type, entity_id);
END
GO

-- =====================================================
-- BASELINE CATEGORY SEED DATA
-- =====================================================
IF NOT EXISTS (SELECT 1 FROM dbo.categories)
BEGIN
    INSERT INTO dbo.categories (name, type) VALUES
        ('Salary', 'income'),
        ('Freelance', 'income'),
        ('Investments', 'income'),
        ('Bonus', 'income'),
        ('Food & Dining', 'expense'),
        ('Entertainment', 'expense'),
        ('Shopping', 'expense'),
        ('Transportation', 'expense'),
        ('Utilities', 'expense'),
        ('Healthcare', 'expense'),
        ('Rent', 'expense'),
        ('Education', 'expense'),
        ('Others', 'expense');
END
GO

-- =====================================================
-- QUERY SNIPPETS
-- =====================================================

-- Users
-- SELECT id, name, email, role, status, created_at
-- FROM dbo.users
-- ORDER BY created_at DESC;

-- User transactions with category details
-- SELECT
--     t.id,
--     u.email,
--     c.name AS category_name,
--     c.type AS category_type,
--     t.amount,
--     t.description,
--     t.date,
--     t.is_deleted
-- FROM dbo.transactions t
-- JOIN dbo.users u ON u.id = t.user_id
-- JOIN dbo.categories c ON c.id = t.category_id
-- WHERE t.is_deleted = 0
-- ORDER BY t.date DESC;

-- User budget progress helper
-- SELECT
--     b.id,
--     b.user_id,
--     b.category_id,
--     b.amount AS budget_amount,
--     SUM(CASE
--         WHEN t.amount < 0 THEN ABS(t.amount)
--         ELSE 0
--     END) AS spent_amount
-- FROM dbo.budgets b
-- LEFT JOIN dbo.transactions t
--     ON t.user_id = b.user_id
--    AND (b.category_id IS NULL OR t.category_id = b.category_id)
--    AND CAST(t.date AS DATE) BETWEEN b.start_date AND b.end_date
--    AND t.is_deleted = 0
-- GROUP BY b.id, b.user_id, b.category_id, b.amount;

-- System-level monthly analytics
-- SELECT
--     YEAR(t.date) AS [year],
--     MONTH(t.date) AS [month],
--     c.type,
--     SUM(CASE WHEN c.type = 'expense' THEN ABS(t.amount) ELSE t.amount END) AS total
-- FROM dbo.transactions t
-- JOIN dbo.categories c ON c.id = t.category_id
-- WHERE t.is_deleted = 0
-- GROUP BY YEAR(t.date), MONTH(t.date), c.type
-- ORDER BY [year], [month];
