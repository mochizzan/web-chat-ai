/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnalyticsRepository } from '@/repositories/analytics.repo';

function getPeriodInterval(period: string): string {
  switch (period) {
    case 'today': return 'UTC_DATE() - INTERVAL 7 HOUR';
    case '24h': return 'NOW() - INTERVAL 1 DAY';
    case '7d': return 'NOW() - INTERVAL 7 DAY';
    case '30d': return 'NOW() - INTERVAL 30 DAY';
    case '1y': return 'NOW() - INTERVAL 1 YEAR';
    default: return 'NOW() - INTERVAL 30 DAY';
  }
}

function getTimeGrouping(period: string, granularity: string): { selectExpr: string; groupExpr: string } {
  const wib = 'created_at + INTERVAL 7 HOUR';

  if (granularity === 'minute' && (period === 'today' || period === '24h')) {
    const fmt = `DATE_FORMAT(${wib}, '%Y-%m-%d %H:%i')`;
    return { selectExpr: `${fmt} as time`, groupExpr: fmt };
  }

  if (granularity === 'hour' && (period === 'today' || period === '24h')) {
    const fmt = `DATE_FORMAT(${wib}, '%Y-%m-%d %H:00')`;
    return { selectExpr: `${fmt} as time`, groupExpr: fmt };
  }

  const fmt = `DATE_FORMAT(${wib}, '%Y-%m-%d')`;
  return { selectExpr: `${fmt} as time`, groupExpr: fmt };
}

export const AnalyticsService = {
  async getDashboardStats(period: string, granularity: string) {
    const interval = getPeriodInterval(period);
    const timeGrouping = getTimeGrouping(period, granularity);

    const [
      totalUsersResult,
      newUsersResult,
      convMsgResult,
      revenueResult,
      profitResult,
      activeUsersResult,
      usageSummaryResult,
      requestsPerModelResult,
      tokenByProviderResult,
      usageOverTimeResult,
      topUsersResult,
      modelCountsResult,
      newUsersOverTimeResult,
    ] = await Promise.all([
      AnalyticsRepository.getTotalUsers(),
      AnalyticsRepository.getNewUsersStats(),
      AnalyticsRepository.getConversationAndMessageCounts(),
      AnalyticsRepository.getRevenueStats(),
      AnalyticsRepository.getProfitStats(),
      AnalyticsRepository.getActiveUsers(interval),
      AnalyticsRepository.getUsageSummary(interval),
      AnalyticsRepository.getRequestsPerModel(interval),
      AnalyticsRepository.getTokenByProvider(interval),
      AnalyticsRepository.getUsageOverTime(interval, timeGrouping),
      AnalyticsRepository.getTopUsers(interval),
      AnalyticsRepository.getModelCounts(),
      AnalyticsRepository.getNewUsersOverTime(interval, timeGrouping),
    ]);

    const totalUsers = totalUsersResult?.total || 0;
    const newUsers24h = newUsersResult?.new_users_24h || 0;
    const newUsers7d = newUsersResult?.new_users_7d || 0;
    const totalConversations = convMsgResult?.total_conversations || 0;
    const totalMessages = convMsgResult?.total_messages || 0;
    const totalRevenue = Number(revenueResult?.total || 0);
    const profit = Number(profitResult?.profit || 0);
    const activeUsers30d = activeUsersResult?.active || 0;
    const totalRequests = usageSummaryResult?.total_requests || 0;
    const totalTokens = Number(usageSummaryResult?.total_tokens || 0);
    const totalCost = Number(usageSummaryResult?.total_cost || 0);
    const avgTokensPerRequest = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;
    const totalModels = modelCountsResult?.total_models || 0;
    const activeModels = modelCountsResult?.active_models || 0;

    return {
      summary: {
        totalUsers,
        newUsers24h,
        newUsers7d,
        activeUsers30d,
        totalConversations,
        totalMessages,
        totalRevenue,
        totalCost,
        profit,
        totalRequests,
        totalTokens,
        avgTokensPerRequest,
        totalModels,
        activeModels,
      },
      requestsPerModel: (requestsPerModelResult || []).map((r: any) => ({
        name: r.name,
        requests: r.requests,
      })),
      usageOverTime: (usageOverTimeResult || []).map((r: any) => ({
        time: String(r.time),
        tokens: Number(r.tokens),
      })),
      tokenByProvider: (tokenByProviderResult || []).map((r: any) => ({
        name: r.provider,
        value: Number(r.value),
      })),
      newUsersOverTime: (newUsersOverTimeResult || []).map((r: any) => ({
        date: String(r.date),
        count: r.count,
      })),
      topUsersBySpending: (topUsersResult || []).map((r: any) => ({
        name: r.name,
        email: r.email,
        totalSpent: Number(r.total_spent),
        credit: Number(r.credit),
        requestCount: r.request_count,
      })),
    };
  },
};
