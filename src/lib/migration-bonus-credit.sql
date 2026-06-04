-- ============================================================
-- Migration: Bonus Credit for New Verified Accounts
-- Date: 2026-06-02
-- 
-- Changes:
--   1. Add 'bonus' type to credit_logs ENUM
--   2. Change users.credit default from 25 to 0
-- ============================================================

-- 1. Tambahkan tipe 'bonus' ke ENUM credit_logs.type
ALTER TABLE credit_logs
  MODIFY COLUMN type ENUM('topup', 'deduct', 'admin_set', 'usage', 'bonus') NOT NULL;

-- 2. Ubah default credit users dari 25 menjadi 0
ALTER TABLE users
  MODIFY COLUMN credit DECIMAL(12,4) NOT NULL DEFAULT 0.0000;
