-- ============================================================
-- Migration v2: Add speed & discount fields to models table
-- Run this manually or via init-db.js
-- ============================================================

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS speed VARCHAR(10) DEFAULT 'normal' AFTER free,
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0.00 AFTER speed,
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) DEFAULT 'none' AFTER discount_percent;
