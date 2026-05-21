/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, querySimple, querySingle } from '@/lib/db';
import { CreditLog, UsageLog } from '@/types';

import { PoolConnection } from 'mysql2/promise';

export const BillingRepository = {
  async saveCreditLog(log: Partial<CreditLog>, conn?: PoolConnection): Promise<void> {
    const { id, user_id, type, amount, balance, description } = log;
    console.log(`[${new Date().toISOString()}] [BillingRepository] saveCreditLog: Saving credit log`, {
      logId: id,
      userId: user_id,
      type,
      amount,
      balance,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      const sql = 'INSERT INTO credit_logs (id, user_id, type, amount, balance, description) VALUES (?, ?, ?, ?, ?, ?)';
      const params = [
        id ?? null,
        user_id ?? null,
        type ?? null,
        amount ?? null,
        balance ?? null,
        description ?? null
      ];
      
      if (conn) {
        await conn.execute(sql, params);
      } else {
        await query(sql, params);
      }
      console.log(`[${new Date().toISOString()}] [BillingRepository] saveCreditLog: Successfully saved credit log`, {
        logId: id,
        timeTaken: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [BillingRepository] saveCreditLog: Error saving credit log`, {
        logId: id,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async getUsageLogs(userId: string, limit: number, conn?: PoolConnection): Promise<UsageLog[]> {
    console.log(`[${new Date().toISOString()}] [BillingRepository] getUsageLogs: Querying usage logs`, {
      userId,
      limit,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      const sql = `SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)}`;
      const params = [userId];
      
      if (conn) {
        const [rows] = await conn.execute(sql, params) as unknown as [UsageLog[]];
        console.log(`[${new Date().toISOString()}] [BillingRepository] getUsageLogs: Successfully queried usage logs`, {
          userId,
          count: rows.length,
          timeTaken: `${Date.now() - startTime}ms`
        });
        return rows;
      }
      const result = await query<UsageLog[]>(sql, params);
      console.log(`[${new Date().toISOString()}] [BillingRepository] getUsageLogs: Successfully queried usage logs`, {
        userId,
        count: result.length,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [BillingRepository] getUsageLogs: Error querying usage logs`, {
        userId,
        limit,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async getAdminUsageLogs(page: number, limit: number, search: string, period: string) {
    console.log(`[${new Date().toISOString()}] [BillingRepository] getAdminUsageLogs: Querying admin usage logs`, {
      page,
      limit,
      search,
      period
    });
    const startTime = Date.now();
    try {
      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const params: any[] = [];

      const getPeriodCondition = (p: string): string => {
        switch (p) {
          case 'today': return 'ul.created_at >= CURDATE()';
          case '24h': return 'ul.created_at >= NOW() - INTERVAL 1 DAY';
          case '7d': return 'ul.created_at >= NOW() - INTERVAL 7 DAY';
          case '30d': return 'ul.created_at >= NOW() - INTERVAL 30 DAY';
          case '1y': return 'ul.created_at >= NOW() - INTERVAL 1 YEAR';
          default: return '';
        }
      };

      const periodCond = getPeriodCondition(period);
      if (periodCond) conditions.push(periodCond);

      if (search) {
        conditions.push('(ul.model_name LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      const countResult = await querySimple<any[]>(
        `SELECT COUNT(*) as total
        FROM usage_logs ul
        JOIN users u ON u.id = ul.user_id
        ${whereClause}`,
        params
      );
      const total = countResult?.[0]?.total || 0;

      const logs = await querySimple<any[]>(
        `SELECT
          ul.id, u.name as user_name, u.email as user_email,
          ul.model_name, ul.provider,
          ul.input_tokens, ul.output_tokens, ul.total_cost,
          ul.category, ul.created_at
        FROM usage_logs ul
        JOIN users u ON u.id = ul.user_id
        ${whereClause}
        ORDER BY ul.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      console.log(`[${new Date().toISOString()}] [BillingRepository] getAdminUsageLogs: Successfully queried admin usage logs`, {
        count: logs?.length || 0,
        total,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return {
        logs: logs || [],
        total,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [BillingRepository] getAdminUsageLogs: Error querying admin usage logs`, {
        page,
        limit,
        search,
        period,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async getCreditLogs(userId: string, limit: number, conn?: PoolConnection): Promise<CreditLog[]> {
    console.log(`[${new Date().toISOString()}] [BillingRepository] getCreditLogs: Querying credit logs`, {
      userId,
      limit,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      const sql = `SELECT * FROM credit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)}`;
      const params = [userId];
      
      if (conn) {
        const [rows] = await conn.execute(sql, params) as unknown as [CreditLog[]];
        console.log(`[${new Date().toISOString()}] [BillingRepository] getCreditLogs: Successfully queried credit logs`, {
          userId,
          count: rows.length,
          timeTaken: `${Date.now() - startTime}ms`
        });
        return rows;
      }
      const result = await query<CreditLog[]>(sql, params);
      console.log(`[${new Date().toISOString()}] [BillingRepository] getCreditLogs: Successfully queried credit logs`, {
        userId,
        count: result.length,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [BillingRepository] getCreditLogs: Error querying credit logs`, {
        userId,
        limit,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async updateTotalSpent(userId: string, amount: number, conn?: PoolConnection): Promise<void> {
    console.log(`[${new Date().toISOString()}] [BillingRepository] updateTotalSpent: Updating total spent`, {
      userId,
      amount,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      const sql = 'UPDATE users SET total_spent = total_spent + ? WHERE id = ?';
      const params = [amount, userId];
      
      if (conn) {
        await conn.execute(sql, params);
      } else {
        await query(sql, params);
      }
      console.log(`[${new Date().toISOString()}] [BillingRepository] updateTotalSpent: Successfully updated total spent`, {
        userId,
        amount,
        timeTaken: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [BillingRepository] updateTotalSpent: Error updating total spent`, {
        userId,
        amount,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async updateUserCredit(userId: string, amount: number, conn?: PoolConnection): Promise<void> {
    console.log(`[${new Date().toISOString()}] [BillingRepository] updateUserCredit: Updating user credit`, {
      userId,
      amount,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      const sql = 'UPDATE users SET credit = credit + ? WHERE id = ?';
      const params = [amount, userId];
      
      if (conn) {
        await conn.execute(sql, params);
      } else {
        await query(sql, params);
      }
      console.log(`[${new Date().toISOString()}] [BillingRepository] updateUserCredit: Successfully updated credit`, {
        userId,
        amount,
        timeTaken: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [BillingRepository] updateUserCredit: Error updating credit`, {
        userId,
        amount,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async getUserBalance(userId: string, conn?: PoolConnection): Promise<number | null> {
    console.log(`[${new Date().toISOString()}] [BillingRepository] getUserBalance: Getting user balance`, {
      userId,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      const sql = 'SELECT credit FROM users WHERE id = ?';
      const params = [userId];
      
      if (conn) {
        const [rows]: any = await conn.execute(sql, params);
        const result = rows[0]?.credit ?? null;
        console.log(`[${new Date().toISOString()}] [BillingRepository] getUserBalance: Successfully got user balance`, {
          userId,
          balance: result,
          timeTaken: `${Date.now() - startTime}ms`
        });
        return result;
      }
      const result = await querySingle<{ credit: number }>(sql, params);
      const balance = result?.credit ?? null;
      console.log(`[${new Date().toISOString()}] [BillingRepository] getUserBalance: Successfully got user balance`, {
        userId,
        balance,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return balance;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [BillingRepository] getUserBalance: Error getting user balance`, {
        userId,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async lockUserForUpdate(userId: string, conn: PoolConnection): Promise<void> {
    console.log(`[${new Date().toISOString()}] [BillingRepository] lockUserForUpdate: Locking user for update`, {
      userId
    });
    const startTime = Date.now();
    try {
      await conn.execute('SELECT credit FROM users WHERE id = ? FOR UPDATE', [userId]);
      console.log(`[${new Date().toISOString()}] [BillingRepository] lockUserForUpdate: Successfully locked user`, {
        userId,
        timeTaken: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [BillingRepository] lockUserForUpdate: Error locking user`, {
        userId,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }
};
