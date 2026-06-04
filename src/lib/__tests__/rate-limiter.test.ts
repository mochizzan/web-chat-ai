import { checkRateLimit, getRateLimitInfo, resetRateLimit, cleanupExpiredEntries } from '@/lib/rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Reset rate limiter state before each test
    resetRateLimit('test-key');
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-key', 3, 60000);
      expect(result).toBe(true);
    });

    it('should allow requests within limit', () => {
      checkRateLimit('test-key', 3, 60000);
      checkRateLimit('test-key', 3, 60000);
      const result = checkRateLimit('test-key', 3, 60000);
      expect(result).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      checkRateLimit('test-key', 3, 60000);
      checkRateLimit('test-key', 3, 60000);
      checkRateLimit('test-key', 3, 60000);
      const result = checkRateLimit('test-key', 3, 60000);
      expect(result).toBe(false);
    });

    it('should reset after window expires', (done) => {
      checkRateLimit('test-key', 1, 100); // 100ms window
      
      // Should be blocked immediately
      expect(checkRateLimit('test-key', 1, 100)).toBe(false);
      
      // Wait for window to expire
      setTimeout(() => {
        expect(checkRateLimit('test-key', 1, 100)).toBe(true);
        done();
      }, 150);
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return correct remaining attempts', () => {
      checkRateLimit('test-key', 3, 60000);
      const info = getRateLimitInfo('test-key', 3, 60000);
      // After 1 call, remaining = max - count = 3 - 1 = 2
      expect(info.remaining).toBe(2);
    });

    it('should return max attempts for new key', () => {
      const info = getRateLimitInfo('new-key', 3, 60000);
      // For new key, remaining = max - 1 = 3 - 1 = 2
      expect(info.remaining).toBe(2);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for a key', () => {
      checkRateLimit('test-key', 1, 60000);
      checkRateLimit('test-key', 1, 60000);
      expect(checkRateLimit('test-key', 1, 60000)).toBe(false);
      
      resetRateLimit('test-key');
      expect(checkRateLimit('test-key', 1, 60000)).toBe(true);
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('should clean up expired entries', (done) => {
      checkRateLimit('expired-key', 1, 50);
      
      // Wait for expiration
      setTimeout(() => {
        cleanupExpiredEntries();
        // After cleanup, the key should be reset
        expect(checkRateLimit('expired-key', 1, 50)).toBe(true);
        done();
      }, 100);
    });
  });
});