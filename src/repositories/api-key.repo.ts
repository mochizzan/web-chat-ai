/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, querySingle, querySimple } from '@/lib/db';
import { PoolConnection } from 'mysql2/promise';

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  encrypted_key: string | null;
  is_active: number;
  last_used_at: Date | null;
  expires_at: Date | null;
  total_requests: number;
  total_tokens: number;
  created_at: Date;
  updated_at: Date;
}

export const ApiKeyRepository = {
  /**
   * Create a new API key record.
   */
  async create(key: Partial<ApiKeyRecord>, conn?: PoolConnection): Promise<void> {
    const sql = `INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, encrypted_key, is_active, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      key.id ?? null,
      key.user_id ?? null,
      key.name ?? 'Default',
      key.key_prefix ?? null,
      key.key_hash ?? null,
      key.encrypted_key ?? null,
      key.is_active ?? 1,
      key.expires_at ?? null,
    ];

    if (conn) {
      await conn.execute(sql, params);
    } else {
      await query(sql, params);
    }
  },

  /**
   * Find an API key by its prefix (for lookup during auth).
   */
  async findByPrefix(prefix: string): Promise<ApiKeyRecord | null> {
    return await querySingle<ApiKeyRecord>(
      'SELECT * FROM api_keys WHERE key_prefix = ? AND is_active = 1',
      [prefix]
    );
  },

  /**
   * Find an API key by its ID.
   */
  async findById(id: string): Promise<ApiKeyRecord | null> {
    return await querySingle<ApiKeyRecord>(
      'SELECT * FROM api_keys WHERE id = ?',
      [id]
    );
  },

  /**
   * List all active API keys for a user (returns only prefix, not hash).
   */
  async listByUser(userId: string): Promise<ApiKeyRecord[]> {
    return await query<ApiKeyRecord[]>(
      'SELECT id, user_id, name, key_prefix, is_active, last_used_at, expires_at, total_requests, total_tokens, created_at, updated_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  },

  /**
   * Count active API keys for a user.
   */
  async countActiveByUser(userId: string): Promise<number> {
    const result = await querySingle<{ count: number }>(
      'SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    return result?.count ?? 0;
  },

  /**
   * Revoke an API key (soft delete — set is_active = 0).
   */
  async revoke(id: string, userId: string, conn?: PoolConnection): Promise<boolean> {
    const sql = 'UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?';
    const params = [id, userId];

    if (conn) {
      const [result] = await conn.execute(sql, params);
      return (result as any).affectedRows > 0;
    }
    const result = await query(sql, params);
    return (result as any).affectedRows > 0;
  },

  /**
   * Reactivate a revoked API key.
   */
  async reactivate(id: string, userId: string, conn?: PoolConnection): Promise<boolean> {
    const sql = 'UPDATE api_keys SET is_active = 1 WHERE id = ? AND user_id = ?';
    const params = [id, userId];

    if (conn) {
      const [result] = await conn.execute(sql, params);
      return (result as any).affectedRows > 0;
    }
    const result = await query(sql, params);
    return (result as any).affectedRows > 0;
  },

  /**
   * Update usage stats after a successful API call.
   */
  async updateUsage(id: string, tokens: number, conn?: PoolConnection): Promise<void> {
    const sql = 'UPDATE api_keys SET total_requests = total_requests + 1, total_tokens = total_tokens + ?, last_used_at = NOW() WHERE id = ?';
    const params = [tokens, id];

    if (conn) {
      await conn.execute(sql, params);
    } else {
      await query(sql, params);
    }
  },

  /**
   * Update specific fields of an API key record (e.g., encrypted_key).
   */
  async updateKey(id: string, fields: Partial<Pick<ApiKeyRecord, 'encrypted_key' | 'is_active'>>): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (fields.encrypted_key !== undefined) {
      setClauses.push('encrypted_key = ?');
      params.push(fields.encrypted_key);
    }
    if (fields.is_active !== undefined) {
      setClauses.push('is_active = ?');
      params.push(fields.is_active);
    }

    if (setClauses.length === 0) return;

    params.push(id);
    await query(`UPDATE api_keys SET ${setClauses.join(', ')} WHERE id = ?`, params);
  },

  /**
   * Permanently delete an API key record.
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM api_keys WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return (result as any).affectedRows > 0;
  },
};
