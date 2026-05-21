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
  credit DECIMAL(12,4) NOT NULL DEFAULT 25.0000,
  total_spent DECIMAL(14,6) NOT NULL DEFAULT 0.000000,
  api_key VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
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
  type ENUM('topup', 'usage', 'admin_adjust') NOT NULL,
  amount DECIMAL(12,4) NOT NULL,
  balance DECIMAL(12,4) NOT NULL,
  description VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_created (user_id, created_at DESC)
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
