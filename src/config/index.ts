// Centralized configuration for the application
// This file serves as the single source of truth for configuration values

/**
 * JWT Secret for authentication
 * @description Should be set via environment variable JWT_SECRET
 * @default fallback_secret_key_change_in_production - Only used if environment variable is not set
 */
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';

/**
 * Bonus credit amount awarded to new accounts after email verification.
 * @description Configure via BONUS_CREDIT_AMOUNT environment variable. Set to 0 to disable.
 * @default 5
 */
export const BONUS_CREDIT_AMOUNT = Number(process.env.BONUS_CREDIT_AMOUNT || '5');

/**
 * Default credit amount for newly registered users (before email verification).
 * @description Configure via DEFAULT_CREDIT_AMOUNT environment variable.
 * @default 0
 */
export const DEFAULT_CREDIT_AMOUNT = Number(process.env.DEFAULT_CREDIT_AMOUNT || '0');

/**
 * API Key secret for generating user API keys (BYOK).
 * @description Should be set via environment variable API_KEY_SECRET.
 * Used as additional entropy when generating API keys.
 * @default 'byok-secret-change-in-production'
 */
export const API_KEY_SECRET = process.env.API_KEY_SECRET || 'byok-secret-change-in-production';

/**
 * API Gateway timeout in milliseconds for proxying requests to OmniRouter.
 * @description Configure via API_GATEWAY_TIMEOUT_MS environment variable.
 * @default 60000 (60 seconds)
 */
export const API_GATEWAY_TIMEOUT_MS = Number(process.env.API_GATEWAY_TIMEOUT_MS || '60000');

/**
 * Maximum tokens for API gateway responses.
 * @description Configure via API_GATEWAY_MAX_TOKENS environment variable.
 * @default 4096
 */
export const API_GATEWAY_MAX_TOKENS = Number(process.env.API_GATEWAY_MAX_TOKENS || '4096');

/**
 * Rate limit per API key per minute.
 * @description Configure via API_RATE_LIMIT_PER_MINUTE environment variable.
 * @default 60
 */
export const API_RATE_LIMIT_PER_MINUTE = Number(process.env.API_RATE_LIMIT_PER_MINUTE || '60');

/**
 * Maximum number of active API keys per user.
 * @description Configure via API_KEY_MAX_PER_USER environment variable.
 * @default 5
 */
export const API_KEY_MAX_PER_USER = Number(process.env.API_KEY_MAX_PER_USER || '5');

/**
 * API key prefix for generated keys.
 * @description Configure via API_KEY_PREFIX environment variable.
 * @default 'mi-'
 */
export const API_KEY_PREFIX = process.env.API_KEY_PREFIX || 'mi-';

// Add other centralized configuration values here as needed
