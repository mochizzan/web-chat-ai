import { AnalyticsRepository } from '@/repositories/analytics.repo';
import { query, querySingle } from '@/lib/db';

// Mock the database module
jest.mock('@/lib/db');

describe('AnalyticsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue([]);
    (querySingle as jest.Mock).mockResolvedValue(null);
  });

  describe('getTotalUsers', () => {
    it('should get total user count', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ total: 150 });

      const result = await AnalyticsRepository.getTotalUsers();

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as total FROM users')
      );
      expect(result).toEqual({ total: 150 });
    });

    it('should return 0 when no users', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ total: 0 });

      const result = await AnalyticsRepository.getTotalUsers();

      expect(result).toEqual({ total: 0 });
    });
  });

  describe('getNewUsersStats', () => {
    it('should get new users stats for 24h and 7d', async () => {
      (querySingle as jest.Mock).mockResolvedValue({
        new_users_24h: 10,
        new_users_7d: 50
      });

      const result = await AnalyticsRepository.getNewUsersStats();

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining('SUM(CASE WHEN created_at >= NOW() - INTERVAL 1 DAY')
      );
      expect(result).toEqual({
        new_users_24h: 10,
        new_users_7d: 50
      });
    });

    it('should handle null/undefined values', async () => {
      (querySingle as jest.Mock).mockResolvedValue({});

      const result = await AnalyticsRepository.getNewUsersStats();

      expect(result.new_users_24h).toBeUndefined();
      expect(result.new_users_7d).toBeUndefined();
    });
  });

  describe('getConversationAndMessageCounts', () => {
    it('should get total conversations and messages', async () => {
      (querySingle as jest.Mock).mockResolvedValue({
        total_conversations: 500,
        total_messages: 2500
      });

      const result = await AnalyticsRepository.getConversationAndMessageCounts();

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) FROM conversations')
      );
      expect(result).toEqual({
        total_conversations: 500,
        total_messages: 2500
      });
    });
  });

  describe('getRevenueStats', () => {
    it('should get total revenue from topups', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ total: 5000 });

      const result = await AnalyticsRepository.getRevenueStats();

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COALESCE(SUM(amount), 0) as total FROM credit_logs WHERE type = 'topup'")
      );
      expect(result).toEqual({ total: 5000 });
    });

    it('should return 0 when no revenue', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ total: 0 });

      const result = await AnalyticsRepository.getRevenueStats();

      expect(result).toEqual({ total: 0 });
    });
  });

  describe('getProfitStats', () => {
    it('should calculate profit (revenue - costs)', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ profit: 2500 });

      const result = await AnalyticsRepository.getProfitStats();

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE((SELECT SUM(amount) FROM credit_logs')
      );
      expect(result).toEqual({ profit: 2500 });
    });

    it('should return 0 profit when no data', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ profit: 0 });

      const result = await AnalyticsRepository.getProfitStats();

      expect(result).toEqual({ profit: 0 });
    });
  });

  describe('getActiveUsers', () => {
    it('should get active users count for given interval', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ active: 100 });

      const result = await AnalyticsRepository.getActiveUsers('NOW() - INTERVAL 7 DAY');

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COUNT(DISTINCT user_id) as active FROM usage_logs WHERE created_at >=")
      );
      expect(result).toEqual({ active: 100 });
    });

    it('should handle different intervals', async () => {
      await AnalyticsRepository.getActiveUsers('NOW() - INTERVAL 1 DAY');

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COUNT(DISTINCT user_id) as active FROM usage_logs WHERE created_at >=")
      );
    });
  });

  describe('getUsageSummary', () => {
    it('should get usage summary for interval', async () => {
      (querySingle as jest.Mock).mockResolvedValue({
        total_requests: 1000,
        total_tokens: 50000,
        total_cost: 100
      });

      const result = await AnalyticsRepository.getUsageSummary('NOW() - INTERVAL 7 DAY');

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total_requests')
      );
      expect(result).toEqual({
        total_requests: 1000,
        total_tokens: 50000,
        total_cost: 100
      });
    });

    it('should return zeros when no usage', async () => {
      (querySingle as jest.Mock).mockResolvedValue({
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0
      });

      const result = await AnalyticsRepository.getUsageSummary('NOW() - INTERVAL 1 DAY');

      expect(result).toEqual({
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0
      });
    });
  });

  describe('getRequestsPerModel', () => {
    it('should get requests grouped by model', async () => {
      const mockData = [
        { name: 'gpt-4', requests: 500 },
        { name: 'gpt-3.5', requests: 300 }
      ];
      (query as jest.Mock).mockResolvedValue(mockData);

      const result = await AnalyticsRepository.getRequestsPerModel('NOW() - INTERVAL 7 DAY');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT model_name as name, COUNT(*) as requests')
      );
      expect(result).toEqual(mockData);
    });

    it('should handle empty result', async () => {
      (query as jest.Mock).mockResolvedValue([]);

      const result = await AnalyticsRepository.getRequestsPerModel('NOW() - INTERVAL 1 DAY');

      expect(result).toEqual([]);
    });
  });

  describe('getTokenByProvider', () => {
    it('should get token usage grouped by provider', async () => {
      const mockData = [
        { provider: 'openai', value: 45000 },
        { provider: 'anthropic', value: 5000 }
      ];
      (query as jest.Mock).mockResolvedValue(mockData);

      const result = await AnalyticsRepository.getTokenByProvider('NOW() - INTERVAL 7 DAY');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT provider, SUM(input_tokens + output_tokens) as value')
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('getUsageOverTime', () => {
    it('should get usage over time with custom grouping', async () => {
      const mockData = [
        { time: '2024-01-01', tokens: 10000 },
        { time: '2024-01-02', tokens: 12000 }
      ];
      (query as jest.Mock).mockResolvedValue(mockData);

      const result = await AnalyticsRepository.getUsageOverTime(
        'NOW() - INTERVAL 7 DAY',
        { selectExpr: 'DATE(created_at) as time', groupExpr: 'DATE(created_at)' }
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DATE(created_at) as time, SUM(input_tokens + output_tokens) as tokens')
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('getTopUsers', () => {
    it('should get top 10 users by total spent', async () => {
      const mockData = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          total_spent: 1000,
          credit: 500,
          request_count: 150
        }
      ];
      (query as jest.Mock).mockResolvedValue(mockData);

      const result = await AnalyticsRepository.getTopUsers('NOW() - INTERVAL 30 DAY');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('u.name, u.email, u.total_spent, u.credit')
      );
      expect(result).toEqual(mockData);
      expect(result).toHaveLength(1);
    });

    it('should limit to 10 users', async () => {
      (query as jest.Mock).mockResolvedValue([]);

      await AnalyticsRepository.getTopUsers('NOW() - INTERVAL 7 DAY');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 10')
      );
    });
  });

  describe('getModelCounts', () => {
    it('should get total and active model counts', async () => {
      (querySingle as jest.Mock).mockResolvedValue({
        total_models: 20,
        active_models: 10
      });

      const result = await AnalyticsRepository.getModelCounts();

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining('(SELECT COUNT(*) FROM models) as total_models')
      );
      expect(result).toEqual({
        total_models: 20,
        active_models: 10
      });
    });
  });

  describe('getNewUsersOverTime', () => {
    it('should get new users over time with custom grouping', async () => {
      const mockData = [
        { date: '2024-01-01', count: 5 },
        { date: '2024-01-02', count: 8 }
      ];
      (query as jest.Mock).mockResolvedValue(mockData);

      const result = await AnalyticsRepository.getNewUsersOverTime(
        'NOW() - INTERVAL 30 DAY',
        { selectExpr: 'DATE(created_at) as time', groupExpr: 'DATE(created_at)' }
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DATE(created_at) as date, COUNT(*) as count')
      );
      expect(result).toEqual(mockData);
    });

    it('should replace "as time" with "as date" in selectExpr', async () => {
      (query as jest.Mock).mockResolvedValue([]);

      await AnalyticsRepository.getNewUsersOverTime(
        'NOW() - INTERVAL 7 DAY',
        { selectExpr: 'WEEK(created_at) as time', groupExpr: 'WEEK(created_at)' }
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT WEEK(created_at) as date')
      );
    });
  });
});
