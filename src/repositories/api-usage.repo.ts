/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, querySingle, querySimple } from '@/lib/db';
import { PoolConnection } from 'mysql2/promise';

export interface ApiUsageLogRecord {
  id: string;
  api_key_id: string;
  user_id: string;
  model: string;
  stream: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  credit_before: number;
  credit_after: number;
  status: 'success' | 'error' | 'refunded';
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  duration_ms: number | null;
  created_at: Date;
}

export const ApiUsageRepository = {
  /**
   * Create a new API usage log entry.
   */
  async create(log: Partial<ApiUsageLogRecord>, conn?: PoolConnection): Promise<void> {
    const sql = `INSERT INTO api_usage_logs
      (id, api_key_id, user_id, model, stream, prompt_tokens, completion_tokens, total_tokens, cost, credit_before, credit_after, status, error_message, ip_address, user_agent, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      log.id ?? null,
      log.api_key_id ?? null,
      log.user_id ?? null,
      log.model ?? null,
      log.stream ?? 0,
      log.prompt_tokens ?? 0,
      log.completion_tokens ?? 0,
      log.total_tokens ?? 0,
      log.cost ?? 0,
      log.credit_before ?? 0,
      log.credit_after ?? 0,
      log.status ?? 'success',
      log.error_message ?? null,
      log.ip_address ?? null,
      log.user_agent ?? null,
      log.duration_ms ?? null,
    ];

    if (conn) {
      await conn.execute(sql, params);
    } else {
      await query(sql, params);
    }
  },

  /**
   * Get usage logs for a specific API key.
   */
  async findByApiKeyId(apiKeyId: string, limit = 50, offset = 0): Promise<ApiUsageLogRecord[]> {
    return await query<ApiUsageLogRecord[]>(
      'SELECT * FROM api_usage_logs WHERE api_key_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [apiKeyId, limit, offset]
    );
  },

  /**
   * Get usage logs for a specific user.
   */
  async findByUserId(userId: string, limit = 50, offset = 0): Promise<ApiUsageLogRecord[]> {
    return await query<ApiUsageLogRecord[]>(
      'SELECT * FROM api_usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
  },

  /**
   * Get usage summary for a user within a date range.
   */
  async getSummaryByUser(userId: string, startDate: string, endDate: string): Promise<{
    total_requests: number;
    total_tokens: number;
    total_cost: number;
  } | null> {
    return await querySingle<any>(
      `SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost), 0) as total_cost
      FROM api_usage_logs
      WHERE user_id = ? AND created_at >= ? AND created_at <= ? AND status = 'success'`,
      [userId, startDate, endDate]
    );
  },

  /**
   * Get usage summary for a specific API key within a date range.
   */
  async getSummaryByApiKeyId(apiKeyId: string, startDate: string, endDate: string): Promise<{
    total_requests: number;
    total_tokens: number;
    total_cost: number;
  } | null> {
    return await querySingle<any>(
      `SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost), 0) as total_cost
      FROM api_usage_logs
      WHERE api_key_id = ? AND created_at >= ? AND created_at <= ? AND status = 'success'`,
      [apiKeyId, startDate, endDate]
    );
  },

  /**
   * Update log status (e.g., from 'success' to 'refunded').
   */
  async updateStatus(id: string, status: 'success' | 'error' | 'refunded', conn?: PoolConnection): Promise<void> {
    const sql = 'UPDATE api_usage_logs SET status = ? WHERE id = ?';

    if (conn) {
      await conn.execute(sql, [status, id]);
    } else {
      await query(sql, [status, id]);
    }
  },
};
