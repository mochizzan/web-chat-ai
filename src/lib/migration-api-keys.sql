-- Migration: API Keys & Usage Logs for BYOK Gateway
-- Creates api_keys and api_usage_logs tables
-- ============================================================

-- Step 1: Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT 'Default',
  key_prefix VARCHAR(20) NOT NULL COMMENT 'First 20 chars: mi-xxxxxxxxxxxx...',
  key_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt hash of full key',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  total_requests INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_key_prefix (key_prefix),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB;

-- Step 2: Create api_usage_logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id VARCHAR(64) PRIMARY KEY,
  api_key_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  model VARCHAR(100) NOT NULL,
  stream TINYINT(1) NOT NULL DEFAULT 0,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  cost DECIMAL(12,6) NOT NULL DEFAULT 0.000000,
  credit_before DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  credit_after DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  status ENUM('success', 'error', 'refunded') NOT NULL DEFAULT 'success',
  error_message VARCHAR(500) DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  duration_ms INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_api_key_id (api_key_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
) ENGINE=InnoDB;
