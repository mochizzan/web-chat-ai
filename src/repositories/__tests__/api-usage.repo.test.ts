import { ApiUsageRepository } from '@/repositories/api-usage.repo';
import { query, querySingle, transaction } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  querySingle: jest.fn(),
  querySimple: jest.fn(),
  transaction: jest.fn().mockImplementation(async (fn: (conn: { execute: jest.Mock }) => Promise<void>) => {
    const mockConn = { execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };
    await fn(mockConn);
  }),
}));

describe('ApiUsageRepository', () => {
  const mockLog = {
    id: 'log-1',
    api_key_id: 'ak_test123',
    user_id: 'user-1',
    model: 'gpt-4o',
    stream: true,
    prompt_tokens: 50,
    completion_tokens: 100,
    total_tokens: 150,
    cost: 0.0025,
    credit_before: 10,
    credit_after: 9.9975,
    status: 'success',
    error_message: null,
    ip_address: '127.0.0.1',
    user_agent: 'test',
    duration_ms: 1200,
    created_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should insert a usage log record', async () => {
      (query as jest.Mock).mockResolvedValue(undefined);

      await ApiUsageRepository.create({
        api_key_id: 'ak_test123',
        user_id: 'user-1',
        model: 'gpt-4o',
        stream: false,
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        cost: 0.001,
        credit_before: 10,
        credit_after: 9.999,
        status: 'success',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        duration_ms: 500,
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_usage_logs'),
        expect.arrayContaining(['ak_test123', 'user-1', 'gpt-4o', 'success'])
      );
    });
  });

  describe('findByApiKeyId', () => {
    it('should return usage logs for a given API key', async () => {
      (query as jest.Mock).mockResolvedValue([mockLog]);

      const result = await ApiUsageRepository.findByApiKeyId('ak_test123', 10);
      expect(result).toHaveLength(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('api_key_id = ?'),
        ['ak_test123', 10, 0]
      );
    });
  });

  describe('findByUserId', () => {
    it('should return usage logs for a user with date range', async () => {
      (query as jest.Mock).mockResolvedValue([mockLog]);

      const result = await ApiUsageRepository.findByUserId('user-1', { period: '7d', limit: 50 });
      expect(result).toHaveLength(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = ?'),
        expect.arrayContaining(['user-1'])
      );
    });
  });

  describe('getSummaryByUser', () => {
    it('should return aggregated usage summary', async () => {
      (querySingle as jest.Mock).mockResolvedValue({
        total_requests: 10,
        total_tokens: 1500,
        total_cost: 0.025,
      });

      const result = await ApiUsageRepository.getSummaryByUser('user-1', '2026-01-01', '2026-12-31');
      expect(result).toEqual({
        total_requests: 10,
        total_tokens: 1500,
        total_cost: 0.025,
      });
    });

    it('should return zeroed summary when no data', async () => {
      (querySingle as jest.Mock).mockResolvedValue(null);

      const result = await ApiUsageRepository.getSummaryByUser('user-1', '2026-01-01', '2026-12-31');
      expect(result).toBeNull();
    });
  });

  describe('getSummaryByApiKeyId', () => {
    it('should return aggregated summary for a specific API key', async () => {
      (querySingle as jest.Mock).mockResolvedValue({
        total_requests: 5,
        total_tokens: 750,
        total_cost: 0.0125,
      });

      const result = await ApiUsageRepository.getSummaryByApiKeyId('ak_test123', '2026-01-01', '2026-12-31');
      expect(result.total_requests).toBe(5);
    });
  });

  describe('updateStatus', () => {
    it('should update the status of a usage log', async () => {
      (query as jest.Mock).mockResolvedValue(undefined);

      await ApiUsageRepository.updateStatus('log-1', 'error');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_usage_logs'),
        ['error', 'log-1']
      );
    });
  });
});
