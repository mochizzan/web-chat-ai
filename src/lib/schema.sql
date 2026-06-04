-- ============================================================
-- ai-chat-web Database Schema — MySQL via mysql2
-- 6 tables with models.status DEFAULT 'disabled'
-- ============================================================

CREATE DATABASE IF NOT EXISTS ai_chat_web
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ai_chat_web;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  avatar VARCHAR(500) DEFAULT NULL,
  credit DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  total_spent DECIMAL(14,6) NOT NULL DEFAULT 0.000000,
  api_key VARCHAR(255) DEFAULT NULL,
  isEmailVerified TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB;

-- 1.5 EMAIL VERIFICATIONS
CREATE TABLE IF NOT EXISTS email_verifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_email (email),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- 2. CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(500) DEFAULT 'New Chat',
  model VARCHAR(100) DEFAULT 'gpt-4o',
  category VARCHAR(50) DEFAULT 'assistant',
  pinned TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_updated (updated_at DESC)
) ENGINE=InnoDB;

-- 3. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content MEDIUMTEXT NOT NULL,
  thinking_content MEDIUMTEXT,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  input_cost DECIMAL(12,8) DEFAULT 0,
  output_cost DECIMAL(12,8) DEFAULT 0,
  total_cost DECIMAL(12,8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  INDEX idx_conv (conversation_id),
  INDEX idx_created (conversation_id, created_at)
) ENGINE=InnoDB;

-- 4. USAGE LOGS
CREATE TABLE IF NOT EXISTS usage_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  conversation_id VARCHAR(64),
  message_id VARCHAR(64),
  model_id VARCHAR(100) NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  input_cost DECIMAL(12,8) DEFAULT 0,
  output_cost DECIMAL(12,8) DEFAULT 0,
  total_cost DECIMAL(12,8) DEFAULT 0,
  category VARCHAR(50) DEFAULT 'assistant',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at DESC),
  INDEX idx_model (model_id)
) ENGINE=InnoDB;

-- 5. CREDIT LOGS
CREATE TABLE IF NOT EXISTS credit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type ENUM('topup', 'deduct', 'admin_set', 'usage', 'bonus') NOT NULL,
  amount DECIMAL(12,4) NOT NULL,
  balance DECIMAL(12,4) NOT NULL,
  previous_balance DECIMAL(12,4) DEFAULT NULL,
  description VARCHAR(500),
  operator_id VARCHAR(64) DEFAULT NULL,
  operator_name VARCHAR(255) DEFAULT NULL,
  note TEXT DEFAULT NULL,
  invoice_number VARCHAR(32) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_created (user_id, created_at DESC),
  INDEX idx_invoice (invoice_number),
  INDEX idx_type (type),
  INDEX idx_operator (operator_id)
) ENGINE=InnoDB;

-- 6. MODELS — sync from OmniRouter, managed by admin
CREATE TABLE IF NOT EXISTS models (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(100) DEFAULT '',
  description TEXT,
  status VARCHAR(20) DEFAULT 'disabled',
  max_context INT DEFAULT 128000,
  thinking TINYINT(1) DEFAULT 0,
  input_price DECIMAL(8,4) DEFAULT 0,
  output_price DECIMAL(8,4) DEFAULT 0,
  free TINYINT(1) DEFAULT 0,

  -- NEW FIELDS: Speed tier
  speed VARCHAR(10) DEFAULT 'normal',

  -- NEW FIELDS: Discount system
  discount_percent DECIMAL(5,2) DEFAULT 0.00,
  discount_type VARCHAR(10) DEFAULT 'none',

  sync_source VARCHAR(50) DEFAULT 'omnirouter',
  sync_data JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_provider (provider)
) ENGINE=InnoDB;

-- 7. API KEYS (BYOK Gateway)
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

-- 8. API USAGE LOGS (BYOK Gateway)
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