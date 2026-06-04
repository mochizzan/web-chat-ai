/**
 * In-memory rate limiter for OTP verification
 * Note: In production, consider using Redis for distributed rate limiting
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const attempts = new Map<string, RateLimitRecord>();

/**
 * Check if the request is within rate limit
 * @param key - Unique key (e.g., email or IP)
 * @param maxAttempts - Maximum allowed attempts
 * @param windowMs - Time window in milliseconds
 * @returns true if within limit, false if exceeded
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  
  if (!record || now > record.resetTime) {
    attempts.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) return false;
  
  record.count++;
  return true;
}

/**
 * Get remaining attempts and reset time
 */
export function getRateLimitInfo(key: string, maxAttempts: number, windowMs: number): {
  remaining: number;
  resetTime: number;
} {
  const record = attempts.get(key);
  if (!record) {
    return { remaining: maxAttempts - 1, resetTime: Date.now() + windowMs };
  }
  return {
    remaining: Math.max(0, maxAttempts - record.count),
    resetTime: record.resetTime
  };
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

/**
 * Clean up expired entries periodically
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (now > record.resetTime) {
      attempts.delete(key);
    }
  }
}