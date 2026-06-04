import { ApiRateLimiter } from '@/lib/api-rate-limiter';

describe('ApiRateLimiter', () => {
  let limiter: ApiRateLimiter;

  beforeEach(() => {
    limiter = new ApiRateLimiter({ maxRequests: 10, windowMs: 1000 }); // 10 requests per second for testing
  });

  afterEach(() => {
    limiter.stopCleanup();
  });

  describe('check', () => {
    it('should allow first request', () => {
      const result = limiter.check('key-1');
      expect(result).toBe(true);
    });

    it('should allow requests within limit', () => {
      for (let i = 0; i < 10; i++) {
        const result = limiter.check('key-1');
        expect(result).toBe(true);
      }
    });

    it('should block requests exceeding limit', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('key-1');
      }
      const result = limiter.check('key-1');
      expect(result).toBe(false);
    });

    it('should track different keys independently', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('key-1');
      }
      // key-1 should be blocked
      expect(limiter.check('key-1')).toBe(false);
      // key-2 should be allowed (different key)
      expect(limiter.check('key-2')).toBe(true);
    });

    it('should reset after window expires', (done) => {
      limiter = new ApiRateLimiter({ maxRequests: 1, windowMs: 100 }); // 1 request per 100ms
      expect(limiter.check('key-1')).toBe(true);
      expect(limiter.check('key-1')).toBe(false);

      setTimeout(() => {
        expect(limiter.check('key-1')).toBe(true);
        done();
      }, 150);
    });
  });

  describe('getStatus', () => {
    it('should return correct status for a key', () => {
      limiter.check('key-1');
      limiter.check('key-1');
      const status = limiter.getStatus('key-1');
      expect(status).toHaveProperty('remaining');
      expect(status).toHaveProperty('limit');
      expect(status.remaining).toBe(8);
      expect(status.limit).toBe(10);
    });

    it('should return default status for unknown key', () => {
      const status = limiter.getStatus('unknown-key');
      expect(status.remaining).toBe(10);
      expect(status.limit).toBe(10);
    });
  });

  describe('reset', () => {
    it('should reset window for a specific key', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('key-1');
      }
      expect(limiter.check('key-1')).toBe(false);

      limiter.reset('key-1');
      expect(limiter.check('key-1')).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should reset all keys', () => {
      limiter.check('key-1');
      limiter.check('key-2');
      limiter.resetAll();
      expect(limiter.getStatus('key-1').remaining).toBe(10);
      expect(limiter.getStatus('key-2').remaining).toBe(10);
    });
  });
});
