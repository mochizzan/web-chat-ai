import { AdminService } from '../admin.service';
import { UserRepository } from '@/repositories/user.repo';
import { BillingRepository } from '@/repositories/billing.repo';
import { NotificationService } from '@/services/notification.service';
import { BillingService } from '@/services/billing.service';

// Mock dependencies
jest.mock('@/repositories/user.repo');
jest.mock('@/repositories/billing.repo');
jest.mock('@/services/notification.service');
jest.mock('@/services/billing.service');

const mockedUserRepository = UserRepository as jest.Mocked<typeof UserRepository>;
const mockedBillingRepository = BillingRepository as jest.Mocked<typeof BillingRepository>;
const mockedNotificationService = NotificationService as jest.Mocked<typeof NotificationService>;
const mockedBillingService = BillingService as jest.Mocked<typeof BillingService>;

describe('AdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateUserRole', () => {
    it('should update user role and broadcast notification', async () => {
      const userId = 'user-123';
      const role = 'admin' as 'admin' | 'user';
      const user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        credit: 100,
        role: 'user',
      };

      mockedUserRepository.updateRole.mockResolvedValue(undefined);
      mockedUserRepository.findById.mockResolvedValue(user);

      await AdminService.updateUserRole(userId, role);

      expect(mockedUserRepository.updateRole).toHaveBeenCalledWith(userId, role);
      expect(mockedUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockedNotificationService.broadcast).toHaveBeenCalledWith({
        type: 'user:update',
        user: {
          id: user.id,
          role: user.role,
          credit: user.credit,
        },
      });
    });

    it('should not broadcast if user not found', async () => {
      const userId = 'nonexistent-user';
      const role = 'admin' as 'admin' | 'user';

      mockedUserRepository.updateRole.mockResolvedValue(undefined);
      mockedUserRepository.findById.mockResolvedValue(null);

      await AdminService.updateUserRole(userId, role);

      expect(mockedUserRepository.updateRole).toHaveBeenCalledWith(userId, role);
      expect(mockedUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockedNotificationService.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('adjustUserCredit', () => {
    it('should call processTopup for positive amount', async () => {
      const userId = 'user-123';
      const amount = 50.0;
      const reason = 'Admin top-up';

      await AdminService.adjustUserCredit(userId, amount, reason);

      expect(mockedBillingService.processTopup).toHaveBeenCalledWith(userId, amount);
    });

    it('should call deductCredit for negative amount', async () => {
      const userId = 'user-123';
      const amount = -30.0;
      const reason = 'Admin deduction';

      await AdminService.adjustUserCredit(userId, amount, reason);

      expect(mockedBillingService.deductCredit).toHaveBeenCalledWith(userId, 30, reason);
    });

    it('should use default reason for deduction if not provided', async () => {
      const userId = 'user-123';
      const amount = -10.0;

      await AdminService.adjustUserCredit(userId, amount, undefined);

      expect(mockedBillingService.deductCredit).toHaveBeenCalledWith(userId, 10, 'Deduction by admin');
    });

    it('should handle zero amount as top-up', async () => {
      const userId = 'user-123';
      const amount = 0;

      await AdminService.adjustUserCredit(userId, amount, 'test');

      expect(mockedBillingService.processTopup).toHaveBeenCalledWith(userId, 0);
    });
  });

  describe('listUsers', () => {
    it('should return paginated users with search', async () => {
      const page = 1;
      const limit = 10;
      const search = 'test';
      const users = [
        { id: '1', email: 'test1@example.com', name: 'Test 1', role: 'user', credit: 100, total_spent: 50 },
        { id: '2', email: 'test2@example.com', name: 'Test 2', role: 'admin', credit: 200, total_spent: 100 },
      ];
      const total = 2;

      mockedUserRepository.listUsers.mockResolvedValue({ users, total });

      const result = await AdminService.listUsers(page, limit, search);

      expect(mockedUserRepository.listUsers).toHaveBeenCalledWith(page, limit, search);
      expect(result).toEqual({ users, total });
    });

    it('should handle no search parameter', async () => {
      const page = 1;
      const limit = 10;

      mockedUserRepository.listUsers.mockResolvedValue({ users: [], total: 0 });

      await AdminService.listUsers(page, limit);

      expect(mockedUserRepository.listUsers).toHaveBeenCalledWith(page, limit, undefined);
    });
  });

  describe('getUsageLogs', () => {
    it('should return formatted usage logs for admin', async () => {
      const page = 1;
      const limit = 20;
      const search = '';
      const period = '7d';
      const rawLogs = [
        {
          id: 'log-1',
          user_name: 'Test User',
          user_email: 'test@example.com',
          model_name: 'GPT-4o',
          provider: 'openai',
          input_tokens: 1000,
          output_tokens: 500,
          total_cost: 0.06,
          category: 'assistant',
          created_at: new Date(),
        },
      ];
      const total = 1;
      const totalPages = 1;

      mockedBillingRepository.getAdminUsageLogs.mockResolvedValue({
        logs: rawLogs,
        total,
        totalPages,
      });

      const result = await AdminService.getUsageLogs(page, limit, search, period);

      expect(mockedBillingRepository.getAdminUsageLogs).toHaveBeenCalledWith(page, limit, search, period);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0]).toEqual({
        id: 'log-1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        modelName: 'GPT-4o',
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        totalCost: 0.06,
        category: 'assistant',
        createdAt: rawLogs[0].created_at,
      });
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should handle empty logs', async () => {
      mockedBillingRepository.getAdminUsageLogs.mockResolvedValue({
        logs: [],
        total: 0,
        totalPages: 0,
      });

      const result = await AdminService.getUsageLogs(1, 20, '', '7d');

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('deleteUser', () => {
    it('should delete user by id', async () => {
      const userId = 'user-123';

      mockedUserRepository.deleteUser.mockResolvedValue(undefined);

      await AdminService.deleteUser(userId);

      expect(mockedUserRepository.deleteUser).toHaveBeenCalledWith(userId);
    });
  });
});
