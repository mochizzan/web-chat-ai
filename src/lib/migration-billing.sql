-- Migration: Billing & Invoice System
-- Menambahkan kolom invoice support ke credit_logs dan mengupdate ENUM type

-- First, check if columns already exist to avoid errors
-- Step 1: Add new columns (check if they don't exist first)
SET @has_type_new = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'ai_chat_web' AND TABLE_NAME = 'credit_logs' AND COLUMN_NAME = 'type_new');
SET @has_previous_balance = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'ai_chat_web' AND TABLE_NAME = 'credit_logs' AND COLUMN_NAME = 'previous_balance');
SET @has_invoice_number = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'ai_chat_web' AND TABLE_NAME = 'credit_logs' AND COLUMN_NAME = 'invoice_number');
SET @has_operator_id = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'ai_chat_web' AND TABLE_NAME = 'credit_logs' AND COLUMN_NAME = 'operator_id');
SET @has_operator_name = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'ai_chat_web' AND TABLE_NAME = 'credit_logs' AND COLUMN_NAME = 'operator_name');
SET @has_note = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'ai_chat_web' AND TABLE_NAME = 'credit_logs' AND COLUMN_NAME = 'note');

-- Add columns only if they don't exist
ALTER TABLE credit_logs
  ADD COLUMN type_new ENUM('topup', 'deduct', 'admin_set', 'usage') NULL AFTER type,
  ADD COLUMN previous_balance DECIMAL(12,4) DEFAULT NULL AFTER balance,
  ADD COLUMN operator_id VARCHAR(64) DEFAULT NULL COMMENT 'Admin yang melakukan perubahan' AFTER description,
  ADD COLUMN operator_name VARCHAR(255) DEFAULT NULL AFTER operator_id,
  ADD COLUMN note TEXT DEFAULT NULL COMMENT 'Catatan admin untuk invoice' AFTER operator_name,
  ADD COLUMN invoice_number VARCHAR(32) DEFAULT NULL AFTER note;

-- Step 2: Migrate data from old type to new type
-- Map: 'admin_adjust' -> 'admin_set' (or we could determine by amount sign)
UPDATE credit_logs SET 
  type_new = CASE 
    WHEN type = 'admin_adjust' AND amount > 0 THEN 'topup'
    WHEN type = 'admin_adjust' AND amount < 0 THEN 'deduct'
    WHEN type = 'admin_adjust' THEN 'admin_set'
    ELSE type 
  END,
  previous_balance = balance - amount;

-- Step 3: Drop old type column and rename new column
ALTER TABLE credit_logs
  DROP COLUMN type,
  CHANGE COLUMN type_new type ENUM('topup', 'deduct', 'admin_set', 'usage') NOT NULL;

-- Step 4: Add indexes for fast search
ALTER TABLE credit_logs
  ADD INDEX idx_invoice (invoice_number),
  ADD INDEX idx_type (type),
  ADD INDEX idx_operator (operator_id);