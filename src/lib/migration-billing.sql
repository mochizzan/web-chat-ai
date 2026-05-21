-- Migration: Billing & Invoice System
-- Menambahkan kolom invoice support ke credit_logs dan mengupdate ENUM type

-- First, modify the ENUM to include new types
-- We need to change 'admin_adjust' to support 'topup', 'deduct', 'admin_set', 'usage'
-- Since MySQL doesn't support dropping ENUM values easily, we'll need to recreate the column
-- This migration assumes the current ENUM is 'topup', 'usage', 'admin_adjust'

-- Step 1: Add new columns with updated ENUM
ALTER TABLE credit_logs
  ADD COLUMN IF NOT EXISTS type_new ENUM('topup', 'deduct', 'admin_set', 'usage') NOT NULL AFTER type,
  ADD COLUMN IF NOT EXISTS previous_balance DECIMAL(12,4) DEFAULT NULL AFTER balance,
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(32) DEFAULT NULL AFTER note,
  ADD COLUMN IF NOT EXISTS operator_id VARCHAR(64) DEFAULT NULL COMMENT 'Admin yang melakukan perubahan' AFTER description,
  ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255) DEFAULT NULL AFTER operator_id,
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL COMMENT 'Catatan admin untuk invoice' AFTER operator_name;

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
  ADD INDEX IF NOT EXISTS idx_invoice (invoice_number),
  ADD INDEX IF NOT EXISTS idx_type (type),
  ADD INDEX IF NOT EXISTS idx_operator (operator_id),
  ADD INDEX IF NOT EXISTS idx_user_created (user_id, created_at DESC);
