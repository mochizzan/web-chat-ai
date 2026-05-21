/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, querySingle } from '@/lib/db';

export const AnalyticsRepository = {
  async getTotalUsers() {
    return await querySingle<{ total: number }>('SELECT COUNT(*) as total FROM users');
  },

  async getNewUsersStats() {
    return await querySingle<{ new_users_24h: number; new_users_7d: number }>(
      `SELECT
        SUM(CASE WHEN created_at >= NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) as new_users_24h,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) as new_users_7d
      FROM users`
    );
  },

  async getConversationAndMessageCounts() {
    return await querySingle<{ total_conversations: number; total_messages: number }>(
      `SELECT
        (SELECT COUNT(*) FROM conversations) as total_conversations,
        (SELECT COUNT(*) FROM messages) as total_messages`
    );
  },

  async getRevenueStats() {
    return await querySingle<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM credit_logs WHERE type = 'topup'`
    );
  },

  async getProfitStats() {
    return await querySingle<{ profit: number }>(
      `SELECT
        COALESCE((SELECT SUM(amount) FROM credit_logs WHERE type='topup'), 0) -
        COALESCE((SELECT SUM(total_cost) FROM usage_logs), 0) as profit`
    );
  },

  async getActiveUsers(interval: string) {
    return await querySingle<{ active: number }>(
      `SELECT COUNT(DISTINCT user_id) as active FROM usage_logs WHERE created_at >= ${interval}`
    );
  },

  async getUsageSummary(interval: string) {
    return await querySingle<{ total_requests: number; total_tokens: number; total_cost: number }>(
      `SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM usage_logs
      WHERE created_at >= ${interval}`
    );
  },

  async getRequestsPerModel(interval: string) {
    return await query<any[]>(
      `SELECT model_name as name, COUNT(*) as requests
      FROM usage_logs
      WHERE created_at >= ${interval}
      GROUP BY model_name
      ORDER BY requests DESC`
    );
  },

  async getTokenByProvider(interval: string) {
    return await query<any[]>(
      `SELECT provider, SUM(input_tokens + output_tokens) as value
      FROM usage_logs
      WHERE created_at >= ${interval}
      GROUP BY provider`
    );
  },

  async getUsageOverTime(interval: string, timeGrouping: { selectExpr: string; groupExpr: string }) {
    return await query<any[]>(
      `SELECT ${timeGrouping.selectExpr}, SUM(input_tokens + output_tokens) as tokens
      FROM usage_logs
      WHERE created_at >= ${interval}
      GROUP BY ${timeGrouping.groupExpr}
      ORDER BY time`
    );
  },

  async getTopUsers(interval: string) {
    return await query<any[]>(
      `SELECT
        u.name, u.email, u.total_spent, u.credit,
        (SELECT COUNT(*) FROM usage_logs ul WHERE ul.user_id = u.id AND ul.created_at >= ${interval}) as request_count
      FROM users u
      ORDER BY u.total_spent DESC
      LIMIT 10`
    );
  },

  async getModelCounts() {
    return await querySingle<{ total_models: number; active_models: number }>(
      `SELECT
        (SELECT COUNT(*) FROM models) as total_models,
        (SELECT COUNT(*) FROM models WHERE status='active') as active_models`
    );
  },

  async getNewUsersOverTime(interval: string, timeGrouping: { selectExpr: string; groupExpr: string }) {
    return await query<any[]>(
      `SELECT ${timeGrouping.selectExpr.replace(' as time', ' as date')}, COUNT(*) as count
      FROM users
      WHERE created_at >= ${interval}
      GROUP BY ${timeGrouping.groupExpr}
      ORDER BY date`
    );
  },

};
