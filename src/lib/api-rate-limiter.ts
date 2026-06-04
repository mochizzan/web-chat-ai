import { API_RATE_LIMIT_PER_MINUTE } from '@/config';

/**
 * Per-API-key rate limiter using in-memory sliding window.
 *
 * This is a separate limiter from the existing OTP rate limiter (src/lib/rate-limiter.ts).
 * It tracks requests per individual API key ID to prevent abuse.
 *
 * Architecture:
 * - In-memory Map<apiKeyId, timestamps[]>
 * - Sliding window: counts requests within the last `windowMs` milliseconds
 * - Auto-cleanup every 5 minutes
 *
 * @example
 * const limiter = new ApiRateLimiter();
 * if (!limiter.check('key_123')) {
 *   return oaiRateLimitError();
 * }
 */

interface RateLimitConfig {
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: API_RATE_LIMIT_PER_MINUTE,
  windowMs: 60_000, // 1 minute
};

export class ApiRateLimiter {
  private store: Map<string, number[]>;
  private config: RateLimitConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.store = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Check if a request should be allowed for the given API key.
   * Returns true if allowed, false if rate limited.
   */
  check(apiKeyId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing timestamps for this key
    let timestamps = this.store.get(apiKeyId);

    // Filter out expired timestamps
    if (timestamps) {
      timestamps = timestamps.filter((t) => t > windowStart);
    }

    // If at or above limit, reject
    if (timestamps && timestamps.length >= this.config.maxRequests) {
      this.store.set(apiKeyId, timestamps);
      return false;
    }

    // Add current timestamp
    const updated = timestamps ?? [];
    updated.push(now);
    this.store.set(apiKeyId, updated);

    return true;
  }

  /**
   * Get current rate limit status for an API key.
   */
  getStatus(apiKeyId: string): {
    remaining: number;
    limit: number;
    resetMs: number;
  } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = this.store.get(apiKeyId)?.filter((t) => t > windowStart) ?? [];

    const oldest = timestamps.length > 0 ? Math.min(...timestamps) : now;
    const resetMs = oldest + this.config.windowMs - now;

    return {
      remaining: Math.max(0, this.config.maxRequests - timestamps.length),
      limit: this.config.maxRequests,
      resetMs: Math.max(0, resetMs),
    };
  }

  /**
   * Reset rate limit counter for a specific API key.
   */
  reset(apiKeyId: string): void {
    this.store.delete(apiKeyId);
  }

  /**
   * Reset all rate limit counters.
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * Start periodic cleanup of expired entries.
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      for (const [key, timestamps] of this.store.entries()) {
        const filtered = timestamps.filter((t) => t > windowStart);
        if (filtered.length === 0) {
          this.store.delete(key);
        } else {
          this.store.set(key, filtered);
        }
      }
    }, 300_000); // 5 minutes

    // Allow the process to exit even if this interval is still running
    if (this.cleanupInterval && typeof this.cleanupInterval === 'object') {
      this.cleanupInterval.unref?.();
    }
  }

  /**
   * Stop the cleanup interval (for testing or cleanup).
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Singleton instance for production use.
 * Exported so it persists across module reloads in development.
 */
export const apiRateLimiter = new ApiRateLimiter();
