// Centralized configuration for the application
// This file serves as the single source of truth for configuration values

/**
 * JWT Secret for authentication
 * @description Should be set via environment variable JWT_SECRET
 * @default fallback_secret_key_change_in_production - Only used if environment variable is not set
 */
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';

// Add other centralized configuration values here as needed