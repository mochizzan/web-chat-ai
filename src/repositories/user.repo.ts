import { query, querySingle, querySimple } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { User, UserRole } from '@/types';

export const UserRepository = {
  async findById(id: string): Promise<User | null> {
    console.log(`[${new Date().toISOString()}] [UserRepository] findById: Querying user by ID`, { id });
    const startTime = Date.now();
    try {
      const result = await querySingle<User>('SELECT * FROM users WHERE id = ?', [id]);
      console.log(`[${new Date().toISOString()}] [UserRepository] findById: Successfully found user`, {
        id,
        found: result !== null,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [UserRepository] findById: Error querying user`, {
        id,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async findByEmail(email: string): Promise<User | null> {
    console.log(`[${new Date().toISOString()}] [UserRepository] findByEmail: Querying user by email`, { email });
    const startTime = Date.now();
    try {
      const result = await querySingle<User>('SELECT * FROM users WHERE email = ?', [email]);
      console.log(`[${new Date().toISOString()}] [UserRepository] findByEmail: Successfully found user`, {
        email,
        found: result !== null,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [UserRepository] findByEmail: Error querying user`, {
        email,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async create(data: Partial<User>, conn?: PoolConnection): Promise<User> {
    const { id, email, name, password, role, avatar, credit, total_spent, api_key } = data;
    console.log(`[${new Date().toISOString()}] [UserRepository] create: Creating new user`, {
      email,
      name,
      role,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    
    try {
      if (conn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (conn as any).execute(
          'INSERT INTO users (id, email, name, password, role, avatar, credit, total_spent, api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, email, name, password, role, avatar, credit, total_spent, api_key]
        );
      } else {
        await query(
          'INSERT INTO users (id, email, name, password, role, avatar, credit, total_spent, api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, email, name, password, role, avatar, credit, total_spent, api_key]
        );
      }
      
      const user = await this.findById(id!);
      if (!user) throw new Error('User creation failed: User not found after insert');
      console.log(`[${new Date().toISOString()}] [UserRepository] create: Successfully created user`, {
        id,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return user;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [UserRepository] create: Error creating user`, {
        email,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async updateCredit(userId: string, amount: number, conn?: PoolConnection): Promise<void> {
    console.log(`[${new Date().toISOString()}] [UserRepository] updateCredit: Updating user credit`, {
      userId,
      amount,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      if (conn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (conn as any).execute('UPDATE users SET credit = credit + ? WHERE id = ?', [amount, userId]);
      } else {
        await query('UPDATE users SET credit = credit + ? WHERE id = ?', [amount, userId]);
      }
      console.log(`[${new Date().toISOString()}] [UserRepository] updateCredit: Successfully updated credit`, {
        userId,
        amount,
        timeTaken: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [UserRepository] updateCredit: Error updating credit`, {
        userId,
        amount,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async updateRole(userId: string, role: UserRole, conn?: PoolConnection): Promise<void> {
    console.log(`[${new Date().toISOString()}] [UserRepository] updateRole: Updating user role`, {
      userId,
      role,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      if (conn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (conn as any).execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
      } else {
        await query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
      }
      console.log(`[${new Date().toISOString()}] [UserRepository] updateRole: Successfully updated role`, {
        userId,
        role,
        timeTaken: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [UserRepository] updateRole: Error updating role`, {
        userId,
        role,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async listUsers(page: number, limit: number, search?: string): Promise<{ users: User[], total: number }> {
    console.log(`[${new Date().toISOString()}] [UserRepository] listUsers: Querying users with pagination`, {
      page,
      limit,
      search
    });
    const startTime = Date.now();
    try {
      // Sanitize and validate inputs to prevent NaN or negative values
      const safePage = Math.max(1, Math.floor(Number(page)) || 1);
      const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 10));
      const offset = (safePage - 1) * safeLimit;
      
      const searchPattern = search ? `%${search}%` : '%';
      
      const totalResult = await querySingle<{ total: number }>(
        'SELECT COUNT(*) as total FROM users WHERE email LIKE ? OR name LIKE ?',
        [searchPattern, searchPattern]
      );
      
      // Interpolate limit & offset as raw integers — some MySQL drivers/configurations
      // do not support parameterized placeholders (?) for LIMIT/OFFSET clauses.
      const users = await querySimple<User[]>(
        `SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`,
        [searchPattern, searchPattern]
      );
      
      console.log(`[${new Date().toISOString()}] [UserRepository] listUsers: Successfully queried users`, {
        count: users.length,
        total: totalResult?.total || 0,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return {
        users,
        total: totalResult?.total || 0
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [UserRepository] listUsers: Error querying users`, {
        page,
        limit,
        search,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  },

  async deleteUser(userId: string, conn?: PoolConnection): Promise<void> {
    console.log(`[${new Date().toISOString()}] [UserRepository] deleteUser: Deleting user`, {
      userId,
      hasConnection: !!conn
    });
    const startTime = Date.now();
    try {
      if (conn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (conn as any).execute('DELETE FROM users WHERE id = ?', [userId]);
      } else {
        await query('DELETE FROM users WHERE id = ?', [userId]);
      }
      console.log(`[${new Date().toISOString()}] [UserRepository] deleteUser: Successfully deleted user`, {
        userId,
        timeTaken: `${Date.now() - startTime}ms`
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [UserRepository] deleteUser: Error deleting user`, {
        userId,
        error: String(error),
        timeTaken: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }
};
