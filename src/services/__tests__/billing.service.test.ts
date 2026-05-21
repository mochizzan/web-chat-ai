import { BillingService } from '../billing.service';
import { UserRepository } from '@/repositories/user.repo';
import { BillingRepository } from '@/repositories/billing.repo';
import { transaction } from '@/lib/db';
import { NotificationService } from '@/services/notification.service';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('@/repositories/user.repo');
jest.mock('@/repositories/billing.repo');
jest.mock('@/lib/db');
jest.mock('@/services/notification.service');
jest.mock('uuid', () => ({ v4: jest.fn() }));

const mockedUserRepository = UserRepository as jest.Mocked<typeof UserRepository>;
const mockedBillingRepository = BillingRepository as jest.Mocked<typeof BillingRepository>;
const mockedTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockedNotificationService = NotificationService as jest.Mocked<typeof NotificationService>;
const mockedUuidV4 = uuidv4 as jest.Mock;

describe('BillingService', () => {
  let mockConn: { commit: jest.Mock; rollback: jest.Mock; release: jest.Mock; execute: jest.Mock };
  beforeEach(() => {
    jest.resetAllMocks();
    mockedUuidV4.mockReturnValue('test-uuid-123');
    mockConn = {
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      execute: jest.fn(),
    };
    mockedTransaction.mockImplementation(async (fn: (conn: { commit: jest.Mock; rollback: jest.Mock; release: jest.Mock; execute: jest.Mock }) => Promise<unknown>) => {
      try {
        const result = await fn(mockConn);
        await mockConn.commit();
        return result;
      } catch (error) {
        await mockConn.rollback();
        throw error;
      } finally {
        await mockConn.release();
      }
    });
  });

  describe('checkSufficientCredit', () => {
    it('should return true if user has sufficient credit', async () => {
      const userId = 'user-123';
      const estimatedCost = 50.0;
      const user = {
        id: userId,
        credit: 100,
      };

      mockedUserRepository.findById.mockResolvedValue(user);

      const result = await BillingService.checkSufficientCredit(userId, estimatedCost);

      expect(result).toBe(true);
      expect(mockedUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should return false if user has insufficient credit', async () => {
      const userId = 'user-123';
      const estimatedCost = 150.0;
      const user = {
        id: userId,
        credit: 100,
      };

      mockedUserRepository.findById.mockResolvedValue(user);

      const result = await BillingService.checkSufficientCredit(userId, estimatedCost);

      expect(result).toBe(false);
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent-user';
      const estimatedCost = 50.0;

      mockedUserRepository.findById.mockResolvedValue(null);

      await expect(
        BillingService.checkSufficientCredit(userId, estimatedCost)
      ).rejects.toThrow('User not found');
    });
  });

  describe('getAccountDetails', () => {
    it('should return user and credit logs', async () => {
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        credit: 100,
        total_spent: 50,
      };
      const creditLogs = [
        {
          id: 'log-1',
          user_id: userId,
          type: 'topup',
          amount: 100,
          balance: 100,
          description: 'Initial topup',
          created_at: new Date(),
        },
      ];

      mockedUserRepository.findById.mockResolvedValue(user);
      mockedBillingRepository.getCreditLogs.mockResolvedValue(creditLogs);

      const result = await BillingService.getAccountDetails(userId);

      expect(result).toEqual({
        user,
        creditLogs,
      });
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent-user';
      mockedUserRepository.findById.mockResolvedValue(null);

      await expect(BillingService.getAccountDetails(userId)).rejects.toThrow('User not found');
    });
  });

  describe('getUsageLogs', () => {
    it('should return usage logs for user', async () => {
      const userId = 'user-123';
      const limit = 10;
      const usageLogs = [
        {
          id: 'usage-1',
          user_id: userId,
          conversation_id: 'conv-1',
          message_id: 'msg-1',
          model_id: 'gpt-4o',
          model_name: 'GPT-4o',
          provider: 'openai',
          input_tokens: 1000,
          output_tokens: 500,
          input_cost: 0.01,
          output_cost: 0.05,
          total_cost: 0.06,
          category: 'assistant',
          created_at: new Date(),
        },
      ];

      mockedBillingRepository.getUsageLogs.mockResolvedValue(usageLogs);

      const result = await BillingService.getUsageLogs(userId, limit);

      expect(mockedBillingRepository.getUsageLogs).toHaveBeenCalledWith(userId, limit);
      expect(result).toEqual(usageLogs);
    });
  });

  describe('processTopup', () => {
    it('should process topup successfully within transaction', async () => {
      const userId = 'user-123';
      const amount = 50.0;
      const newBalance = 150.0;

      mockedBillingRepository.getUserBalance.mockResolvedValue(newBalance);
      mockedUserRepository.findById.mockResolvedValue({
        id: userId,
        credit: newBalance,
      });

      await BillingService.processTopup(userId, amount);

      expect(mockedTransaction).toHaveBeenCalledWith(expect.any(Function));
      expect(mockedBillingRepository.updateUserCredit).toHaveBeenCalledWith(userId, amount, expect.any(Object));
      expect(mockedBillingRepository.getUserBalance).toHaveBeenCalledWith(userId, expect.any(Object));
      expect(mockedBillingRepository.saveCreditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          type: 'topup',
          amount: amount,
          balance: newBalance,
          description: `Top-up of ${amount} credits`,
        }),
        expect.any(Object)
      );
      expect(mockedNotificationService.broadcast).toHaveBeenCalledWith({
        type: 'credit:update',
        userId,
        newBalance,
      });
    });

    it('should throw error for non-positive amount', async () => {
      const userId = 'user-123';
      const amount = 0;

      await expect(BillingService.processTopup(userId, amount)).rejects.toThrow(
        'Top-up amount must be positive'
      );
      expect(mockedTransaction).not.toHaveBeenCalled();
    });

    it('should throw error if failed to get updated balance', async () => {
      const userId = 'user-123';
      const amount = 50.0;

      mockedBillingRepository.getUserBalance.mockResolvedValue(null);

      await expect(BillingService.processTopup(userId, amount)).rejects.toThrow(
        'Failed to retrieve updated balance'
      );
    });

    it('should rollback transaction on error', async () => {
      const userId = 'user-123';
      const amount = 50.0;

      // Setup mocks for successful steps until the error
      mockedBillingRepository.updateUserCredit.mockResolvedValue(undefined);
      mockedBillingRepository.getUserBalance.mockResolvedValue(150);
      mockedBillingRepository.saveCreditLog.mockRejectedValue(new Error('DB error'));

      await expect(BillingService.processTopup(userId, amount)).rejects.toThrow('DB error');

      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.commit).not.toHaveBeenCalled();
    });
  });

  describe('deductCredit', () => {
    it('should deduct credit successfully within transaction', async () => {
      const userId = 'user-123';
      const amount = 10.0;
      const description = 'Chat usage';
      const currentBalance = 100;
      const newBalance = 90;

      mockedBillingRepository.lockUserForUpdate.mockResolvedValue(undefined);
      mockedBillingRepository.getUserBalance.mockResolvedValue(currentBalance);
      mockedUserRepository.findById.mockResolvedValue({
        id: userId,
        credit: newBalance,
      });

      await BillingService.deductCredit(userId, amount, description);

      expect(mockedTransaction).toHaveBeenCalledWith(expect.any(Function));
      expect(mockedBillingRepository.lockUserForUpdate).toHaveBeenCalledWith(userId, expect.any(Object));
      expect(mockedBillingRepository.getUserBalance).toHaveBeenCalledWith(userId, expect.any(Object));
      expect(mockedBillingRepository.updateUserCredit).toHaveBeenCalledWith(userId, -amount, expect.any(Object));
      expect(mockedBillingRepository.updateTotalSpent).toHaveBeenCalledWith(userId, amount, expect.any(Object));
      expect(mockedBillingRepository.saveCreditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          type: 'usage',
          amount: -amount,
          balance: newBalance,
          description,
        }),
        expect.any(Object)
      );
      expect(mockedNotificationService.broadcast).toHaveBeenCalledWith({
        type: 'credit:update',
        userId,
        newBalance,
      });
    });

    it('should throw error for negative amount', async () => {
      const userId = 'user-123';
      const amount = -10.0;

      await expect(BillingService.deductCredit(userId, amount, 'test')).rejects.toThrow(
        'Deduction amount cannot be negative'
      );
      expect(mockedTransaction).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent-user';
      const amount = 10.0;

      mockedBillingRepository.lockUserForUpdate.mockResolvedValue(undefined);
      mockedBillingRepository.getUserBalance.mockResolvedValue(null);

      await expect(BillingService.deductCredit(userId, amount, 'test')).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if insufficient balance', async () => {
      const userId = 'user-123';
      const amount = 150.0;
      const currentBalance = 100;

      mockedBillingRepository.lockUserForUpdate.mockResolvedValue(undefined);
      mockedBillingRepository.getUserBalance.mockResolvedValue(currentBalance);

      await expect(BillingService.deductCredit(userId, amount, 'test')).rejects.toThrow(
        'Insufficient credit'
      );
    });

    it('should rollback transaction on error', async () => {
      const userId = 'user-123';
      const amount = 10.0;
      const currentBalance = 100;

      mockedBillingRepository.lockUserForUpdate.mockResolvedValue(undefined);
      mockedBillingRepository.getUserBalance.mockResolvedValue(currentBalance);
      mockedBillingRepository.updateUserCredit.mockResolvedValue(undefined);
      mockedBillingRepository.updateTotalSpent.mockResolvedValue(undefined);
      mockedBillingRepository.saveCreditLog.mockRejectedValue(new Error('DB error'));

      await expect(BillingService.deductCredit(userId, amount, 'test')).rejects.toThrow('DB error');

      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.commit).not.toHaveBeenCalled();
    });
  });
});