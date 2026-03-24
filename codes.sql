-- =====================================================
-- PERSONAL FINANCE TRACKER - SQL SERVER SCHEMA
-- =====================================================

-- Create Database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'finance_db')
BEGIN
    CREATE DATABASE finance_db;
END
GO

USE finance_db;
GO

-- =====================================================
-- USERS TABLE
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id INT PRIMARY KEY IDENTITY(1,1),
        name NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT GETUTCDATE()
    );
END
GO

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'categories')
BEGIN
    CREATE TABLE categories (
        id INT PRIMARY KEY IDENTITY(1,1),
        name NVARCHAR(100) NOT NULL,
        type NVARCHAR(50) NOT NULL CHECK (type IN ('income', 'expense'))
    );
END
GO

-- =====================================================
-- TRANSACTIONS TABLE
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'transactions')
BEGIN
    CREATE TABLE transactions (
        id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
        category_id INT NOT NULL FOREIGN KEY REFERENCES categories(id),
        amount FLOAT NOT NULL CHECK (amount > 0),
        description NVARCHAR(255),
        date DATETIME NOT NULL,
        created_at DATETIME DEFAULT GETUTCDATE()
    );
END
GO

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transactions_user_id' AND object_id = OBJECT_ID('transactions'))
BEGIN
    CREATE INDEX idx_transactions_user_id ON transactions(user_id);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transactions_category_id' AND object_id = OBJECT_ID('transactions'))
BEGIN
    CREATE INDEX idx_transactions_category_id ON transactions(category_id);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transactions_date' AND object_id = OBJECT_ID('transactions'))
BEGIN
    CREATE INDEX idx_transactions_date ON transactions(date);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_transactions_user_date' AND object_id = OBJECT_ID('transactions'))
BEGIN
    CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
END
GO

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Insert sample categories
IF NOT EXISTS (SELECT * FROM categories)
BEGIN
    INSERT INTO categories (name, type) VALUES ('Salary', 'income');
    INSERT INTO categories (name, type) VALUES ('Freelance', 'income');
    INSERT INTO categories (name, type) VALUES ('Investments', 'income');
    INSERT INTO categories (name, type) VALUES ('Food', 'expense');
    INSERT INTO categories (name, type) VALUES ('Transport', 'expense');
    INSERT INTO categories (name, type) VALUES ('Rent', 'expense');
    INSERT INTO categories (name, type) VALUES ('Entertainment', 'expense');
    INSERT INTO categories (name, type) VALUES ('Utilities', 'expense');
END
GO

-- =====================================================
-- QUERY EXAMPLES
-- =====================================================

-- Get all users
-- SELECT * FROM users;

-- Get all categories
-- SELECT * FROM categories;

-- Get user transactions with category details
-- SELECT 
--     t.id,
--     t.amount,
--     t.description,
--     t.date,
--     c.name AS category_name,
--     c.type AS category_type
-- FROM transactions t
-- JOIN categories c ON t.category_id = c.id
-- WHERE t.user_id = 1
-- ORDER BY t.date DESC;

-- Get total income and expense for a user
-- SELECT 
--     c.type,
--     SUM(t.amount) AS total
-- FROM transactions t
-- JOIN categories c ON t.category_id = c.id
-- WHERE t.user_id = 1
-- GROUP BY c.type;

-- Get monthly summary
-- SELECT 
--     YEAR(t.date) AS year,
--     MONTH(t.date) AS month,
--     c.type,
--     SUM(t.amount) AS total
-- FROM transactions t
-- JOIN categories c ON t.category_id = c.id
-- WHERE t.user_id = 1
-- GROUP BY YEAR(t.date), MONTH(t.date), c.type
-- ORDER BY year, month;
