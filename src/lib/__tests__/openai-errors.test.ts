import { oaiError, oaiAuthError, oaiQuotaError, oaiModelNotFound, oaiRateLimitError, oaiBadGateway } from '@/lib/openai-errors';

describe('openai-errors', () => {
  describe('oaiError', () => {
    it('should return a Response with correct error shape', async () => {
      const res = oaiError('Test error', 400, 'invalid_request_error', 'test-param');
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('message', 'Test error');
      expect(body.error).toHaveProperty('type', 'invalid_request_error');
      expect(body.error).toHaveProperty('code', 'invalid_request_error');
      expect(body.error).toHaveProperty('param', 'test-param');
    });

    it('should default to 500 when no status given', async () => {
      const res = oaiError('Server error');
      expect(res.status).toBe(500);
    });

    it('should include the correct Content-Type header', () => {
      const res = oaiError('Error');
      expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    });
  });

  describe('oaiAuthError', () => {
    it('should return 401 with authentication_error type', async () => {
      const res = oaiAuthError('Invalid API key');
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error.type).toBe('authentication_error');
      expect(body.error.code).toBe('invalid_api_key');
    });
  });

  describe('oaiQuotaError', () => {
    it('should return 402 with insufficient_quota type', async () => {
      const res = oaiQuotaError('Insufficient credit balance');
      expect(res.status).toBe(402);

      const body = await res.json();
      expect(body.error.type).toBe('insufficient_quota');
      expect(body.error.code).toBe('insufficient_quota');
    });
  });

  describe('oaiModelNotFound', () => {
    it('should return 404 with not_found type and model_not_found code', async () => {
      const res = oaiModelNotFound('gpt-5');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error.type).toBe('not_found');
      expect(body.error.code).toBe('model_not_found');
      expect(body.error.message).toContain('gpt-5');
    });

    it('should not expose available models in the error message', async () => {
      const res = oaiModelNotFound('unknown-model');
      const body = await res.json();
      // Should NOT contain references to OmniRouter or internal model list
      expect(body.error.message).not.toMatch(/omnirouter|internal|available models/i);
    });
  });

  describe('oaiRateLimitError', () => {
    it('should return 429 with rate_limit_error type', async () => {
      const res = oaiRateLimitError('Too many requests');
      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body.error.type).toBe('rate_limit_error');
      expect(body.error.code).toBe('rate_limit_exceeded');
    });
  });

  describe('oaiBadGateway', () => {
    it('should return 502 with bad_gateway type', async () => {
      const res = oaiBadGateway();
      expect(res.status).toBe(502);

      const body = await res.json();
      expect(body.error.type).toBe('bad_gateway');
      expect(body.error.code).toBe('bad_gateway');
    });
  });
});
