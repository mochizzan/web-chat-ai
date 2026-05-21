import { AnalyticsService } from '../analytics.service';
import { AnalyticsRepository } from '@/repositories/analytics.repo';

// Mock dependencies
jest.mock('@/repositories/analytics.repo');

const mockedAnalyticsRepository = AnalyticsRepository as jest.Mocked<typeof AnalyticsRepository>;

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should aggregate all analytics data correctly', async () => {
      const period = '30d';
      const granularity = 'day';

      // Mock repository responses
      mockedAnalyticsRepository.getTotalUsers.mockResolvedValue({ total: 100 });
      mockedAnalyticsRepository.getNewUsersStats.mockResolvedValue({
        new_users_24h: 10,
        new_users_7d: 50,
      });
      mockedAnalyticsRepository.getConversationAndMessageCounts.mockResolvedValue({
        total_conversations: 500,
        total_messages: 2000,
      });
      mockedAnalyticsRepository.getRevenueStats.mockResolvedValue({ total: 1000 });
      mockedAnalyticsRepository.getProfitStats.mockResolvedValue({ profit: 800 });
      mockedAnalyticsRepository.getActiveUsers.mockResolvedValue({ active: 75 });
      mockedAnalyticsRepository.getUsageSummary.mockResolvedValue({
        total_requests: 1500,
        total_tokens: 75000,
        total_cost: 50,
      });
      mockedAnalyticsRepository.getRequestsPerModel.mockResolvedValue([
        { name: 'GPT-4o', requests: 1000 },
        { name: 'Claude-3', requests: 500 },
      ]);
      mockedAnalyticsRepository.getTokenByProvider.mockResolvedValue([
        { provider: 'openai', value: 50000 },
        { provider: 'anthropic', value: 25000 },
      ]);
      mockedAnalyticsRepository.getUsageOverTime.mockResolvedValue([
        { time: '2024-01-01', tokens: 1000 },
        { time: '2024-01-02', tokens: 2000 },
      ]);
      mockedAnalyticsRepository.getTopUsers.mockResolvedValue([
        { name: 'User 1', email: 'user1@example.com', total_spent: 100, credit: 50, request_count: 100 },
        { name: 'User 2', email: 'user2@example.com', total_spent: 80, credit: 30, request_count: 80 },
      ]);
      mockedAnalyticsRepository.getModelCounts.mockResolvedValue({
        total_models: 10,
        active_models: 5,
      });
      mockedAnalyticsRepository.getNewUsersOverTime.mockResolvedValue([
        { date: '2024-01-01', count: 5 },
        { date: '2024-01-02', count: 10 },
      ]);

      const result = await AnalyticsService.getDashboardStats(period, granularity);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('requestsPerModel');
      expect(result).toHaveProperty('usageOverTime');
      expect(result).toHaveProperty('tokenByProvider');
      expect(result).toHaveProperty('newUsersOverTime');
      expect(result).toHaveProperty('topUsersBySpending');

      // Check summary values
      expect(result.summary.totalUsers).toBe(100);
      expect(result.summary.newUsers24h).toBe(10);
      expect(result.summary.newUsers7d).toBe(50);
      expect(result.summary.totalConversations).toBe(500);
      expect(result.summary.totalMessages).toBe(2000);
      expect(result.summary.totalRevenue).toBe(1000);
      expect(result.summary.profit).toBe(800);
      expect(result.summary.activeUsers30d).toBe(75);
      expect(result.summary.totalRequests).toBe(1500);
      expect(result.summary.totalTokens).toBe(75000);
      expect(result.summary.avgTokensPerRequest).toBe(50); // 75000 / 1500 = 50
      expect(result.summary.totalModels).toBe(10);
      expect(result.summary.activeModels).toBe(5);

      // Check arrays
      expect(result.requestsPerModel).toHaveLength(2);
      expect(result.usageOverTime).toHaveLength(2);
      expect(result.tokenByProvider).toHaveLength(2);
      expect(result.newUsersOverTime).toHaveLength(2);
      expect(result.topUsersBySpending).toHaveLength(2);
    });

    it('should handle null/undefined values from repositories', async () => {
      mockedAnalyticsRepository.getTotalUsers.mockResolvedValue(null);
      mockedAnalyticsRepository.getNewUsersStats.mockResolvedValue(null);
      mockedAnalyticsRepository.getConversationAndMessageCounts.mockResolvedValue(null);
      mockedAnalyticsRepository.getRevenueStats.mockResolvedValue(null);
      mockedAnalyticsRepository.getProfitStats.mockResolvedValue(null);
      mockedAnalyticsRepository.getActiveUsers.mockResolvedValue(null);
      mockedAnalyticsRepository.getUsageSummary.mockResolvedValue(null);
      mockedAnalyticsRepository.getRequestsPerModel.mockResolvedValue(null);
      mockedAnalyticsRepository.getTokenByProvider.mockResolvedValue(null);
      mockedAnalyticsRepository.getUsageOverTime.mockResolvedValue(null);
      mockedAnalyticsRepository.getTopUsers.mockResolvedValue(null);
      mockedAnalyticsRepository.getModelCounts.mockResolvedValue(null);
      mockedAnalyticsRepository.getNewUsersOverTime.mockResolvedValue(null);

      const result = await AnalyticsService.getDashboardStats('30d', 'day');

      expect(result.summary.totalUsers).toBe(0);
      expect(result.summary.newUsers24h).toBe(0);
      expect(result.summary.newUsers7d).toBe(0);
      expect(result.summary.totalConversations).toBe(0);
      expect(result.summary.totalMessages).toBe(0);
      expect(result.summary.totalRevenue).toBe(0);
      expect(result.summary.profit).toBe(0);
      expect(result.summary.activeUsers30d).toBe(0);
      expect(result.summary.totalRequests).toBe(0);
      expect(result.summary.totalTokens).toBe(0);
      expect(result.summary.totalCost).toBe(0);
      expect(result.summary.avgTokensPerRequest).toBe(0);
      expect(result.summary.totalModels).toBe(0);
      expect(result.summary.activeModels).toBe(0);

      expect(result.requestsPerModel).toEqual([]);
      expect(result.usageOverTime).toEqual([]);
      expect(result.tokenByProvider).toEqual([]);
      expect(result.newUsersOverTime).toEqual([]);
      expect(result.topUsersBySpending).toEqual([]);
    });

    it('should calculate avgTokensPerRequest as 0 when totalRequests is 0', async () => {
      mockedAnalyticsRepository.getTotalUsers.mockResolvedValue({ total: 100 });
      mockedAnalyticsRepository.getNewUsersStats.mockResolvedValue({
        new_users_24h: 10,
        new_users_7d: 50,
      });
      mockedAnalyticsRepository.getConversationAndMessageCounts.mockResolvedValue({
        total_conversations: 0,
        total_messages: 0,
      });
      mockedAnalyticsRepository.getRevenueStats.mockResolvedValue({ total: 0 });
      mockedAnalyticsRepository.getProfitStats.mockResolvedValue({ profit: 0 });
      mockedAnalyticsRepository.getActiveUsers.mockResolvedValue({ active: 0 });
      mockedAnalyticsRepository.getUsageSummary.mockResolvedValue({
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0,
      });
      mockedAnalyticsRepository.getRequestsPerModel.mockResolvedValue([]);
      mockedAnalyticsRepository.getTokenByProvider.mockResolvedValue([]);
      mockedAnalyticsRepository.getUsageOverTime.mockResolvedValue([]);
      mockedAnalyticsRepository.getTopUsers.mockResolvedValue([]);
      mockedAnalyticsRepository.getModelCounts.mockResolvedValue({ total_models: 0, active_models: 0 });
      mockedAnalyticsRepository.getNewUsersOverTime.mockResolvedValue([]);

      const result = await AnalyticsService.getDashboardStats('30d', 'day');

      expect(result.summary.avgTokensPerRequest).toBe(0);
    });
  });
});
