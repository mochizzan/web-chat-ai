/**
 * Email configuration for SMTP
 */

export const EMAIL_USER = process.env.EMAIL_USER || '';
export const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD || '';

// OTP expiry time in minutes
export const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

// Rate limiting configuration
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10); // 1 hour
export const RATE_LIMIT_MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '3', 10);

// Validate email configuration
export function validateEmailConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!EMAIL_USER) missing.push('EMAIL_USER');
  if (!EMAIL_APP_PASSWORD) missing.push('EMAIL_APP_PASSWORD');
  
  return {
    valid: missing.length === 0,
    missing
  };
}