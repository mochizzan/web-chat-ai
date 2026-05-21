import { transaction } from '@/lib/db';
import { BillingRepository } from '@/repositories/billing.repo';
import { UserRepository } from '@/repositories/user.repo';
import { NotificationService } from '@/services/notification.service';
import { CreditLog } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export const BillingService = {
  /**
   * Checks if a user has enough credit for an estimated cost.
   */
  async checkSufficientCredit(userId: string, estimatedCost: number): Promise<boolean> {
    console.log(`[${new Date().toISOString()}] [BillingService] checkSufficientCredit: Checking credit for user`, { userId, estimatedCost });
    const user = await UserRepository.findById(userId);
    if (!user) {
      console.log(`[${new Date().toISOString()}] [BillingService] checkSufficientCredit: User not found`, { userId });
      throw new Error('User not found');
    }
    const hasSufficientCredit = user.credit >= estimatedCost;
    console.log(`[${new Date().toISOString()}] [BillingService] checkSufficientCredit: Credit check result`, {
      userId,
      estimatedCost,
      currentCredit: user.credit,
      hasSufficientCredit
    });
    return hasSufficientCredit;
  },

  /**
   * Gets user account details and recent credit logs.
   */
  async getAccountDetails(userId: string) {
    console.log(`[${new Date().toISOString()}] [BillingService] getAccountDetails: Fetching account details`, { userId });
    const user = await UserRepository.findById(userId);
    if (!user) {
      console.log(`[${new Date().toISOString()}] [BillingService] getAccountDetails: User not found`, { userId });
      throw new Error('User not found');
    }

    console.log(`[${new Date().toISOString()}] [BillingService] getAccountDetails: Fetching credit logs`, { userId });
    const creditLogs = await BillingRepository.getCreditLogs(userId, 50);

    console.log(`[${new Date().toISOString()}] [BillingService] getAccountDetails: Successfully fetched account details`, {
      userId,
      creditLogCount: creditLogs.length
    });
    return {
      user,
      creditLogs,
    };
  },

  /**
   * Gets user usage logs.
   */
  async getUsageLogs(userId: string, limit: number) {
    console.log(`[${new Date().toISOString()}] [BillingService] getUsageLogs: Fetching usage logs`, { userId, limit });
    const safeLimit = Number(limit) || 100;
    const logs = await BillingRepository.getUsageLogs(userId, safeLimit);
    console.log(`[${new Date().toISOString()}] [BillingService] getUsageLogs: Successfully fetched usage logs`, {
      userId,
      logCount: logs.length
    });
    return logs;
  },

  /**
   * Processes a credit top-up for a user.
   * Updates balance -> Logs transaction -> Broadcasts via WebSocket.
   */
  async processTopup(userId: string, amount: number): Promise<void> {
    console.log(`[${new Date().toISOString()}] [BillingService] processTopup: Starting top-up process`, { userId, amount });
    if (amount <= 0) {
      console.log(`[${new Date().toISOString()}] [BillingService] processTopup: Invalid top-up amount`, { amount });
      throw new Error('Top-up amount must be positive');
    }
  
    await transaction(async (conn) => {
      console.log(`[${new Date().toISOString()}] [BillingService] processTopup: Updating user credit`, { userId, amount });
      await BillingRepository.updateUserCredit(userId, amount, conn);
  
      console.log(`[${new Date().toISOString()}] [BillingService] processTopup: Getting updated balance`, { userId });
      const newBalance = await BillingRepository.getUserBalance(userId, conn);
  
      if (newBalance === null) {
        console.error(`[${new Date().toISOString()}] [BillingService] processTopup: Failed to retrieve updated balance`, { userId });
        throw new Error('Failed to retrieve updated balance');
      }
  
      console.log(`[${new Date().toISOString()}] [BillingService] processTopup: Creating credit log`, {
        userId,
        amount,
        newBalance
      });
      // 3. Create credit log
      const log: CreditLog = {
        id: uuidv4(),
        user_id: userId,
        type: 'topup',
        amount: amount,
        balance: newBalance,
        description: `Top-up of ${amount} credits`,
        created_at: new Date(),
      };
  
      await BillingRepository.saveCreditLog(log, conn);
      console.log(`[${new Date().toISOString()}] [BillingService] processTopup: Credit log saved`, { logId: log.id });
    });

    console.log(`[${new Date().toISOString()}] [BillingService] processTopup: Broadcasting credit update`, { userId });
    // 4. Broadcast update via WebSocket (outside transaction to avoid holding lock)
    const user = await UserRepository.findById(userId);
    if (user) {
      await NotificationService.broadcast({
        type: 'credit:update',
        userId: userId,
        newBalance: user.credit,
      });
      console.log(`[${new Date().toISOString()}] [BillingService] processTopup: Successfully completed top-up`, {
        userId,
        amount,
        newBalance: user.credit
      });
    }
  },

  /**
   * Deducts credit from a user and logs the usage.
   * Used by ChatService.
   */
  async deductCredit(userId: string, amount: number, description: string): Promise<void> {
    console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Starting credit deduction`, {
      userId,
      amount,
      description
    });
    if (amount < 0) {
      console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Invalid deduction amount`, { amount });
      throw new Error('Deduction amount cannot be negative');
    }
  
    await transaction(async (conn) => {
      console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Locking user for update`, { userId });
      // Check balance again inside transaction to prevent race conditions
      await BillingRepository.lockUserForUpdate(userId, conn);
      console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Getting current balance`, { userId });
      const currentBalance = await BillingRepository.getUserBalance(userId, conn);
  
      if (currentBalance === null) {
        console.error(`[${new Date().toISOString()}] [BillingService] deductCredit: User not found`, { userId });
        throw new Error('User not found');
      }
      if (currentBalance < amount) {
        console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Insufficient credit`, {
          userId,
          currentBalance,
          amount
        });
        throw new Error('Insufficient credit');
      }
  
      const newBalance = currentBalance - amount;
      console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Updating balance`, {
        userId,
        newBalance
      });
  
      // Update balance
      await BillingRepository.updateUserCredit(userId, -amount, conn);
      
      // Update total spent
      await BillingRepository.updateTotalSpent(userId, amount, conn);
  
      // Log the usage
      const logId = uuidv4();
      console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Saving credit log`, {
        logId,
        userId,
        amount,
        newBalance
      });
      await BillingRepository.saveCreditLog({
        id: logId,
        user_id: userId,
        type: 'usage',
        amount: -amount,
        balance: newBalance,
        description: description,
      }, conn);
    });

    console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Broadcasting credit update`, { userId });
    // Broadcast update
    const user = await UserRepository.findById(userId);
    if (user) {
      await NotificationService.broadcast({
        type: 'credit:update',
        userId: userId,
        newBalance: user.credit,
      });
      console.log(`[${new Date().toISOString()}] [BillingService] deductCredit: Successfully completed deduction`, {
        userId,
        amount,
        newBalance: user.credit
      });
    }
  },
};
