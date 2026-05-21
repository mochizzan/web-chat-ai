import { ChatUsageTrackingService } from '../chat-usage-tracking.service';
import { UserRepository } from '@/repositories/user.repo';
import { ChatRepository } from '@/repositories/chat.repo';
import { BillingService } from '@/services/billing.service';

// Mock dependencies
jest.mock('@/repositories/user.repo');
jest.mock('@/repositories/chat.repo');
jest.mock('@/services/billing.service');

const mockedUserRepository = UserRepository as jest.Mocked<typeof UserRepository>;
const mockedChatRepository = ChatRepository as jest.Mocked<typeof ChatRepository>;
const mockedBillingService = BillingService as jest.Mocked<typeof BillingService>;

describe('ChatUsageTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCost', () => {
    const mockModel = {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      inputPrice: 2.50,
      outputPrice: 10.00,
      free: false,
      discountPercent: 0,
      discountType: 'none',
    };

    it('should calculate cost correctly for paid model', () => {
      const inputTokens = 1_000_000;
      const outputTokens = 500_000;

      const result = ChatUsageTrackingService.calculateCost(inputTokens, outputTokens, mockModel);

      expect(result).not.toBeNull();
      expect(result!.inputCost).toBeCloseTo(2.5, 2);
      expect(result!.outputCost).toBeCloseTo(5.0, 2);
      expect(result!.totalCost).toBeCloseTo(7.5, 2);
    });

    it('should return zero cost for free model', () => {
      const freeModel = { ...mockModel, free: true };
      const result = ChatUsageTrackingService.calculateCost(1000, 1000, freeModel);

      expect(result).toEqual({ inputCost: 0, outputCost: 0, totalCost: 0 });
    });

    it('should return null for zero tokens', () => {
      const result = ChatUsageTrackingService.calculateCost(0, 0, mockModel);
      expect(result).toBeNull();
    });

    it('should apply input discount correctly', () => {
      const discountedModel = {
        ...mockModel,
        discountPercent: 20,
        discountType: 'input',
      };
      const result = ChatUsageTrackingService.calculateCost(1_000_000, 500_000, discountedModel);

      expect(result).not.toBeNull();
      expect(result!.inputCost).toBeCloseTo(2.0, 2); // 2.5 * 0.8
      expect(result!.outputCost).toBeCloseTo(5.0, 2); // no discount
    });

    it('should apply output discount correctly', () => {
      const discountedModel = {
        ...mockModel,
        discountPercent: 20,
        discountType: 'output',
      };
      const result = ChatUsageTrackingService.calculateCost(1_000_000, 500_000, discountedModel);

      expect(result).not.toBeNull();
      expect(result!.inputCost).toBeCloseTo(2.5, 2); // no discount
      expect(result!.outputCost).toBeCloseTo(4.0, 2); // 10.0 * 0.8
    });

    it('should apply both discounts correctly', () => {
      const discountedModel = {
        ...mockModel,
        discountPercent: 20,
        discountType: 'both',
      };
      const result = ChatUsageTrackingService.calculateCost(1_000_000, 500_000, discountedModel);

      expect(result).not.toBeNull();
      expect(result!.inputCost).toBeCloseTo(2.0, 2);
      expect(result!.outputCost).toBeCloseTo(4.0, 2);
      expect(result!.totalCost).toBeCloseTo(6.0, 2);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate token count correctly', () => {
      const text = 'Hello world this is a test';
      const estimated = ChatUsageTrackingService.estimateTokens(text);

      // The formula is Math.ceil(text.length / 3.5) + 20
      const expected = Math.ceil(text.length / 3.5) + 20;
      expect(estimated).toBe(expected);
    });

    it('should handle empty string', () => {
      const estimated = ChatUsageTrackingService.estimateTokens('');
      expect(estimated).toBe(20); // Just the base offset
    });
  });

  describe('saveUsageLog', () => {
    it('should save usage log via ChatRepository', async () => {
      const log = {
        id: 'log-123',
        userId: 'user-123',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        modelId: 'gpt-4o',
        modelName: 'GPT-4o',
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        inputCost: 0.01,
        outputCost: 0.05,
        totalCost: 0.06,
        category: 'assistant',
      };

      mockedChatRepository.saveUsageLog.mockResolvedValue(undefined);

      await ChatUsageTrackingService.saveUsageLog(log);

      expect(mockedChatRepository.saveUsageLog).toHaveBeenCalledWith(log);
    });
  });

  describe('checkCredit', () => {
    it('should return credit remaining for valid user', async () => {
      const userId = 'user-123';
      const estimatedCost = 1.0;
      const user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        credit: 100,
        total_spent: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedUserRepository.findById.mockResolvedValue(user);

      const result = await ChatUsageTrackingService.checkCredit(userId, estimatedCost, false);

      expect(result).toBe(100);
      expect(mockedUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should return -1 for free models', async () => {
      const userId = 'user-123';
      const result = await ChatUsageTrackingService.checkCredit(userId, 1.0, true);

      expect(result).toBe(-1);
      expect(mockedUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error if credit insufficient', async () => {
      const userId = 'user-123';
      const estimatedCost = 50.0;
      const user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        credit: 10,
        total_spent: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedUserRepository.findById.mockResolvedValue(user);

      await expect(
        ChatUsageTrackingService.checkCredit(userId, estimatedCost, false)
      ).rejects.toThrow('INSUFFICIENT_CREDITS');

      // Should check with 1.2 multiplier
      // 10 < 50 * 1.2 = 60
    });

    it('should handle database errors gracefully', async () => {
      const userId = 'user-123';
      const estimatedCost = 1.0;

      mockedUserRepository.findById.mockRejectedValue(new Error('DB error'));

      const result = await ChatUsageTrackingService.checkCredit(userId, estimatedCost, false);

      expect(result).toBe(-1);
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent-user';
      const estimatedCost = 1.0;

      mockedUserRepository.findById.mockResolvedValue(null);

      await expect(ChatUsageTrackingService.checkCredit(userId, estimatedCost, false))
        .rejects.toThrow('INSUFFICIENT_CREDITS');
    });
  });

  describe('deductCredit', () => {
    it('should deduct credit via BillingService', async () => {
      const userId = 'user-123';
      const cost = 5.0;
      const description = 'Chat usage';

      mockedBillingService.deductCredit.mockResolvedValue(undefined);

      await ChatUsageTrackingService.deductCredit(userId, cost, description);

      expect(mockedBillingService.deductCredit).toHaveBeenCalledWith(userId, cost, description);
    });
  });

  describe('getCreditRemaining', () => {
    it('should return credit balance for user', async () => {
      const userId = 'user-123';
      const user = {
        id: userId,
        credit: 75.5,
      };

      mockedUserRepository.findById.mockResolvedValue(user);

      const result = await ChatUsageTrackingService.getCreditRemaining(userId);

      expect(result).toBe(75.5);
    });

    it('should return -1 if user not found', async () => {
      const userId = 'nonexistent-user';
      mockedUserRepository.findById.mockResolvedValue(null);

      const result = await ChatUsageTrackingService.getCreditRemaining(userId);

      expect(result).toBe(-1);
    });

    it('should return -1 on database error', async () => {
      const userId = 'user-123';
      mockedUserRepository.findById.mockRejectedValue(new Error('DB error'));

      const result = await ChatUsageTrackingService.getCreditRemaining(userId);

      expect(result).toBe(-1);
    });
  });

  describe('buildUsageLog', () => {
    it('should build usage log object correctly', () => {
      const log = ChatUsageTrackingService.buildUsageLog(
        'log-123',
        'user-123',
        'conv-123',
        'msg-123',
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          provider: 'openai',
          inputPrice: 2.5,
          outputPrice: 10.0,
          free: false,
        },
        1000,
        500,
        { inputCost: 0.01, outputCost: 0.05, totalCost: 0.06 },
        'assistant'
      );

      expect(log).toEqual({
        id: 'log-123',
        userId: 'user-123',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        modelId: 'gpt-4o',
        modelName: 'GPT-4o',
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        inputCost: 0.01,
        outputCost: 0.05,
        totalCost: 0.06,
        category: 'assistant',
      });
    });
  });
});