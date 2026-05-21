 
import { UserRepository } from '@/repositories/user.repo';
import { BillingRepository } from '@/repositories/billing.repo';
import { NotificationService } from '@/services/notification.service';
import { User, UserRole } from '@/types';

export const AdminService = {
  /**
   * Updates a user's role.
   */
  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    console.log(`[${new Date().toISOString()}] [AdminService] updateUserRole: Starting role update`, { userId, role });
    await UserRepository.updateRole(userId, role);
    
    // Broadcast update to the user
    const user = await UserRepository.findById(userId);
    if (user) {
      console.log(`[${new Date().toISOString()}] [AdminService] updateUserRole: Broadcasting user update`, { userId });
      await NotificationService.broadcast({
        type: 'user:update',
        user: {
          id: user.id,
          role: user.role,
          credit: user.credit,
        },
      });
    }
    console.log(`[${new Date().toISOString()}] [AdminService] updateUserRole: Successfully updated role`, { userId });
  },

  /**
   * Manages user credit adjustments by admin.
   */
  async adjustUserCredit(userId: string, amount: number, reason: string): Promise<void> {
    console.log(`[${new Date().toISOString()}] [AdminService] adjustUserCredit: Starting credit adjustment`, { userId, amount, reason });
    const { BillingService } = await import('@/services/billing.service');
    
    // If amount is positive, it's a top-up; if negative, it's a deduction.
    if (amount >= 0) {
      console.log(`[${new Date().toISOString()}] [AdminService] adjustUserCredit: Processing top-up`, { userId, amount });
      await BillingService.processTopup(userId, amount);
    } else {
      console.log(`[${new Date().toISOString()}] [AdminService] adjustUserCredit: Processing deduction`, { userId, amount, reason: reason || 'Deduction by admin' });
      await BillingService.deductCredit(userId, -amount, reason || 'Deduction by admin');
    }
    console.log(`[${new Date().toISOString()}] [AdminService] adjustUserCredit: Successfully adjusted credit`, { userId, amount });
  },

  /**
   * Lists users with pagination and search.
   */
  async listUsers(page: number, limit: number, search?: string) {
    console.log(`[${new Date().toISOString()}] [AdminService] listUsers: Starting user list query`, { page, limit, search });
    const result = await UserRepository.listUsers(page, limit, search);
    console.log(`[${new Date().toISOString()}] [AdminService] listUsers: Successfully retrieved users`, {
      count: result.users.length,
      total: result.total
    });
    return {
      ...result,
      users: result.users.map((u: any) => ({
        ...u,
        credit: Number(u.credit),
        total_spent: Number(u.total_spent),
      }))
    };
  },

  /**
   * Gets usage logs for admin with pagination, search, and period filter.
   */
  async getUsageLogs(page: number, limit: number, search: string, period: string) {
    console.log(`[${new Date().toISOString()}] [AdminService] getUsageLogs: Starting usage logs query`, { page, limit, search, period });
    const result = await BillingRepository.getAdminUsageLogs(page, limit, search, period);
    
    const mappedLogs = result.logs.map((log: any) => ({
      id: log.id,
      userName: log.user_name,
      userEmail: log.user_email,
      modelName: log.model_name,
      provider: log.provider,
      inputTokens: log.input_tokens,
      outputTokens: log.output_tokens,
      totalCost: log.total_cost,
      category: log.category,
      createdAt: log.created_at,
    }));

    console.log(`[${new Date().toISOString()}] [AdminService] getUsageLogs: Successfully retrieved usage logs`, {
      count: result.logs.length,
      total: result.total
    });

    return {
      ...result,
      logs: mappedLogs,
      page,
      limit
    };
  },

  /**
   * Deletes a user from the system.
   */
  async deleteUser(userId: string): Promise<void> {
    console.log(`[${new Date().toISOString()}] [AdminService] deleteUser: Starting user deletion`, { userId });
    await UserRepository.deleteUser(userId);
    console.log(`[${new Date().toISOString()}] [AdminService] deleteUser: Successfully deleted user`, { userId });
  },
};
